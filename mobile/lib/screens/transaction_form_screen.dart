import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api_client.dart';
import '../app_widget_sync.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';

/// 幣別輸入的預設建議；實際清單會再併入使用者帳戶的幣別與目前交易幣別。
const _kDefaultCurrencies = [
  'TWD',
  'USD',
  'JPY',
  'EUR',
  'CNY',
  'HKD',
  'GBP',
  'AUD',
  'CAD',
  'SGD',
];

/// 新增／編輯交易。轉帳僅支援新增。
class TransactionFormScreen extends StatefulWidget {
  final Txn? existing;
  final String? initialType;
  final String? initialCategoryShortcut;
  const TransactionFormScreen({
    super.key,
    this.existing,
    this.initialType,
    this.initialCategoryShortcut,
  });

  @override
  State<TransactionFormScreen> createState() => _TransactionFormScreenState();
}

class _TransactionFormScreenState extends State<TransactionFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _note = TextEditingController();
  final _fxFee = TextEditingController();
  final _fxRate = TextEditingController();
  TextEditingController? _currencyInput;
  bool _excludeFromStats = false;
  // 交易幣別。預設跟隨所選帳戶，但可獨立輸入（外幣消費／刷卡）。
  String _currency = 'TWD';

  late Future<void> _loadFuture;
  List<Account> _accounts = [];
  List<Category> _categories = [];

  String _type = 'expense'; // expense / income / transfer
  DateTime _date = DateTime.now();
  String? _categoryId; // 實際存到後端的子分類 id
  String? _parentCatId; // 兩段式選擇用：目前選到的父分類 id（不送後端）
  String? _accountId;
  String? _toAccountId;
  bool _saving = false;
  final _picker = ImagePicker();
  final List<XFile> _photos = [];
  // 編輯模式下，後端已存在的照片附件（含 id，供檢視／刪除）。
  List<Map<String, dynamic>> _existingPhotos = [];

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _type = e.type == 'transfer' ? 'expense' : e.type;
      // 外幣交易以原幣別金額（originalAmount）編輯；TWD 交易等同 amount。
      _amount.text = e.originalAmount.toString();
      _note.text = e.note;
      _categoryId = e.categoryId.isEmpty ? null : e.categoryId;
      _accountId = e.accountId.isEmpty ? null : e.accountId;
      _date = DateTime.tryParse(e.date) ?? DateTime.now();
      _excludeFromStats = e.excludeFromStats;
      _currency = e.currency.isEmpty ? 'TWD' : e.currency;
      // 帶入原交易匯率，避免儲存時被系統匯率覆寫；'1' 視為未指定。
      final rate = num.tryParse(e.fxRate) ?? 1;
      if (_currency != 'TWD' && rate > 0 && rate != 1) _fxRate.text = e.fxRate;
      if (e.fxFee > 0) _fxFee.text = e.fxFee.round().toString();
    } else {
      final initialType = widget.initialType;
      if (initialType == 'expense' ||
          initialType == 'income' ||
          initialType == 'transfer') {
        _type = initialType!;
      }
    }
    _loadFuture = _loadRefs();
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    _fxFee.dispose();
    _fxRate.dispose();
    super.dispose();
  }

  Account? get _selectedAccount {
    for (final a in _accounts) {
      if (a.id == _accountId) return a;
    }
    return null;
  }

  /// 信用卡帳戶、以外幣消費、且該卡有海外手續費率時，顯示手續費相關欄位。
  /// 與網頁版一致：是否為外幣以「交易幣別」判斷，而非帳戶幣別。
  bool get _overseasApplies {
    final a = _selectedAccount;
    return _type == 'expense' &&
        a != null &&
        a.category == 'credit_card' &&
        _currency != 'TWD' &&
        a.overseasFeeRate > 0;
  }

  /// 幣別建議選項：交易幣別 + TWD + 各帳戶幣別 + 常見幣別（去重、保序）。
  List<String> get _currencyOptions => <String>{
    _currency,
    'TWD',
    for (final a in _accounts) a.currency,
    ..._kDefaultCurrencies,
  }.toList();

  Future<void> _loadRefs() async {
    final api = ApiClient.instance;
    final acc = await api.accounts();
    final cat = await api.categories();
    _accounts = acc
        .map((e) => Account.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    _categories = cat
        .map((e) => Category.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    _accountId ??= _accounts.isNotEmpty ? _accounts.first.id : null;
    // 新增模式：幣別預設跟隨預選帳戶。編輯模式維持原交易幣別（已於 initState 帶入）。
    if (!_isEdit) {
      final a = _selectedAccount;
      if (a != null) {
        _currency = a.currency;
        _currencyInput?.text = _currency;
      }
      _applyInitialCategoryShortcut();
    }
    final e = widget.existing;
    if (e != null) {
      // 附件載入失敗不應擋住整張編輯表單，靜默略過。
      try {
        final list = await api.listTransactionAttachments(e.id);
        _existingPhotos = list
            .whereType<Map>()
            .map((m) => m.cast<String, dynamic>())
            .toList();
      } catch (_) {
        _existingPhotos = [];
      }
    }
  }

  void _applyInitialCategoryShortcut() {
    final shortcut = widget.initialCategoryShortcut?.trim().toLowerCase();
    if (shortcut == null || shortcut.isEmpty) return;

    final parentNames = _shortcutParentNames(shortcut);
    if (parentNames.isEmpty) return;

    _type = 'expense';
    final parent = _findCategory(
      _categories.where((c) => c.type == 'expense' && c.isParent),
      parentNames,
    );
    if (parent == null) return;

    _parentCatId = parent.id;
    final children = _childCatsOf(parent.id);
    final preferredChild = _findCategory(
      children,
      _shortcutChildNames(shortcut),
    );
    _categoryId =
        (preferredChild ?? (children.isEmpty ? null : children.first))?.id;
  }

  List<String> _shortcutParentNames(String shortcut) {
    switch (shortcut) {
      case 'food':
        return [
          '餐飲',
          '飲食',
          '食物',
          'food',
          'dining',
          'meal',
          'meals',
          'restaurant',
          'restaurants',
        ];
      case 'transport':
        return [
          '交通',
          '交通費',
          'transport',
          'transportation',
          'transit',
          'commute',
        ];
      case 'shopping':
        return [
          '購物',
          'shopping',
          'shop',
          '日用品',
          '生活用品',
        ];
      default:
        return const [];
    }
  }

  List<String> _shortcutChildNames(String shortcut) {
    switch (shortcut) {
      case 'food':
        final hour = DateTime.now().hour;
        if (hour >= 5 && hour < 11) {
          return ['早餐', '早午餐', 'breakfast', 'brunch', '餐飲', '飲食'];
        }
        if (hour >= 11 && hour < 16) {
          return ['午餐', '便當', 'lunch', '餐飲', '飲食'];
        }
        if (hour >= 16 && hour < 22) {
          return ['晚餐', 'dinner', '餐飲', '飲食'];
        }
        return ['飲料', '點心', '宵夜', 'drink', 'snack', '餐飲', '飲食'];
      case 'transport':
        return [
          '大眾運輸',
          '捷運',
          '公車',
          '火車',
          '高鐵',
          'transport',
          'transit',
        ];
      case 'shopping':
        return ['日用品', '生活用品', '購物', 'shopping', 'daily'];
      default:
        return const [];
    }
  }

  Category? _findCategory(
    Iterable<Category> categories,
    List<String> candidateNames,
  ) {
    final normalizedCandidates = candidateNames
        .map(_normalizeCategoryName)
        .where((name) => name.isNotEmpty)
        .toSet();
    if (normalizedCandidates.isEmpty) return null;

    for (final category in categories) {
      if (normalizedCandidates.contains(_normalizeCategoryName(category.name))) {
        return category;
      }
    }
    for (final category in categories) {
      final name = _normalizeCategoryName(category.name);
      if (normalizedCandidates.any((candidate) {
        return name.contains(candidate) || candidate.contains(name);
      })) {
        return category;
      }
    }
    return null;
  }

  String _normalizeCategoryName(String value) =>
      value.toLowerCase().replaceAll(RegExp(r'\s+'), '');

  /// 僅顯示符合目前收支類型的子分類（交易必須掛在子分類）。
  List<Category> get _selectableCats =>
      _categories.where((c) => c.type == _type && !c.isParent).toList();

  /// 有可選子分類的父分類清單（依目前收支類型過濾），保留原分類排序。
  List<Category> get _selectableParents {
    final parentIds = _selectableCats.map((c) => c.parentId).toSet();
    return _categories.where((c) => parentIds.contains(c.id)).toList();
  }

  /// 指定父分類底下、符合目前收支類型的子分類。
  List<Category> _childCatsOf(String parentId) =>
      _selectableCats.where((c) => c.parentId == parentId).toList();

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (d != null) setState(() => _date = d);
  }

  String get _dateStr =>
      '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  Future<void> _pickPhotos() async {
    final remaining = 5 - _photos.length;
    if (remaining <= 0) {
      toast(context, trKey('mobileLegacyUpTo5PhotosPerTransaction'));
      return;
    }
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: Icon(Icons.camera_alt_outlined),
              title: Text(trKey('featuresTransactionsTakePhoto')),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: Icon(Icons.photo_library_outlined),
              title: Text(trKey('mobileLegacyChooseFromGallery')),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    // 與網頁版一致：縮到最長邊 1600px、JPEG 品質 82，省上傳頻寬與 S3 空間。
    // image_picker 會在裝置端直接縮圖／重新編碼，免額外套件。
    if (source == ImageSource.camera) {
      final shot = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 82,
      );
      if (shot == null) return;
      setState(() => _photos.add(shot));
    } else {
      final picked = await _picker.pickMultiImage(
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 82,
        limit: remaining,
      );
      if (picked.isEmpty) return;
      setState(() => _photos.addAll(picked.take(remaining)));
    }
  }

  void _removePhoto(int index) {
    setState(() => _photos.removeAt(index));
  }

  /// 刪除已上傳到後端的照片（需確認）。
  Future<void> _removeExistingPhoto(Map<String, dynamic> photo) async {
    final id = '${photo['id'] ?? ''}';
    if (id.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(trKey('mobileLegacyDeletePhoto')),
        content: Text(
          trKey('mobileLegacyDeleteThisUploadedPhotoThisCannotBeUndone'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(trKey('commonDelete')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ApiClient.instance.deleteTransactionAttachment(
        widget.existing!.id,
        id,
      );
      if (mounted) {
        setState(() => _existingPhotos.removeWhere((p) => '${p['id']}' == id));
      }
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  /// 全螢幕檢視已上傳的照片，支援縮放。
  void _viewExistingPhoto(Map<String, dynamic> photo) {
    final api = ApiClient.instance;
    final url = api.attachmentFileUrl(widget.existing!.id, '${photo['id']}');
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          children: [
            InteractiveViewer(
              maxScale: 5,
              child: Center(
                child: Image.network(
                  url,
                  headers: api.mediaHeaders(),
                  fit: BoxFit.contain,
                  loadingBuilder: (c, child, progress) => progress == null
                      ? child
                      : Padding(
                          padding: EdgeInsets.all(48),
                          child: CircularProgressIndicator(),
                        ),
                  errorBuilder: (c, e, s) => Padding(
                    padding: EdgeInsets.all(48),
                    child: Text(
                      trKey('mobileLegacyFailedToLoadPhoto'),
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              right: 0,
              top: 0,
              child: IconButton(
                icon: Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.pop(ctx),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final amount = num.parse(_amount.text.trim());
    setState(() => _saving = true);
    try {
      final api = ApiClient.instance;
      if (_type == 'transfer') {
        await api.transfer({
          'fromAccountId': _accountId,
          'toAccountId': _toAccountId,
          'amount': amount,
          'date': _dateStr,
          'note': _note.text.trim(),
        });
      } else {
        final body = <String, dynamic>{
          'type': _type,
          'amount': amount,
          'currency': _currency,
          'date': _dateStr,
          'categoryId': _categoryId,
          'accountId': _accountId,
          'note': _note.text.trim(),
          'excludeFromStats': _excludeFromStats,
        };
        // 外幣交易：金額即原幣別金額；匯率留空則由後端套系統匯率。
        if (_currency != 'TWD') {
          body['originalAmount'] = amount;
          final rate = num.tryParse(_fxRate.text.trim());
          if (rate != null && rate > 0) body['fxRate'] = rate;
        }
        // 海外手續費：有手動填則送（覆寫），否則交由伺服器依卡片費率自動計算。
        final feeText = _fxFee.text.trim();
        if (_overseasApplies && feeText.isNotEmpty) {
          body['fxFee'] = num.tryParse(feeText) ?? 0;
        }
        if (_isEdit) {
          await api.updateTransaction(widget.existing!.id, body);
          if (_photos.isNotEmpty) {
            await api.uploadTransactionPhotos(
              widget.existing!.id,
              _photos.map((p) => p.path).toList(),
            );
          }
        } else {
          final created = await api.createTransaction(body);
          final id = '${created['id'] ?? ''}';
          if (_photos.isNotEmpty && id.isNotEmpty) {
            await api.uploadTransactionPhotos(
              id,
              _photos.map((p) => p.path).toList(),
            );
          }
        }
      }
      await _refreshDashboardWidgets();
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, '$e');
      }
    }
  }

  Future<void> _refreshDashboardWidgets() async {
    try {
      final now = DateTime.now();
      final ym =
          '${now.year}-${now.month.toString().padLeft(2, '0')}';
      final json = await ApiClient.instance.dashboard(ym);
      await AppWidgetSync.updateDashboard(Dashboard.fromJson(json));
      final rawBudgets = await ApiClient.instance.budgets(ym);
      final rawCategories = await ApiClient.instance.categories();
      final budgets = rawBudgets
          .map((e) => Budget.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      final categories = rawCategories
          .map((e) => Category.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      await AppWidgetSync.updateBudgetAlerts(
        yearMonth: ym,
        budgets: budgets,
        categoryNames: {
          for (final category in categories) category.id: category.name,
        },
      );
    } catch (_) {
      // 小工具同步失敗不應阻斷交易儲存。
    }
  }

  /// 刪除目前編輯中的交易（需確認）。國外刷卡手續費等連動交易由後端一併處理。
  Future<void> _confirmDelete() async {
    final e = widget.existing;
    if (e == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(trKey('mobileLegacyDeleteTransaction')),
        content: Text(
          trKey('mobileDynamicDeleteTransactionDate', {'date': e.date}),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(trKey('commonDelete')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _saving = true);
    try {
      await ApiClient.instance.deleteTransaction(e.id);
      if (mounted) Navigator.pop(context, true);
    } catch (err) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, '$err');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _isEdit
              ? trKey('featuresTransactionsEdit')
              : trKey('featuresTransactionsAdd'),
        ),
        actions: [
          if (_isEdit)
            IconButton(
              tooltip: trKey('mobileLegacyDeleteTransaction'),
              icon: Icon(Icons.delete_outline),
              onPressed: _saving ? null : _confirmDelete,
            ),
        ],
      ),
      body: FutureBuilder<void>(
        future: _loadFuture,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(
              child: Text(
                trKey('mobileDynamicFailedToLoad', {'value': snap.error}),
              ),
            );
          }
          return _buildForm(context);
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    final parents = _selectableParents;
    // 編輯既有交易時，由子分類回推其父分類，讓父分類下拉預選正確。
    if (_categoryId != null && _parentCatId == null) {
      final sel = _selectableCats.where((c) => c.id == _categoryId);
      if (sel.isNotEmpty && parents.any((p) => p.id == sel.first.parentId)) {
        _parentCatId = sel.first.parentId;
      }
    }
    // 已選父分類不在清單內（例如切換收支類型後）→ 清掉父子選擇。
    if (_parentCatId != null && !parents.any((p) => p.id == _parentCatId)) {
      _parentCatId = null;
      _categoryId = null;
    }
    final children = _parentCatId == null
        ? <Category>[]
        : _childCatsOf(_parentCatId!);
    // 已選子分類不在目前父分類底下 → 清掉。
    if (_categoryId != null && !children.any((c) => c.id == _categoryId)) {
      _categoryId = null;
    }
    return Form(
      key: _formKey,
      child: ListView(
        // 底部加上系統導覽列（edge-to-edge）高度，避免「儲存」鈕被手機功能鍵蓋住。
        padding: EdgeInsets.fromLTRB(
          16,
          16,
          16,
          16 + MediaQuery.of(context).padding.bottom,
        ),
        children: [
          if (!_isEdit)
            SegmentedButton<String>(
              segments: [
                ButtonSegment(
                  value: 'expense',
                  label: Text(trKey('dashboardOverviewExpense')),
                ),
                ButtonSegment(
                  value: 'income',
                  label: Text(trKey('dashboardOverviewIncome')),
                ),
                ButtonSegment(
                  value: 'transfer',
                  label: Text(trKey('featuresTransactionsTransfer')),
                ),
              ],
              selected: {_type},
              onSelectionChanged: (s) => setState(() {
                _type = s.first;
                _parentCatId = null;
                _categoryId = null;
              }),
            ),
          SizedBox(height: 16),
          TextFormField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: trKey('dashboardTableAmount'),
              prefixIcon: Icon(Icons.attach_money),
              border: OutlineInputBorder(),
            ),
            validator: (v) {
              final n = num.tryParse(v?.trim() ?? '');
              if (n == null || n <= 0) {
                return trKey('mobileLegacyEnterAnAmountGreaterThan0');
              }
              return null;
            },
          ),
          SizedBox(height: 16),
          ListTile(
            shape: RoundedRectangleBorder(
              side: BorderSide(color: Theme.of(context).dividerColor),
              borderRadius: BorderRadius.circular(4),
            ),
            leading: Icon(Icons.calendar_today),
            title: Text(trKey('dashboardTableDate')),
            trailing: Text(_dateStr),
            onTap: _pickDate,
          ),
          SizedBox(height: 16),
          if (_type == 'transfer') ...[
            _accountDropdown(
              label: trKey('mobileLegacyFromAccount'),
              value: _accountId,
              onChanged: (v) => setState(() => _accountId = v),
            ),
            SizedBox(height: 16),
            _accountDropdown(
              label: trKey('mobileLegacyToAccount'),
              value: _toAccountId,
              onChanged: (v) => setState(() => _toAccountId = v),
              validator: (v) {
                if (v == null) {
                  return trKey('mobileLegacySelectADestinationAccount');
                }
                if (v == _accountId) {
                  return trKey(
                    'mobileLegacyTheSourceAndDestinationAccountsMustDiffer',
                  );
                }
                return null;
              },
            ),
          ] else ...[
            // 先選父分類。
            DropdownButtonFormField<String>(
              initialValue: _parentCatId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: trKey('featuresCategoriesParentLabel'),
                prefixIcon: Icon(Icons.category_outlined),
                border: OutlineInputBorder(),
              ),
              items: [
                for (final p in parents)
                  DropdownMenuItem(value: p.id, child: Text(p.name)),
              ],
              onChanged: (v) => setState(() {
                _parentCatId = v;
                _categoryId = null; // 換父分類時清掉已選子分類
              }),
              validator: (v) =>
                  v == null ? trKey('mobileLegacySelectAParentCategory') : null,
            ),
            SizedBox(height: 16),
            // 再選該父分類底下的子分類（未選父分類前停用）。
            DropdownButtonFormField<String>(
              initialValue: _categoryId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: trKey('mobileLegacySubcategory'),
                prefixIcon: Icon(Icons.subdirectory_arrow_right),
                border: OutlineInputBorder(),
                hintText: _parentCatId == null
                    ? trKey('mobileLegacySelectAParentCategoryFirst')
                    : null,
              ),
              items: [
                for (final c in children)
                  DropdownMenuItem(value: c.id, child: Text(c.name)),
              ],
              onChanged: _parentCatId == null
                  ? null
                  : (v) => setState(() => _categoryId = v),
              validator: (v) =>
                  v == null ? trKey('mobileLegacySelectASubcategory') : null,
            ),
            SizedBox(height: 16),
            _accountDropdown(
              label: trKey('featuresCommonAccount'),
              value: _accountId,
              onChanged: (v) => setState(() {
                _accountId = v;
                // 換帳戶時幣別跟著帳戶走，並清掉手動匯率（與網頁版一致）。
                final a = _selectedAccount;
                if (a != null) {
                  _currency = a.currency;
                  _currencyInput?.text = _currency;
                  _fxRate.clear();
                }
              }),
            ),
            SizedBox(height: 16),
            Autocomplete<String>(
              initialValue: TextEditingValue(text: _currency),
              optionsBuilder: (value) {
                final query = value.text.trim().toUpperCase();
                if (query.isEmpty) return _currencyOptions;
                return _currencyOptions.where((c) => c.startsWith(query));
              },
              onSelected: (value) => setState(() {
                _currency = value;
                _fxRate.clear();
              }),
              fieldViewBuilder:
                  (context, controller, focusNode, onFieldSubmitted) {
                    _currencyInput = controller;
                    return TextFormField(
                      controller: controller,
                      focusNode: focusNode,
                      maxLength: 3,
                      textCapitalization: TextCapitalization.characters,
                      decoration: InputDecoration(
                        labelText: trKey('featuresCommonCurrency'),
                        prefixIcon: Icon(Icons.payments_outlined),
                        border: OutlineInputBorder(),
                        counterText: '',
                      ),
                      onChanged: (value) {
                        final normalized = value.trim().toUpperCase();
                        setState(() {
                          _currency = normalized;
                          _fxRate.clear();
                        });
                        if (value != normalized) {
                          controller.value = TextEditingValue(
                            text: normalized,
                            selection: TextSelection.collapsed(
                              offset: normalized.length,
                            ),
                          );
                        }
                      },
                      validator: (value) =>
                          RegExp(r'^[A-Z]{3}$').hasMatch(value?.trim() ?? '')
                          ? null
                          : trKey('featuresAccountsMessagesCurrencyInvalid'),
                    );
                  },
            ),
            if (_currency != 'TWD') ...[
              SizedBox(height: 16),
              TextFormField(
                controller: _fxRate,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: trKey('mobileDynamicExchangeRateForCurrency', {
                    'currency': _currency,
                  }),
                  helperText: trKey('featuresTransactionsFxRatePlaceholder'),
                  prefixIcon: Icon(Icons.currency_exchange),
                  border: OutlineInputBorder(),
                ),
                validator: (v) {
                  final s = v?.trim() ?? '';
                  if (s.isEmpty) return null;
                  final n = num.tryParse(s);
                  if (n == null || n <= 0) {
                    return trKey('mobileLegacyExchangeRateMustBeGreaterThan0');
                  }
                  return null;
                },
              ),
            ],
          ],
          SizedBox(height: 16),
          TextFormField(
            controller: _note,
            decoration: InputDecoration(
              labelText: trKey('mobileLegacyNoteOptional'),
              prefixIcon: Icon(Icons.notes),
              border: OutlineInputBorder(),
            ),
          ),
          if (_type != 'transfer') ...[
            if (_overseasApplies) ...[
              SizedBox(height: 16),
              TextFormField(
                controller: _fxFee,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: trKey(
                    'mobileLegacyForeignTransactionFeeInTwdOptional',
                  ),
                  helperText: trKey('mobileDynamicCardRateAutoFee', {
                    'rate': _selectedAccount!.overseasFeeRate,
                  }),
                  prefixIcon: Icon(Icons.currency_exchange),
                  border: OutlineInputBorder(),
                ),
              ),
            ],
            SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(trKey('featuresCommonExcludeFromStats')),
              value: _excludeFromStats,
              onChanged: (v) => setState(() => _excludeFromStats = v),
            ),
            if (_existingPhotos.isNotEmpty) ...[
              SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  trKey('mobileDynamicUploadedPhotosCount', {
                    'count': _existingPhotos.length,
                  }),
                  style: Theme.of(context).textTheme.labelLarge,
                ),
              ),
              SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final photo in _existingPhotos)
                    Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: InkWell(
                            onTap: () => _viewExistingPhoto(photo),
                            child: Image.network(
                              ApiClient.instance.attachmentFileUrl(
                                widget.existing!.id,
                                '${photo['id']}',
                              ),
                              headers: ApiClient.instance.mediaHeaders(),
                              width: 76,
                              height: 76,
                              fit: BoxFit.cover,
                              loadingBuilder: (c, child, progress) =>
                                  progress == null
                                  ? child
                                  : SizedBox(
                                      width: 76,
                                      height: 76,
                                      child: Center(
                                        child: SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        ),
                                      ),
                                    ),
                              errorBuilder: (c, e, s) => Container(
                                width: 76,
                                height: 76,
                                color: Theme.of(
                                  context,
                                ).colorScheme.surfaceContainerHighest,
                                child: Icon(Icons.broken_image_outlined),
                              ),
                            ),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          top: 0,
                          child: InkWell(
                            onTap: _saving
                                ? null
                                : () => _removeExistingPhoto(photo),
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.65),
                                shape: BoxShape.circle,
                              ),
                              padding: const EdgeInsets.all(3),
                              child: Icon(
                                Icons.close,
                                color: Colors.white,
                                size: 16,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
            SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _saving ? null : _pickPhotos,
              icon: Icon(Icons.photo_library_outlined),
              label: Text(
                _photos.isEmpty
                    ? trKey('mobileLegacyAddPhotosOptional')
                    : trKey('mobileDynamicAddPhotosCount', {
                        'count': _photos.length,
                      }),
              ),
            ),
            if (_photos.isNotEmpty) ...[
              SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var i = 0; i < _photos.length; i++)
                    Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(
                            File(_photos[i].path),
                            width: 76,
                            height: 76,
                            fit: BoxFit.cover,
                          ),
                        ),
                        Positioned(
                          right: 0,
                          top: 0,
                          child: InkWell(
                            onTap: _saving ? null : () => _removePhoto(i),
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.65),
                                shape: BoxShape.circle,
                              ),
                              padding: const EdgeInsets.all(3),
                              child: Icon(
                                Icons.close,
                                color: Colors.white,
                                size: 16,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ],
          SizedBox(height: 24),
          FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: _saving
                ? SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(trKey('commonSave')),
          ),
        ],
      ),
    );
  }

  Widget _accountDropdown({
    required String label,
    required String? value,
    required ValueChanged<String?> onChanged,
    String? Function(String?)? validator,
  }) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(Icons.account_balance_wallet_outlined),
        border: OutlineInputBorder(),
      ),
      items: [
        for (final a in _accounts)
          DropdownMenuItem(
            value: a.id,
            child: Text('${a.name}（${a.currency}）'),
          ),
      ],
      onChanged: onChanged,
      validator:
          validator ??
          (v) => v == null ? trKey('mobileLegacySelectAnAccount') : null,
    );
  }
}

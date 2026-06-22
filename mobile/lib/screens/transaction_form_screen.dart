import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api_client.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';

/// 幣別下拉的預設選項；實際清單會再併入使用者帳戶的幣別與目前交易幣別。
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
  const TransactionFormScreen({super.key, this.existing});

  @override
  State<TransactionFormScreen> createState() => _TransactionFormScreenState();
}

class _TransactionFormScreenState extends State<TransactionFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _note = TextEditingController();
  final _fxFee = TextEditingController();
  final _fxRate = TextEditingController();
  bool _excludeFromStats = false;
  // 交易幣別。預設跟隨所選帳戶，但可獨立改選（外幣消費／刷卡）。
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

  /// 幣別下拉選項：交易幣別 + TWD + 各帳戶幣別 + 常見幣別（去重、保序）。
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
      if (a != null) _currency = a.currency;
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
      toast(context, tr('單筆交易最多上傳 5 張照片'));
      return;
    }
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: Icon(Icons.camera_alt_outlined),
              title: Text(tr('拍照')),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: Icon(Icons.photo_library_outlined),
              title: Text(tr('從相簿選擇')),
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
        title: Text(tr('刪除照片')),
        content: Text(tr('確定要刪除這張已上傳的照片嗎？此動作無法復原。')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(tr('取消')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(tr('刪除')),
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
                      tr('照片載入失敗'),
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
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, '$e');
      }
    }
  }

  /// 刪除目前編輯中的交易（需確認）。國外刷卡手續費等連動交易由後端一併處理。
  Future<void> _confirmDelete() async {
    final e = widget.existing;
    if (e == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('刪除交易')),
        content: Text(
          trPair(
            '確定刪除這筆 ${e.date} 的交易？此動作無法復原。',
            'Delete the transaction from ${e.date}? This cannot be undone.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(tr('取消')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(tr('刪除')),
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
        title: Text(_isEdit ? tr('編輯交易') : tr('新增交易')),
        actions: [
          if (_isEdit)
            IconButton(
              tooltip: tr('刪除交易'),
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
                trPair('載入失敗：${snap.error}', 'Failed to load: ${snap.error}'),
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
                ButtonSegment(value: 'expense', label: Text(tr('支出'))),
                ButtonSegment(value: 'income', label: Text(tr('收入'))),
                ButtonSegment(value: 'transfer', label: Text(tr('轉帳'))),
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
              labelText: tr('金額'),
              prefixIcon: Icon(Icons.attach_money),
              border: OutlineInputBorder(),
            ),
            validator: (v) {
              final n = num.tryParse(v?.trim() ?? '');
              if (n == null || n <= 0) return tr('請輸入大於 0 的金額');
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
            title: Text(tr('日期')),
            trailing: Text(_dateStr),
            onTap: _pickDate,
          ),
          SizedBox(height: 16),
          if (_type == 'transfer') ...[
            _accountDropdown(
              label: tr('轉出帳戶'),
              value: _accountId,
              onChanged: (v) => setState(() => _accountId = v),
            ),
            SizedBox(height: 16),
            _accountDropdown(
              label: tr('轉入帳戶'),
              value: _toAccountId,
              onChanged: (v) => setState(() => _toAccountId = v),
              validator: (v) {
                if (v == null) return tr('請選擇轉入帳戶');
                if (v == _accountId) return tr('轉出與轉入不可相同');
                return null;
              },
            ),
          ] else ...[
            // 先選父分類。
            DropdownButtonFormField<String>(
              initialValue: _parentCatId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: tr('父分類'),
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
              validator: (v) => v == null ? tr('請選擇父分類') : null,
            ),
            SizedBox(height: 16),
            // 再選該父分類底下的子分類（未選父分類前停用）。
            DropdownButtonFormField<String>(
              initialValue: _categoryId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: tr('子分類'),
                prefixIcon: Icon(Icons.subdirectory_arrow_right),
                border: OutlineInputBorder(),
                hintText: _parentCatId == null ? tr('請先選擇父分類') : null,
              ),
              items: [
                for (final c in children)
                  DropdownMenuItem(value: c.id, child: Text(c.name)),
              ],
              onChanged: _parentCatId == null
                  ? null
                  : (v) => setState(() => _categoryId = v),
              validator: (v) => v == null ? tr('請選擇子分類') : null,
            ),
            SizedBox(height: 16),
            _accountDropdown(
              label: tr('帳戶'),
              value: _accountId,
              onChanged: (v) => setState(() {
                _accountId = v;
                // 換帳戶時幣別跟著帳戶走，並清掉手動匯率（與網頁版一致）。
                final a = _selectedAccount;
                if (a != null) {
                  _currency = a.currency;
                  _fxRate.clear();
                }
              }),
            ),
            SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _currency,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: tr('幣別'),
                prefixIcon: Icon(Icons.payments_outlined),
                border: OutlineInputBorder(),
              ),
              items: [
                for (final c in _currencyOptions)
                  DropdownMenuItem(value: c, child: Text(c)),
              ],
              onChanged: (v) => setState(() {
                _currency = v ?? 'TWD';
                _fxRate.clear();
              }),
            ),
            if (_currency != 'TWD') ...[
              SizedBox(height: 16),
              TextFormField(
                controller: _fxRate,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: trPair(
                    '匯率（1 $_currency = ? TWD）',
                    'Exchange rate (1 $_currency = ? TWD)',
                  ),
                  helperText: tr('留空則使用系統匯率'),
                  prefixIcon: Icon(Icons.currency_exchange),
                  border: OutlineInputBorder(),
                ),
                validator: (v) {
                  final s = v?.trim() ?? '';
                  if (s.isEmpty) return null;
                  final n = num.tryParse(s);
                  if (n == null || n <= 0) return tr('匯率須大於 0');
                  return null;
                },
              ),
            ],
          ],
          SizedBox(height: 16),
          TextFormField(
            controller: _note,
            decoration: InputDecoration(
              labelText: tr('備註（選填）'),
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
                  labelText: tr('海外手續費 TWD（選填）'),
                  helperText: trPair(
                    '此卡費率 ${_selectedAccount!.overseasFeeRate}%，留空將自動計算',
                    'Card rate: ${_selectedAccount!.overseasFeeRate}%. Leave blank to calculate automatically.',
                  ),
                  prefixIcon: Icon(Icons.currency_exchange),
                  border: OutlineInputBorder(),
                ),
              ),
            ],
            SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(tr('不計入統計')),
              value: _excludeFromStats,
              onChanged: (v) => setState(() => _excludeFromStats = v),
            ),
            if (_existingPhotos.isNotEmpty) ...[
              SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  trPair(
                    '已上傳照片（${_existingPhotos.length}）',
                    'Uploaded photos (${_existingPhotos.length})',
                  ),
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
                    ? tr('新增照片（選填）')
                    : trPair(
                        '新增照片（${_photos.length}/5）',
                        'Add photos (${_photos.length}/5)',
                      ),
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
                : Text(tr('儲存')),
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
      validator: validator ?? (v) => v == null ? tr('請選擇帳戶') : null,
    );
  }
}

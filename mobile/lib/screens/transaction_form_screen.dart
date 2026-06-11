import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api_client.dart';
import '../models.dart';
import '../widgets.dart';

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

  late Future<void> _loadFuture;
  List<Account> _accounts = [];
  List<Category> _categories = [];

  String _type = 'expense'; // expense / income / transfer
  DateTime _date = DateTime.now();
  String? _categoryId;
  String? _accountId;
  String? _toAccountId;
  bool _saving = false;
  final _picker = ImagePicker();
  final List<XFile> _photos = [];

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _type = e.type == 'transfer' ? 'expense' : e.type;
      _amount.text = e.amount.toString();
      _note.text = e.note;
      _categoryId = e.categoryId.isEmpty ? null : e.categoryId;
      _accountId = e.accountId.isEmpty ? null : e.accountId;
      _date = DateTime.tryParse(e.date) ?? DateTime.now();
    }
    _loadFuture = _loadRefs();
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

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
  }

  /// 僅顯示符合目前收支類型的子分類（交易必須掛在子分類）。
  List<Category> get _selectableCats =>
      _categories.where((c) => c.type == _type && !c.isParent).toList();

  String _parentName(Category c) {
    final p = _categories.where((x) => x.id == c.parentId);
    return p.isEmpty ? c.name : '${p.first.name} › ${c.name}';
  }

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
      toast(context, '單筆交易最多上傳 5 張照片');
      return;
    }
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('拍照'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('從相簿選擇'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    if (source == ImageSource.camera) {
      final shot = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 82,
      );
      if (shot == null) return;
      setState(() => _photos.add(shot));
    } else {
      final picked = await _picker.pickMultiImage(
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
        final acc = _accounts.firstWhere((a) => a.id == _accountId);
        final body = {
          'type': _type,
          'amount': amount,
          'currency': acc.currency,
          'date': _dateStr,
          'categoryId': _categoryId,
          'accountId': _accountId,
          'note': _note.text.trim(),
        };
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? '編輯交易' : '新增交易')),
      body: FutureBuilder<void>(
        future: _loadFuture,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text('載入失敗：${snap.error}'));
          }
          return _buildForm(context);
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    final cats = _selectableCats;
    // 確保已選分類仍在清單內。
    if (_categoryId != null && !cats.any((c) => c.id == _categoryId)) {
      _categoryId = null;
    }
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (!_isEdit)
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'expense', label: Text('支出')),
                ButtonSegment(value: 'income', label: Text('收入')),
                ButtonSegment(value: 'transfer', label: Text('轉帳')),
              ],
              selected: {_type},
              onSelectionChanged: (s) => setState(() {
                _type = s.first;
                _categoryId = null;
              }),
            ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: '金額',
              prefixIcon: Icon(Icons.attach_money),
              border: OutlineInputBorder(),
            ),
            validator: (v) {
              final n = num.tryParse(v?.trim() ?? '');
              if (n == null || n <= 0) return '請輸入大於 0 的金額';
              return null;
            },
          ),
          const SizedBox(height: 16),
          ListTile(
            shape: RoundedRectangleBorder(
              side: BorderSide(color: Theme.of(context).dividerColor),
              borderRadius: BorderRadius.circular(4),
            ),
            leading: const Icon(Icons.calendar_today),
            title: const Text('日期'),
            trailing: Text(_dateStr),
            onTap: _pickDate,
          ),
          const SizedBox(height: 16),
          if (_type == 'transfer') ...[
            _accountDropdown(
              label: '轉出帳戶',
              value: _accountId,
              onChanged: (v) => setState(() => _accountId = v),
            ),
            const SizedBox(height: 16),
            _accountDropdown(
              label: '轉入帳戶',
              value: _toAccountId,
              onChanged: (v) => setState(() => _toAccountId = v),
              validator: (v) {
                if (v == null) return '請選擇轉入帳戶';
                if (v == _accountId) return '轉出與轉入不可相同';
                return null;
              },
            ),
          ] else ...[
            DropdownButtonFormField<String>(
              initialValue: _categoryId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: '分類',
                prefixIcon: Icon(Icons.category_outlined),
                border: OutlineInputBorder(),
              ),
              items: [
                for (final c in cats)
                  DropdownMenuItem(value: c.id, child: Text(_parentName(c))),
              ],
              onChanged: (v) => setState(() => _categoryId = v),
              validator: (v) => v == null ? '請選擇分類' : null,
            ),
            const SizedBox(height: 16),
            _accountDropdown(
              label: '帳戶',
              value: _accountId,
              onChanged: (v) => setState(() => _accountId = v),
            ),
          ],
          const SizedBox(height: 16),
          TextFormField(
            controller: _note,
            decoration: const InputDecoration(
              labelText: '備註（選填）',
              prefixIcon: Icon(Icons.notes),
              border: OutlineInputBorder(),
            ),
          ),
          if (_type != 'transfer') ...[
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _saving ? null : _pickPhotos,
              icon: const Icon(Icons.photo_library_outlined),
              label: Text(
                _photos.isEmpty ? '新增照片（選填）' : '新增照片（${_photos.length}/5）',
              ),
            ),
            if (_photos.isNotEmpty) ...[
              const SizedBox(height: 12),
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
                              child: const Icon(
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
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: _saving
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('儲存'),
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
        prefixIcon: const Icon(Icons.account_balance_wallet_outlined),
        border: const OutlineInputBorder(),
      ),
      items: [
        for (final a in _accounts)
          DropdownMenuItem(
            value: a.id,
            child: Text('${a.name}（${a.currency}）'),
          ),
      ],
      onChanged: onChanged,
      validator: validator ?? (v) => v == null ? '請選擇帳戶' : null,
    );
  }
}

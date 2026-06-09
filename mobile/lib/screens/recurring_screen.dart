import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';

const _freqLabels = {
  'daily': '每日',
  'weekly': '每週',
  'monthly': '每月',
  'yearly': '每年',
};

class _RecurringData {
  final List<Recurring> items;
  final Map<String, String> catName;
  final Map<String, String> accName;
  final List<Category> categories;
  final List<Account> accounts;
  _RecurringData(
      this.items, this.catName, this.accName, this.categories, this.accounts);
}

class RecurringScreen extends StatefulWidget {
  const RecurringScreen({super.key});

  @override
  State<RecurringScreen> createState() => _RecurringScreenState();
}

class _RecurringScreenState extends State<RecurringScreen> {
  late Future<_RecurringData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_RecurringData> _load() async {
    final api = ApiClient.instance;
    final raw = await api.recurring();
    final catsRaw = await api.categories();
    final accsRaw = await api.accounts();
    final items = raw
        .map((e) => Recurring.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    final categories = catsRaw
        .map((e) => Category.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    final accounts = accsRaw
        .map((e) => Account.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    return _RecurringData(
      items,
      {for (final c in categories) c.id: c.name},
      {for (final a in accounts) a.id: a.name},
      categories,
      accounts,
    );
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _add(_RecurringData data) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _RecurringForm(
          categories: data.categories, accounts: data.accounts),
    );
    if (changed == true) _reload();
  }

  Future<void> _toggle(Recurring r) async {
    try {
      await ApiClient.instance.toggleRecurring(r.id);
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  Future<void> _delete(Recurring r) async {
    try {
      await ApiClient.instance.deleteRecurring(r.id);
      if (mounted) toast(context, '已刪除');
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('固定收支')),
      floatingActionButton: FutureBuilder<_RecurringData>(
        future: _future,
        builder: (context, snap) => FloatingActionButton.extended(
          onPressed: snap.hasData ? () => _add(snap.data!) : null,
          icon: const Icon(Icons.add),
          label: const Text('新增'),
        ),
      ),
      body: AsyncView<_RecurringData>(
        future: _future,
        onRetry: _reload,
        builder: (context, data) {
          if (data.items.isEmpty) {
            return const EmptyState(
                icon: Icons.repeat, message: '尚無固定收支');
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.only(bottom: 88),
              itemCount: data.items.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final r = data.items[i];
                final isIncome = r.type == 'income';
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor:
                        (isIncome ? Colors.green : Colors.red)
                            .withValues(alpha: 0.15),
                    child: Icon(isIncome ? Icons.south_west : Icons.north_east,
                        color: isIncome ? Colors.green : Colors.red,
                        size: 20),
                  ),
                  title: Text(data.catName[r.categoryId] ??
                      (r.note.isEmpty ? '未分類' : r.note)),
                  subtitle: Text(
                      '${_freqLabels[r.frequency] ?? r.frequency}・'
                      '${data.accName[r.accountId] ?? ''}・自 ${r.startDate}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text((isIncome ? '+' : '-') + money(r.amount, r.currency),
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: isIncome ? Colors.green : Colors.red)),
                      Switch(
                          value: r.isActive,
                          onChanged: (_) => _toggle(r)),
                    ],
                  ),
                  onLongPress: () => _delete(r),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _RecurringForm extends StatefulWidget {
  final List<Category> categories;
  final List<Account> accounts;
  const _RecurringForm({required this.categories, required this.accounts});

  @override
  State<_RecurringForm> createState() => _RecurringFormState();
}

class _RecurringFormState extends State<_RecurringForm> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _note = TextEditingController();
  String _type = 'expense';
  String _frequency = 'monthly';
  String? _categoryId;
  String? _accountId;
  DateTime _start = DateTime.now();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _accountId =
        widget.accounts.isNotEmpty ? widget.accounts.first.id : null;
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  List<Category> get _cats =>
      widget.categories.where((c) => c.type == _type && !c.isParent).toList();

  String get _startStr =>
      '${_start.year}-${_start.month.toString().padLeft(2, '0')}-${_start.day.toString().padLeft(2, '0')}';

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final acc = widget.accounts.firstWhere((a) => a.id == _accountId);
    setState(() => _saving = true);
    try {
      await ApiClient.instance.createRecurring({
        'type': _type,
        'amount': num.parse(_amount.text.trim()),
        'currency': acc.currency,
        'categoryId': _categoryId,
        'accountId': _accountId,
        'frequency': _frequency,
        'startDate': _startStr,
        'note': _note.text.trim(),
      });
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
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final cats = _cats;
    if (_categoryId != null && !cats.any((c) => c.id == _categoryId)) {
      _categoryId = null;
    }
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('新增固定收支',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'expense', label: Text('支出')),
                ButtonSegment(value: 'income', label: Text('收入')),
              ],
              selected: {_type},
              onSelectionChanged: (s) => setState(() {
                _type = s.first;
                _categoryId = null;
              }),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: '金額', border: OutlineInputBorder()),
              validator: (v) {
                final n = num.tryParse(v?.trim() ?? '');
                if (n == null || n <= 0) return '請輸入大於 0 的金額';
                return null;
              },
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _frequency,
              decoration: const InputDecoration(
                  labelText: '週期', border: OutlineInputBorder()),
              items: [
                for (final e in _freqLabels.entries)
                  DropdownMenuItem(value: e.key, child: Text(e.value)),
              ],
              onChanged: (v) => setState(() => _frequency = v!),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _categoryId,
              isExpanded: true,
              decoration: const InputDecoration(
                  labelText: '分類', border: OutlineInputBorder()),
              items: [
                for (final c in cats)
                  DropdownMenuItem(value: c.id, child: Text(c.name)),
              ],
              onChanged: (v) => setState(() => _categoryId = v),
              validator: (v) => v == null ? '請選擇分類' : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _accountId,
              isExpanded: true,
              decoration: const InputDecoration(
                  labelText: '帳戶', border: OutlineInputBorder()),
              items: [
                for (final a in widget.accounts)
                  DropdownMenuItem(value: a.id, child: Text(a.name)),
              ],
              onChanged: (v) => setState(() => _accountId = v),
              validator: (v) => v == null ? '請選擇帳戶' : null,
            ),
            const SizedBox(height: 12),
            ListTile(
              shape: RoundedRectangleBorder(
                  side: BorderSide(color: Theme.of(context).dividerColor),
                  borderRadius: BorderRadius.circular(4)),
              leading: const Icon(Icons.calendar_today),
              title: const Text('起始日期'),
              trailing: Text(_startStr),
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: _start,
                  firstDate: DateTime(2000),
                  lastDate: DateTime(2100),
                );
                if (d != null) setState(() => _start = d);
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _note,
              decoration: const InputDecoration(
                  labelText: '備註（選填）', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14)),
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('儲存'),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';

const _accountCategories = {
  'bank': '銀行',
  'credit_card': '信用卡',
  'cash': '現金',
  'virtual_wallet': '電子錢包',
};

const _currencies = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'GBP', 'AUD'];

class AccountsScreen extends StatefulWidget {
  const AccountsScreen({super.key});

  @override
  State<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends State<AccountsScreen> {
  late Future<List<Account>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Account>> _load() async {
    final list = await ApiClient.instance.accounts();
    return list
        .map((e) => Account.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _openForm([Account? account]) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AccountForm(existing: account),
    );
    if (changed == true) _reload();
  }

  Future<void> _delete(Account a) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('刪除帳戶'),
        content: Text('確定刪除「${a.name}」？相關交易可能一併受影響。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('刪除'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.deleteAccount(a.id);
      if (mounted) toast(context, '已刪除');
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('帳戶')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add),
        label: const Text('新增帳戶'),
      ),
      body: AsyncView<List<Account>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) {
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.account_balance_wallet,
              message: '尚無帳戶',
            );
          }
          final total = list
              .where((a) => !a.excludeFromTotal)
              .fold<num>(0, (s, a) => s + a.twdAccumulated);
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.only(bottom: 88),
              children: [
                Card(
                  elevation: 0,
                  margin: const EdgeInsets.all(16),
                  color: Theme.of(context).colorScheme.primaryContainer,
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '總資產（換算 TWD）',
                          style: TextStyle(
                            color: Theme.of(
                              context,
                            ).colorScheme.onPrimaryContainer,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          twd(total),
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(
                              context,
                            ).colorScheme.onPrimaryContainer,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                for (final a in list)
                  ListTile(
                    leading: CircleAvatar(child: Icon(_iconFor(a.category))),
                    title: Text(a.name),
                    subtitle: Text(
                      '${_accountCategories[a.category] ?? a.category}'
                      '${a.excludeFromTotal ? '・不計入總資產' : ''}',
                    ),
                    trailing: Text(
                      money(a.balance, a.currency),
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: a.balance < 0 ? Colors.red : null,
                      ),
                    ),
                    onTap: () => _openForm(a),
                    onLongPress: () => _delete(a),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  IconData _iconFor(String category) {
    switch (category) {
      case 'credit_card':
        return Icons.credit_card;
      case 'cash':
        return Icons.payments_outlined;
      case 'virtual_wallet':
        return Icons.account_balance_wallet_outlined;
      default:
        return Icons.account_balance_outlined;
    }
  }
}

class _AccountForm extends StatefulWidget {
  final Account? existing;
  const _AccountForm({this.existing});

  @override
  State<_AccountForm> createState() => _AccountFormState();
}

class _AccountFormState extends State<_AccountForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late final _initial = TextEditingController(
    text: widget.existing?.initialBalance.toString() ?? '0',
  );
  late final _overseasFeeRate = TextEditingController(
    text: (widget.existing?.overseasFeeRate ?? 0) > 0
        ? widget.existing!.overseasFeeRate.toString()
        : '',
  );
  late String _category = widget.existing?.category.isNotEmpty == true
      ? widget.existing!.category
      : 'bank';
  late String _currency = widget.existing?.currency ?? 'TWD';
  late bool _exclude = widget.existing?.excludeFromTotal ?? false;
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void dispose() {
    _name.dispose();
    _initial.dispose();
    _overseasFeeRate.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final body = <String, dynamic>{
      'name': _name.text.trim(),
      'category': _category,
      'currency': _currency,
      'initialBalance': num.tryParse(_initial.text.trim()) ?? 0,
      'excludeFromTotal': _exclude,
    };
    if (_category == 'credit_card') {
      final raw = _overseasFeeRate.text.trim();
      body['overseasFeeRate'] = raw.isEmpty ? null : (num.tryParse(raw) ?? 0);
    }
    try {
      final api = ApiClient.instance;
      if (_isEdit) {
        await api.updateAccount(widget.existing!.id, body);
      } else {
        await api.createAccount(body);
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
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              _isEdit ? '編輯帳戶' : '新增帳戶',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(
                labelText: '帳戶名稱',
                border: OutlineInputBorder(),
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? '請輸入名稱' : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: const InputDecoration(
                labelText: '類型',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final e in _accountCategories.entries)
                  DropdownMenuItem(value: e.key, child: Text(e.value)),
              ],
              onChanged: (v) => setState(() => _category = v!),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _currency,
                    decoration: const InputDecoration(
                      labelText: '幣別',
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      for (final c in _currencies)
                        DropdownMenuItem(value: c, child: Text(c)),
                    ],
                    onChanged: (v) => setState(() => _currency = v!),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _initial,
                    enabled: !_isEdit,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: '初始餘額',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            if (_category == 'credit_card') ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _overseasFeeRate,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: '海外手續費率（%）',
                  helperText: '例：1.5 代表 1.5%，外幣刷卡時自動計算手續費',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('不計入總資產'),
              value: _exclude,
              onChanged: (v) => setState(() => _exclude = v),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
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
      ),
    );
  }
}

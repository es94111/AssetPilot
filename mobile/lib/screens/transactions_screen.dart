import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';
import 'transaction_form_screen.dart';

class TransactionsScreen extends StatefulWidget {
  const TransactionsScreen({super.key});

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsData {
  final List<Txn> items;
  final Map<String, String> catName;
  const _TransactionsData(this.items, this.catName);
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  late Future<_TransactionsData> _future;
  String _filter = 'all'; // all / income / expense

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_TransactionsData> _load() async {
    final api = ApiClient.instance;
    final list = await api.transactions(type: _filter);
    final catsRaw = await api.categories();
    final items = list
        .map((e) => Txn.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    final categories = catsRaw
        .map((e) => Category.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    final parentNames = {
      for (final c in categories.where((c) => c.isParent)) c.id: c.name,
    };
    final catName = {
      for (final c in categories)
        c.id: c.parentId.isNotEmpty && parentNames[c.parentId] != null
            ? '${parentNames[c.parentId]} › ${c.name}'
            : c.name,
    };
    return _TransactionsData(items, catName);
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _openForm([Txn? txn]) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TransactionFormScreen(existing: txn)),
    );
    if (changed == true) _reload();
  }

  Future<void> _delete(Txn t) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('刪除交易'),
        content: Text('確定刪除這筆${t.date}的交易？'),
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
      await ApiClient.instance.deleteTransaction(t.id);
      if (mounted) toast(context, '已刪除');
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('記帳'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'all', label: Text('全部')),
                ButtonSegment(value: 'income', label: Text('收入')),
                ButtonSegment(value: 'expense', label: Text('支出')),
              ],
              selected: {_filter},
              onSelectionChanged: (s) {
                setState(() => _filter = s.first);
                _reload();
              },
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add),
        label: const Text('記一筆'),
      ),
      body: AsyncView<_TransactionsData>(
        future: _future,
        onRetry: _reload,
        builder: (context, data) {
          final list = data.items;
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.receipt_long,
              message: '尚無交易，點右下角記一筆',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.only(bottom: 88),
              itemCount: list.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final t = list[i];
                return _TxnTile(
                  t: t,
                  categoryName: data.catName[t.categoryId],
                  onTap: () => t.type == 'transfer'
                      ? toast(context, '轉帳請於網頁版編輯')
                      : _openForm(t),
                  onLongPress: () => _delete(t),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _TxnTile extends StatelessWidget {
  final Txn t;
  final String? categoryName;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  const _TxnTile({
    required this.t,
    required this.categoryName,
    required this.onTap,
    required this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    final isIncome = t.type == 'income';
    final isTransfer = t.type == 'transfer';
    final color = isTransfer
        ? Colors.blueGrey
        : (isIncome ? Colors.green : Colors.red);
    final icon = isTransfer
        ? Icons.swap_horiz
        : (isIncome ? Icons.south_west : Icons.north_east);
    final sign = isTransfer ? '' : (isIncome ? '+' : '-');
    return ListTile(
      onTap: onTap,
      onLongPress: onLongPress,
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: 0.15),
        child: Icon(icon, color: color, size: 20),
      ),
      title: Text(
        categoryName?.isNotEmpty == true
            ? categoryName!
            : t.catName?.isNotEmpty == true
            ? t.catName!
            : (isTransfer ? '轉帳' : (t.note.isEmpty ? '未分類' : t.note)),
      ),
      subtitle: Text(
        [
          t.date,
          if (t.note.isNotEmpty &&
              (categoryName?.isNotEmpty == true ||
                  t.catName?.isNotEmpty == true))
            t.note,
        ].join('　'),
      ),
      trailing: Text(
        sign + money(t.amount, t.currency),
        style: TextStyle(fontWeight: FontWeight.bold, color: color),
      ),
    );
  }
}

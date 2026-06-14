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
  final List<Account> accounts;
  final List<Category> categories; // 僅子分類，供篩選下拉
  const _TransactionsData(
    this.items,
    this.catName,
    this.accounts,
    this.categories,
  );
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  late Future<_TransactionsData> _future;
  String _filter = 'all'; // all / income / expense
  // 進階篩選
  DateTime? _dateFrom;
  DateTime? _dateTo;
  String? _filterAccountId;
  String? _filterCategoryId;
  String _keyword = '';

  bool get _hasAdvancedFilter =>
      _dateFrom != null ||
      _dateTo != null ||
      _filterAccountId != null ||
      _filterCategoryId != null ||
      _keyword.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  static String _ymd(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<_TransactionsData> _load() async {
    final api = ApiClient.instance;
    final list = await api.transactions(
      type: _filter,
      dateFrom: _dateFrom != null ? _ymd(_dateFrom!) : null,
      dateTo: _dateTo != null ? _ymd(_dateTo!) : null,
      accountId: _filterAccountId,
      categoryId: _filterCategoryId,
      keyword: _keyword,
    );
    final catsRaw = await api.categories();
    final accsRaw = await api.accounts();
    final items = list
        .map((e) => Txn.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    final categories = catsRaw
        .map((e) => Category.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    final accounts = accsRaw
        .map((e) => Account.fromJson((e as Map).cast<String, dynamic>()))
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
    final childCats = categories.where((c) => !c.isParent).toList();
    return _TransactionsData(items, catName, accounts, childCats);
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _openFilters(_TransactionsData data) async {
    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _TxnFilterSheet(
        accounts: data.accounts,
        categories: data.categories,
        catName: data.catName,
        dateFrom: _dateFrom,
        dateTo: _dateTo,
        accountId: _filterAccountId,
        categoryId: _filterCategoryId,
        keyword: _keyword,
        onApply: (from, to, accountId, categoryId, keyword) {
          setState(() {
            _dateFrom = from;
            _dateTo = to;
            _filterAccountId = accountId;
            _filterCategoryId = categoryId;
            _keyword = keyword;
          });
        },
      ),
    );
    if (applied == true) _reload();
  }

  void _clearFilters() {
    setState(() {
      _dateFrom = null;
      _dateTo = null;
      _filterAccountId = null;
      _filterCategoryId = null;
      _keyword = '';
    });
    _reload();
  }

  Future<void> _openForm([Txn? txn]) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TransactionFormScreen(existing: txn)),
    );
    if (changed == true) _reload();
  }

  /// 刪除一筆交易（需確認）。回傳是否真的刪除成功，供滑動刪除判斷是否移除列項。
  Future<bool> _delete(Txn t) async {
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
    if (ok != true) return false;
    try {
      await ApiClient.instance.deleteTransaction(t.id);
      if (mounted) toast(context, '已刪除');
      _reload();
      return true;
    } catch (e) {
      if (mounted) toast(context, '$e');
      return false;
    }
  }

  // AsyncView 載入後暫存資料，供 AppBar 篩選按鈕取用帳戶/分類清單。
  _TransactionsData? _lastData;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('記帳'),
        actions: [
          if (_hasAdvancedFilter)
            IconButton(
              tooltip: '清除篩選',
              icon: const Icon(Icons.filter_alt_off),
              onPressed: _clearFilters,
            ),
          IconButton(
            tooltip: '篩選',
            icon: Icon(
              _hasAdvancedFilter ? Icons.filter_alt : Icons.filter_alt_outlined,
            ),
            onPressed: _lastData == null
                ? null
                : () => _openFilters(_lastData!),
          ),
        ],
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
          _lastData = data;
          final list = data.items;
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.receipt_long,
              message: _hasAdvancedFilter ? '找不到符合篩選的交易' : '尚無交易，點右下角記一筆',
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
                return Dismissible(
                  key: ValueKey(t.id),
                  direction: DismissDirection.endToStart,
                  // 由 confirmDismiss 跳出確認並執行刪除；回傳 false 時列項不會被移除。
                  confirmDismiss: (_) => _delete(t),
                  background: Container(
                    color: Colors.red,
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: const Icon(Icons.delete, color: Colors.white),
                  ),
                  child: _TxnTile(
                    t: t,
                    categoryName: data.catName[t.categoryId],
                    onTap: () => t.type == 'transfer'
                        ? toast(context, '轉帳請於網頁版編輯')
                        : t.isFxFee
                        ? toast(context, '國外刷卡手續費由原交易自動產生，請編輯對應的國外交易')
                        : _openForm(t),
                    onLongPress: () => _delete(t),
                  ),
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
      subtitle: Row(
        children: [
          Expanded(
            child: Text(
              [
                t.date,
                if (t.note.isNotEmpty &&
                    (categoryName?.isNotEmpty == true ||
                        t.catName?.isNotEmpty == true))
                  t.note,
              ].join('　'),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (t.attachmentCount > 0) ...[
            const SizedBox(width: 6),
            Icon(
              Icons.image_outlined,
              size: 14,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 2),
            Text(
              '${t.attachmentCount}',
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ],
        ],
      ),
      trailing: Text(
        // 外幣交易顯示原幣別金額（如 USD 100），TWD 交易維持台幣金額。
        sign + money(t.originalAmount, t.currency),
        style: TextStyle(fontWeight: FontWeight.bold, color: color),
      ),
    );
  }
}

/// 交易進階篩選：日期區間、帳戶、分類、關鍵字。
class _TxnFilterSheet extends StatefulWidget {
  final List<Account> accounts;
  final List<Category> categories; // 子分類
  final Map<String, String> catName;
  final DateTime? dateFrom;
  final DateTime? dateTo;
  final String? accountId;
  final String? categoryId;
  final String keyword;
  final void Function(
    DateTime? from,
    DateTime? to,
    String? accountId,
    String? categoryId,
    String keyword,
  )
  onApply;

  const _TxnFilterSheet({
    required this.accounts,
    required this.categories,
    required this.catName,
    required this.dateFrom,
    required this.dateTo,
    required this.accountId,
    required this.categoryId,
    required this.keyword,
    required this.onApply,
  });

  @override
  State<_TxnFilterSheet> createState() => _TxnFilterSheetState();
}

class _TxnFilterSheetState extends State<_TxnFilterSheet> {
  late DateTime? _from = widget.dateFrom;
  late DateTime? _to = widget.dateTo;
  late String? _accountId = widget.accountId;
  late String? _categoryId = widget.categoryId;
  late final _keyword = TextEditingController(text: widget.keyword);

  @override
  void dispose() {
    _keyword.dispose();
    super.dispose();
  }

  static String _ymd(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _pick(bool isFrom) async {
    final d = await showDatePicker(
      context: context,
      initialDate: (isFrom ? _from : _to) ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (d != null) setState(() => isFrom ? _from = d : _to = d);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    // 下拉值需存在於選項中，否則重設為 null（全部）。
    final accountId =
        widget.accounts.any((a) => a.id == _accountId) ? _accountId : null;
    final categoryId =
        widget.categories.any((c) => c.id == _categoryId) ? _categoryId : null;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('篩選交易', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.calendar_today, size: 18),
                    label: Text(_from == null ? '起始日' : _ymd(_from!)),
                    onPressed: () => _pick(true),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.event, size: 18),
                    label: Text(_to == null ? '結束日' : _ymd(_to!)),
                    onPressed: () => _pick(false),
                  ),
                ),
                if (_from != null || _to != null)
                  IconButton(
                    icon: const Icon(Icons.clear),
                    tooltip: '清除日期',
                    onPressed: () => setState(() {
                      _from = null;
                      _to = null;
                    }),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: accountId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: '帳戶',
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem(value: null, child: Text('全部帳戶')),
                for (final a in widget.accounts)
                  DropdownMenuItem(value: a.id, child: Text(a.name)),
              ],
              onChanged: (v) => setState(() => _accountId = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: categoryId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: '分類',
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem(value: null, child: Text('全部分類')),
                for (final c in widget.categories)
                  DropdownMenuItem(
                    value: c.id,
                    child: Text(widget.catName[c.id] ?? c.name),
                  ),
              ],
              onChanged: (v) => setState(() => _categoryId = v),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _keyword,
              decoration: const InputDecoration(
                labelText: '備註關鍵字',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () {
                widget.onApply(
                  _from,
                  _to,
                  _accountId,
                  _categoryId,
                  _keyword.text,
                );
                Navigator.pop(context, true);
              },
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text('套用'),
            ),
          ],
        ),
      ),
    );
  }
}

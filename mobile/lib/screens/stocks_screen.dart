import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';

class StocksScreen extends StatefulWidget {
  const StocksScreen({super.key});

  @override
  State<StocksScreen> createState() => _StocksScreenState();
}

class _StocksScreenState extends State<StocksScreen>
    with SingleTickerProviderStateMixin {
  final _key = GlobalKey<_HoldingsTabState>();
  final _divKey = GlobalKey<_DividendTabState>();
  late final TabController _tab;
  bool _updating = false;
  bool _syncingDividends = false;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 4, vsync: this);
    // 「更新股價」「同步股利」動作各自只在對應分頁顯示，切換分頁時重建 AppBar。
    _tab.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _updatePrices() async {
    if (_updating) return;
    setState(() => _updating = true);
    try {
      await _key.currentState?.updatePrices();
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _syncDividends() async {
    if (_syncingDividends) return;
    setState(() => _syncingDividends = true);
    try {
      await _divKey.currentState?.syncDividends();
    } finally {
      if (mounted) setState(() => _syncingDividends = false);
    }
  }

  static const _appBarSpinner = Padding(
    padding: EdgeInsets.symmetric(horizontal: 16),
    child: Center(
      child: SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final onHoldings = _tab.index == 0;
    final onDividends = _tab.index == 2;
    return Scaffold(
      appBar: AppBar(
        title: const Text('股票'),
        actions: [
          if (onHoldings)
            _updating
                ? _appBarSpinner
                : IconButton(
                    onPressed: _updatePrices,
                    icon: const Icon(Icons.refresh),
                    tooltip: '更新股價',
                  ),
          if (onDividends)
            _syncingDividends
                ? _appBarSpinner
                : IconButton(
                    onPressed: _syncDividends,
                    icon: const Icon(Icons.sync),
                    tooltip: '同步股利',
                  ),
        ],
        bottom: TabBar(
          controller: _tab,
          isScrollable: true,
          tabs: const [
            Tab(text: '持股'),
            Tab(text: '交易'),
            Tab(text: '股利'),
            Tab(text: '損益'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          _HoldingsTab(key: _key),
          const _StockTxnTab(),
          _DividendTab(key: _divKey),
          const _RealizedTab(),
        ],
      ),
    );
  }
}

// ── 持股 ──────────────────────────────────────────────────────

class _HoldingsData {
  final List<Stock> stocks;
  final PortfolioSummary summary;
  _HoldingsData(this.stocks, this.summary);
}

class _HoldingsTab extends StatefulWidget {
  const _HoldingsTab({super.key});
  @override
  State<_HoldingsTab> createState() => _HoldingsTabState();
}

class _HoldingsTabState extends State<_HoldingsTab> {
  late Future<_HoldingsData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_HoldingsData> _load() async {
    final json = await ApiClient.instance.stocks();
    final stocks = (json['stocks'] as List? ?? [])
        .map((e) => Stock.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    final summary = PortfolioSummary.fromJson(
      (json['portfolioSummary'] as Map? ?? {}).cast<String, dynamic>(),
    );
    return _HoldingsData(stocks, summary);
  }

  void _reload() => setState(() => _future = _load());

  // 從 TWSE/TPEx 批次抓最新價並寫回現價，再重新載入持股。
  // 由上層 StocksScreen 的 AppBar「更新股價」按鈕透過 GlobalKey 呼叫。
  Future<void> updatePrices() async {
    try {
      final fetched = await ApiClient.instance.batchFetchStockPrices();
      final results = (fetched['results'] as List? ?? []);
      final updates = <Map<String, dynamic>>[];
      var failed = 0;
      for (final r in results) {
        final m = (r as Map).cast<String, dynamic>();
        if (m['status'] == 'ok' && m['currentPrice'] != null) {
          updates.add({
            'stockId': m['stockId'],
            'currentPrice': m['currentPrice'],
          });
        } else {
          failed++;
        }
      }
      if (updates.isNotEmpty) {
        await ApiClient.instance.batchUpdateStockPrices(updates);
      }
      if (!mounted) return;
      toast(
        context,
        updates.isEmpty
            ? '沒有可更新的股價'
            : '已更新 ${updates.length} 檔股價${failed > 0 ? '，$failed 檔查詢失敗' : ''}',
      );
      _reload();
    } catch (e) {
      if (mounted) toast(context, '更新股價失敗：$e');
    }
  }

  Future<void> _addStock() async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _AddStockForm(),
    );
    if (changed == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addStock,
        icon: const Icon(Icons.add),
        label: const Text('新增股票'),
      ),
      body: AsyncView<_HoldingsData>(
        future: _future,
        onRetry: _reload,
        builder: (context, data) => RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
            children: [
              _PortfolioCard(s: data.summary),
              const SizedBox(height: 16),
              if (data.stocks.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: EmptyState(icon: Icons.trending_up, message: '尚無持股'),
                )
              else
                for (final s in data.stocks) _HoldingTile(s: s),
            ],
          ),
        ),
      ),
    );
  }
}

class _PortfolioCard extends StatelessWidget {
  final PortfolioSummary s;
  const _PortfolioCard({required this.s});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      color: theme.colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '總市值',
              style: TextStyle(color: theme.colorScheme.onPrimaryContainer),
            ),
            const SizedBox(height: 4),
            Text(
              twd(s.totalMarketValue),
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.onPrimaryContainer,
              ),
            ),
            const Divider(height: 24),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '未實現損益',
                        style: TextStyle(
                          fontSize: 12,
                          color: theme.colorScheme.onPrimaryContainer,
                        ),
                      ),
                      Text(
                        signed(s.totalPL),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: plColor(s.totalPL, context),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '報酬率',
                        style: TextStyle(
                          fontSize: 12,
                          color: theme.colorScheme.onPrimaryContainer,
                        ),
                      ),
                      Text(
                        s.totalReturnRate == null
                            ? '—'
                            : '${s.totalReturnRate!.toStringAsFixed(2)}%',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: plColor(s.totalReturnRate ?? 0, context),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HoldingTile extends StatelessWidget {
  final Stock s;
  const _HoldingTile({required this.s});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Row(
          children: [
            Text(
              '${s.symbol} ${s.name}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            if (s.delisted)
              const Padding(
                padding: EdgeInsets.only(left: 6),
                child: Text(
                  '下市',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ),
          ],
        ),
        subtitle: Text(
          '${intFmt(s.totalShares)} 股・均價 ${s.avgCost}・現價 ${s.currentPrice}',
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              twd(s.marketValue),
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            Text(
              '${signed(s.estimatedProfit)} (${s.returnRate}%)',
              style: TextStyle(
                fontSize: 12,
                color: plColor(s.estimatedProfit, context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── 股票交易 ──────────────────────────────────────────────────

class _StockTxnTab extends StatefulWidget {
  const _StockTxnTab();
  @override
  State<_StockTxnTab> createState() => _StockTxnTabState();
}

class _StockTxnTabState extends State<_StockTxnTab> {
  late Future<List<StockTxn>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<StockTxn>> _load() async {
    final list = await ApiClient.instance.stockTransactions();
    return list
        .map((e) => StockTxn.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _add() async {
    final stocksJson = await ApiClient.instance.stocks();
    final stocks = (stocksJson['stocks'] as List? ?? [])
        .map((e) => Stock.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    if (!mounted) return;
    if (stocks.isEmpty) {
      toast(context, '請先到「持股」分頁新增股票');
      return;
    }
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _StockTxnForm(stocks: stocks),
    );
    if (changed == true) _reload();
  }

  Future<void> _delete(StockTxn t) async {
    try {
      await ApiClient.instance.deleteStockTransaction(t.id);
      if (mounted) toast(context, '已刪除');
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        icon: const Icon(Icons.add),
        label: const Text('新增交易'),
      ),
      body: AsyncView<List<StockTxn>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) {
          if (list.isEmpty) {
            return const EmptyState(icon: Icons.swap_vert, message: '尚無股票交易');
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.only(bottom: 88),
              itemCount: list.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final t = list[i];
                final isBuy = t.type == 'buy';
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: (isBuy ? Colors.red : Colors.green)
                        .withValues(alpha: 0.15),
                    child: Text(
                      isBuy ? '買' : '賣',
                      style: TextStyle(
                        color: isBuy ? Colors.red : Colors.green,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  title: Text('${t.symbol} ${t.stockName}'),
                  subtitle: Text(
                    '${t.date}・${intFmt(t.shares)} 股 @ ${t.price}',
                  ),
                  trailing: Text(
                    twd(t.shares * t.price),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
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

// ── 股利 ──────────────────────────────────────────────────────

class _DividendTab extends StatefulWidget {
  const _DividendTab({super.key});
  @override
  State<_DividendTab> createState() => _DividendTabState();
}

class _DividendTabState extends State<_DividendTab> {
  late Future<List<Dividend>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Dividend>> _load() async {
    final list = await ApiClient.instance.stockDividends();
    return list
        .map((e) => Dividend.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  void _reload() => setState(() => _future = _load());

  // 從 TWSE 依持有期間自動同步股利，再重新載入清單。
  // 由上層 StocksScreen 的 AppBar「同步股利」按鈕透過 GlobalKey 呼叫。
  Future<void> syncDividends() async {
    try {
      final res = await ApiClient.instance.syncStockDividends();
      final synced = (res['synced'] as num?)?.toInt() ?? 0;
      final skipped = (res['skipped'] as num?)?.toInt() ?? 0;
      if (!mounted) return;
      toast(
        context,
        synced == 0
            ? '沒有新的股利可同步'
            : '已同步 $synced 筆股利${skipped > 0 ? '，略過 $skipped 筆' : ''}',
      );
      if (synced > 0) _reload();
    } catch (e) {
      if (mounted) toast(context, '同步股利失敗：$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Dividend>>(
      future: _future,
      onRetry: _reload,
      builder: (context, list) {
        if (list.isEmpty) {
          return const EmptyState(
            icon: Icons.savings_outlined,
            message: '尚無股利紀錄',
          );
        }
        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView.separated(
            itemCount: list.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final d = list[i];
              return ListTile(
                title: Text('${d.symbol} ${d.stockName}'),
                subtitle: Text(d.date),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (d.cashDividend > 0)
                      Text(
                        '現金 ${twd(d.cashDividend)}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.green,
                        ),
                      ),
                    if (d.stockDividendShares > 0)
                      Text(
                        '配股 ${intFmt(d.stockDividendShares)} 股',
                        style: const TextStyle(fontSize: 12),
                      ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ── 已實現損益 ────────────────────────────────────────────────

class _RealizedTab extends StatefulWidget {
  const _RealizedTab();
  @override
  State<_RealizedTab> createState() => _RealizedTabState();
}

class _RealizedTabState extends State<_RealizedTab> {
  late Future<List<RealizedPL>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<RealizedPL>> _load() async {
    final list = await ApiClient.instance.stockRealized();
    return list
        .map((e) => RealizedPL.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  void _reload() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<RealizedPL>>(
      future: _future,
      onRetry: _reload,
      builder: (context, list) {
        if (list.isEmpty) {
          return const EmptyState(
            icon: Icons.account_balance,
            message: '尚無已實現損益',
          );
        }
        final total = list.fold<num>(0, (s, r) => s + r.realizedPL);
        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      '已實現損益合計',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text(
                      signed(total),
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: plColor(total, context),
                      ),
                    ),
                  ],
                ),
              ),
              for (final r in list)
                ListTile(
                  title: Text('${r.symbol} ${r.name}'),
                  subtitle: Text('${r.date}・賣 ${intFmt(r.shares)} 股'),
                  trailing: Text(
                    '${signed(r.realizedPL)} (${r.returnRate}%)',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: plColor(r.realizedPL, context),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

// ── 表單 ──────────────────────────────────────────────────────

class _AddStockForm extends StatefulWidget {
  const _AddStockForm();
  @override
  State<_AddStockForm> createState() => _AddStockFormState();
}

class _AddStockFormState extends State<_AddStockForm> {
  final _formKey = GlobalKey<FormState>();
  final _symbol = TextEditingController();
  final _name = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _symbol.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ApiClient.instance.createStock({
        'symbol': _symbol.text.trim(),
        'name': _name.text.trim(),
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
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('新增股票', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextFormField(
              controller: _symbol,
              decoration: const InputDecoration(
                labelText: '股票代號（如 2330）',
                border: OutlineInputBorder(),
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? '請輸入代號' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(
                labelText: '名稱（選填，留空自動帶入）',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),
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

class _StockTxnForm extends StatefulWidget {
  final List<Stock> stocks;
  const _StockTxnForm({required this.stocks});

  @override
  State<_StockTxnForm> createState() => _StockTxnFormState();
}

class _StockTxnFormState extends State<_StockTxnForm> {
  final _formKey = GlobalKey<FormState>();
  final _shares = TextEditingController();
  final _price = TextEditingController();
  String? _stockId;
  String _type = 'buy';
  DateTime _date = DateTime.now();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _stockId = widget.stocks.first.id;
  }

  @override
  void dispose() {
    _shares.dispose();
    _price.dispose();
    super.dispose();
  }

  String get _dateStr =>
      '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ApiClient.instance.createStockTransaction({
        'stockId': _stockId,
        'type': _type,
        'shares': int.parse(_shares.text.trim()),
        'price': num.parse(_price.text.trim()),
        'date': _dateStr,
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
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('新增股票交易', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'buy', label: Text('買進')),
                ButtonSegment(value: 'sell', label: Text('賣出')),
              ],
              selected: {_type},
              onSelectionChanged: (s) => setState(() => _type = s.first),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _stockId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: '股票',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final s in widget.stocks)
                  DropdownMenuItem(
                    value: s.id,
                    child: Text('${s.symbol} ${s.name}'),
                  ),
              ],
              onChanged: (v) => setState(() => _stockId = v),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _shares,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: '股數',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) {
                      final n = int.tryParse(v?.trim() ?? '');
                      if (n == null || n <= 0) return '正整數';
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _price,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: '價格',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) {
                      final n = num.tryParse(v?.trim() ?? '');
                      if (n == null || n <= 0) return '> 0';
                      return null;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ListTile(
              shape: RoundedRectangleBorder(
                side: BorderSide(color: Theme.of(context).dividerColor),
                borderRadius: BorderRadius.circular(4),
              ),
              leading: const Icon(Icons.calendar_today),
              title: const Text('日期'),
              trailing: Text(_dateStr),
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2000),
                  lastDate: DateTime(2100),
                );
                if (d != null) setState(() => _date = d);
              },
            ),
            const SizedBox(height: 8),
            Text(
              '手續費／交易稅由後端自動計算',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
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

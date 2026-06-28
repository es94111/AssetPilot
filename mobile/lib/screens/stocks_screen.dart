import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';
import 'stock_settings_screen.dart';
import '../l10n.dart';

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
        title: Text(trKey('featuresCommonStock')),
        actions: [
          if (onHoldings)
            _updating
                ? _appBarSpinner
                : IconButton(
                    onPressed: _updatePrices,
                    icon: Icon(Icons.refresh),
                    tooltip: trKey('featuresStocksPortfolioUpdatePrices'),
                  ),
          if (onDividends)
            _syncingDividends
                ? _appBarSpinner
                : IconButton(
                    onPressed: _syncDividends,
                    icon: Icon(Icons.sync),
                    tooltip: trKey('mobileLegacySyncDividends'),
                  ),
          IconButton(
            tooltip: trKey('navStocksSettings'),
            icon: Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => StockSettingsScreen())),
          ),
        ],
        bottom: TabBar(
          controller: _tab,
          isScrollable: true,
          tabs: [
            Tab(text: trKey('mobileLegacyHoldings')),
            Tab(text: trKey('mobileLegacyTransactions')),
            Tab(text: trKey('mobileLegacyDividends')),
            Tab(text: trKey('mobileLegacyReturns')),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          _HoldingsTab(key: _key),
          _StockTxnTab(),
          _DividendTab(key: _divKey),
          _RealizedTab(),
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
            ? trKey('mobileLegacyNoPricesToUpdate')
            : failed > 0
            ? trKey('mobileDynamicStockPricesUpdatedWithFailed', {
                'count': updates.length,
                'failed': failed,
              })
            : trKey('mobileDynamicStockPricesUpdated', {
                'count': updates.length,
              }),
      );
      _reload();
    } catch (e) {
      if (mounted) {
        toast(context, trKey('mobileDynamicFailedUpdatePrices', {'value': e}));
      }
    }
  }

  Future<void> _addStock() async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _StockForm(),
    );
    if (changed == true) _reload();
  }

  Future<void> _editStock(Stock s) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _StockForm(existing: s),
    );
    if (changed == true) _reload();
  }

  Future<void> _deleteStock(Stock s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('mobileLegacyDeleteStock')),
        content: Text(
          trKey('mobileDynamicDeleteStock', {
            'symbol': s.symbol,
            'name': s.name,
          }),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(trKey('commonDelete')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.deleteStock(s.id);
      if (mounted) toast(context, trKey('mobileLegacyDeleted'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addStock,
        icon: Icon(Icons.add),
        label: Text(trKey('featuresStocksPortfolioAddStock')),
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
              SizedBox(height: 16),
              if (data.stocks.isEmpty)
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: EmptyState(
                    icon: Icons.trending_up,
                    message: trKey('mobileLegacyNoHoldingsYet'),
                  ),
                )
              else
                for (final s in data.stocks)
                  _HoldingTile(
                    s: s,
                    onTap: () => _editStock(s),
                    onLongPress: () => _deleteStock(s),
                  ),
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
              trKey('mobileLegacyMarketValue'),
              style: TextStyle(color: theme.colorScheme.onPrimaryContainer),
            ),
            SizedBox(height: 4),
            Text(
              twd(s.totalMarketValue),
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.onPrimaryContainer,
              ),
            ),
            Divider(height: 24),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        trKey('notificationsLabelsUnrealizedPL'),
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
                        trKey('featuresStocksCommonReturnRate'),
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
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  const _HoldingTile({
    required this.s,
    required this.onTap,
    required this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        onTap: onTap,
        onLongPress: onLongPress,
        title: Row(
          children: [
            Text(
              '${s.symbol} ${s.name}',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            if (s.delisted)
              Padding(
                padding: EdgeInsets.only(left: 6),
                child: Text(
                  trKey('mobileLegacyDelisted'),
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ),
          ],
        ),
        subtitle: Text(
          trKey('mobileDynamicStockHoldingSubtitle', {
            'shares': intFmt(s.totalShares),
            'avgCost': s.avgCost,
            'currentPrice': s.currentPrice,
          }),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              twd(s.marketValue),
              style: TextStyle(fontWeight: FontWeight.bold),
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

  Future<void> _openForm([StockTxn? existing]) async {
    final stocksJson = await ApiClient.instance.stocks();
    final stocks = (stocksJson['stocks'] as List? ?? [])
        .map((e) => Stock.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    if (!mounted) return;
    if (stocks.isEmpty) {
      toast(context, trKey('mobileLegacyAddAStockOnTheHoldingsTabFirst'));
      return;
    }
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _StockTxnForm(stocks: stocks, existing: existing),
    );
    if (changed == true) _reload();
  }

  Future<void> _delete(StockTxn t) async {
    try {
      await ApiClient.instance.deleteStockTransaction(t.id);
      if (mounted) toast(context, trKey('mobileLegacyDeleted'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: Icon(Icons.add),
        label: Text(trKey('featuresTransactionsAdd')),
      ),
      body: AsyncView<List<StockTxn>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) {
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.swap_vert,
              message: trKey('mobileLegacyNoStockTransactions'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.only(bottom: 88),
              itemCount: list.length,
              separatorBuilder: (_, _) => Divider(height: 1),
              itemBuilder: (context, i) {
                final t = list[i];
                final isBuy = t.type == 'buy';
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: (isBuy ? Colors.red : Colors.green)
                        .withValues(alpha: 0.15),
                    child: Text(
                      isBuy
                          ? trKey('mobileLegacyBuy')
                          : trKey('mobileLegacySell'),
                      style: TextStyle(
                        color: isBuy ? Colors.red : Colors.green,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  title: Text('${t.symbol} ${t.stockName}'),
                  subtitle: Text(
                    trKey('mobileDynamicStockTransactionSubtitle', {
                      'date': t.date,
                      'shares': intFmt(t.shares),
                      'price': t.price,
                    }),
                  ),
                  trailing: Text(
                    twd(t.shares * t.price),
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  onTap: () => _openForm(t),
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

  Future<void> _openForm([Dividend? existing]) async {
    final api = ApiClient.instance;
    final stocksJson = await api.stocks();
    final stocks = (stocksJson['stocks'] as List? ?? [])
        .map((e) => Stock.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    final accsRaw = await api.accounts();
    final accounts = accsRaw
        .map((e) => Account.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    if (!mounted) return;
    if (stocks.isEmpty) {
      toast(context, trKey('mobileLegacyAddAStockOnTheHoldingsTabFirst'));
      return;
    }
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) =>
          _DividendForm(stocks: stocks, accounts: accounts, existing: existing),
    );
    if (changed == true) _reload();
  }

  Future<void> _delete(Dividend d) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('mobileLegacyDeleteDividend')),
        content: Text(
          trKey('mobileDynamicDeleteDividend', {
            'symbol': d.symbol,
            'date': d.date,
          }),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(trKey('commonDelete')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.deleteStockDividend(d.id);
      if (mounted) toast(context, trKey('mobileLegacyDeleted'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

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
            ? trKey('mobileLegacyNoNewDividendsToSync')
            : skipped > 0
            ? trKey('mobileDynamicDividendsSyncedWithSkipped', {
                'count': synced,
                'skipped': skipped,
              })
            : trKey('mobileDynamicDividendsSynced', {'count': synced}),
      );
      if (synced > 0) _reload();
    } catch (e) {
      if (mounted) {
        toast(context, trKey('mobileDynamicFailedSyncDividends', {'value': e}));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: Icon(Icons.add),
        label: Text(trKey('featuresStocksDividendsAddDividend')),
      ),
      body: AsyncView<List<Dividend>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) {
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.savings_outlined,
              message: trKey('mobileLegacyNoDividendRecords'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.only(bottom: 88),
              itemCount: list.length,
              separatorBuilder: (_, _) => Divider(height: 1),
              itemBuilder: (context, i) {
                final d = list[i];
                return ListTile(
                  onTap: () => _openForm(d),
                  onLongPress: () => _delete(d),
                  title: Text('${d.symbol} ${d.stockName}'),
                  subtitle: Text(d.date),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (d.cashDividend > 0)
                        Text(
                          trKey('mobileDynamicCashDividend', {
                            'amount': twd(d.cashDividend),
                          }),
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.green,
                          ),
                        ),
                      if (d.stockDividendShares > 0)
                        Text(
                          trKey('mobileDynamicStockDividendShares', {
                            'shares': intFmt(d.stockDividendShares),
                          }),
                          style: TextStyle(fontSize: 12),
                        ),
                    ],
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
          return EmptyState(
            icon: Icons.account_balance,
            message: trKey('mobileLegacyNoRealizedReturns'),
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
                    Text(
                      trKey('mobileLegacyTotalRealizedPL'),
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
                  subtitle: Text(
                    trKey('mobileDynamicRealizedTransactionSubtitle', {
                      'date': r.date,
                      'shares': intFmt(r.shares),
                    }),
                  ),
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

Map<String, String> get _kStockTypes => {
  'stock': trKey('mobileLegacyStock'),
  'etf': 'ETF',
  'warrant': trKey('featuresStocksCommonStockTypeWarrant'),
};

class _StockForm extends StatefulWidget {
  final Stock? existing;
  const _StockForm({this.existing});
  @override
  State<_StockForm> createState() => _StockFormState();
}

class _StockFormState extends State<_StockForm> {
  final _formKey = GlobalKey<FormState>();
  late final _symbol = TextEditingController(
    text: widget.existing?.symbol ?? '',
  );
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late String _stockType = widget.existing?.stockType ?? 'stock';
  late final String _initialType = widget.existing?.stockType ?? 'stock';
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

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
      final api = ApiClient.instance;
      if (_isEdit) {
        final body = <String, dynamic>{'name': _name.text.trim()};
        // 僅在使用者實際變更類型時才送，避免不慎觸發後端證交稅重算。
        if (_stockType != _initialType) body['stockType'] = _stockType;
        await api.updateStock(widget.existing!.id, body);
      } else {
        await api.createStock({
          'symbol': _symbol.text.trim(),
          'name': _name.text.trim(),
          'stockType': _stockType,
        });
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
              _isEdit
                  ? trKey('featuresStocksPortfolioEditStock')
                  : trKey('featuresStocksPortfolioAddStock'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            SizedBox(height: 16),
            TextFormField(
              controller: _symbol,
              enabled: !_isEdit,
              decoration: InputDecoration(
                labelText: trKey('mobileLegacyTickerEG2330'),
                border: OutlineInputBorder(),
              ),
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? trKey('mobileLegacyEnterATicker')
                  : null,
            ),
            SizedBox(height: 12),
            TextFormField(
              controller: _name,
              decoration: InputDecoration(
                labelText: _isEdit
                    ? trKey('featuresCommonName')
                    : trKey('mobileLegacyNameOptionalFilledAutomatically'),
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _stockType,
              decoration: InputDecoration(
                labelText: trKey('mobileLegacyTypeAffectsTransactionTax'),
                border: OutlineInputBorder(),
              ),
              items: [
                for (final e in _kStockTypes.entries)
                  DropdownMenuItem(value: e.key, child: Text(e.value)),
              ],
              onChanged: (v) => setState(() => _stockType = v ?? 'stock'),
            ),
            SizedBox(height: 20),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
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
      ),
    );
  }
}

class _StockTxnForm extends StatefulWidget {
  final List<Stock> stocks;
  final StockTxn? existing;
  const _StockTxnForm({required this.stocks, this.existing});

  @override
  State<_StockTxnForm> createState() => _StockTxnFormState();
}

class _StockTxnFormState extends State<_StockTxnForm> {
  final _formKey = GlobalKey<FormState>();
  final _shares = TextEditingController();
  final _price = TextEditingController();
  final _fee = TextEditingController();
  final _tax = TextEditingController();
  final _note = TextEditingController();
  String? _stockId;
  String _type = 'buy';
  DateTime _date = DateTime.now();
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _type = e.type == 'sell' ? 'sell' : 'buy';
      _stockId = widget.stocks.any((s) => s.id == e.stockId)
          ? e.stockId
          : widget.stocks.first.id;
      _shares.text = e.shares % 1 == 0
          ? e.shares.toInt().toString()
          : '${e.shares}';
      _price.text = '${e.price}';
      _date = DateTime.tryParse(e.date) ?? DateTime.now();
      _note.text = e.note;
      // 手續費/稅 > 0 視為手動覆寫，帶入供編輯；0（自動）則留空。
      if (e.fee > 0) _fee.text = '${e.fee}';
      if (e.tax > 0) _tax.text = '${e.tax}';
    } else {
      _stockId = widget.stocks.first.id;
    }
  }

  @override
  void dispose() {
    _shares.dispose();
    _price.dispose();
    _fee.dispose();
    _tax.dispose();
    _note.dispose();
    super.dispose();
  }

  String get _dateStr =>
      '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'stockId': _stockId,
        'type': _type,
        'shares': int.parse(_shares.text.trim()),
        'price': num.parse(_price.text.trim()),
        'date': _dateStr,
        'note': _note.text.trim(),
      };
      // 留空＝交由後端自動計算（tax 自動旗標）；有填＝手動覆寫。
      final feeText = _fee.text.trim();
      final taxText = _tax.text.trim();
      if (feeText.isNotEmpty) body['fee'] = num.tryParse(feeText) ?? 0;
      if (taxText.isNotEmpty) body['tax'] = num.tryParse(taxText) ?? 0;
      final api = ApiClient.instance;
      if (_isEdit) {
        await api.updateStockTransaction(widget.existing!.id, body);
      } else {
        await api.createStockTransaction(body);
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
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                _isEdit
                    ? trKey('mobileLegacyEditStockTransaction')
                    : trKey('mobileLegacyAddStockTransaction'),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              SizedBox(height: 16),
              SegmentedButton<String>(
                segments: [
                  ButtonSegment(
                    value: 'buy',
                    label: Text(trKey('featuresStocksCommonBuy')),
                  ),
                  ButtonSegment(
                    value: 'sell',
                    label: Text(trKey('featuresStocksCommonSell')),
                  ),
                ],
                selected: {_type},
                onSelectionChanged: (s) => setState(() => _type = s.first),
              ),
              SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _stockId,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: trKey('featuresCommonStock'),
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
              SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _shares,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: trKey('featuresStocksCommonShares'),
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) {
                        final n = int.tryParse(v?.trim() ?? '');
                        if (n == null || n <= 0) {
                          return trKey('mobileLegacyPositiveWholeNumber');
                        }
                        return null;
                      },
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _price,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        labelText: trKey('featuresStocksCommonPrice'),
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
              SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _fee,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        labelText: trKey('mobileLegacyFeeOptional'),
                        hintText: trKey('mobileLegacyAutomatic'),
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _tax,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        labelText: trKey('mobileLegacyTransactionTaxOptional'),
                        hintText: trKey('mobileLegacyAutomatic'),
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 12),
              ListTile(
                shape: RoundedRectangleBorder(
                  side: BorderSide(color: Theme.of(context).dividerColor),
                  borderRadius: BorderRadius.circular(4),
                ),
                leading: Icon(Icons.calendar_today),
                title: Text(trKey('dashboardTableDate')),
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
              SizedBox(height: 12),
              TextFormField(
                controller: _note,
                decoration: InputDecoration(
                  labelText: trKey('mobileLegacyNoteOptional'),
                  border: OutlineInputBorder(),
                ),
              ),
              SizedBox(height: 8),
              Text(
                trKey('mobileLegacyLeaveFeeAndTaxBlankToCalculateThem'),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              SizedBox(height: 16),
              FilledButton(
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
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
        ),
      ),
    );
  }
}

class _DividendForm extends StatefulWidget {
  final List<Stock> stocks;
  final List<Account> accounts;
  final Dividend? existing;
  const _DividendForm({
    required this.stocks,
    required this.accounts,
    this.existing,
  });

  @override
  State<_DividendForm> createState() => _DividendFormState();
}

class _DividendFormState extends State<_DividendForm> {
  final _formKey = GlobalKey<FormState>();
  final _cash = TextEditingController();
  final _shares = TextEditingController();
  final _note = TextEditingController();
  String? _stockId;
  String? _accountId;
  DateTime _date = DateTime.now();
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _stockId = widget.stocks.any((s) => s.id == e.stockId) ? e.stockId : null;
      _accountId = widget.accounts.any((a) => a.id == e.accountId)
          ? e.accountId
          : null;
      _date = DateTime.tryParse(e.date) ?? DateTime.now();
      if (e.cashDividend > 0) _cash.text = '${e.cashDividend}';
      if (e.stockDividendShares > 0) _shares.text = '${e.stockDividendShares}';
      _note.text = e.note;
    } else {
      _stockId = widget.stocks.first.id;
    }
  }

  @override
  void dispose() {
    _cash.dispose();
    _shares.dispose();
    _note.dispose();
    super.dispose();
  }

  String get _dateStr =>
      '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final cash = num.tryParse(_cash.text.trim()) ?? 0;
    final shares = num.tryParse(_shares.text.trim()) ?? 0;
    if (cash <= 0 && shares <= 0) {
      toast(context, trKey('mobileLegacyEnterACashOrStockDividend'));
      return;
    }
    if (cash > 0 && _accountId == null) {
      toast(
        context,
        trKey('mobileLegacyADepositAccountIsRequiredForCashDividends'),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'stockId': _stockId,
        'date': _dateStr,
        'cashDividend': cash,
        'stockDividendShares': shares,
        'accountId': _accountId,
        'note': _note.text.trim(),
      };
      final api = ApiClient.instance;
      if (_isEdit) {
        await api.updateStockDividend(widget.existing!.id, body);
      } else {
        await api.createStockDividend(body);
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
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                _isEdit
                    ? trKey('featuresStocksDividendsEditDividend')
                    : trKey('featuresStocksDividendsAddDividend'),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _stockId,
                isExpanded: true,
                // 編輯時後端不支援更換股票，故鎖定。
                decoration: InputDecoration(
                  labelText: trKey('featuresCommonStock'),
                  border: OutlineInputBorder(),
                  filled: _isEdit,
                ),
                items: [
                  for (final s in widget.stocks)
                    DropdownMenuItem(
                      value: s.id,
                      child: Text('${s.symbol} ${s.name}'),
                    ),
                ],
                onChanged: _isEdit ? null : (v) => setState(() => _stockId = v),
                validator: (v) => v == null
                    ? trKey('featuresStocksTransactionsMessagesStockRequired')
                    : null,
              ),
              SizedBox(height: 12),
              ListTile(
                shape: RoundedRectangleBorder(
                  side: BorderSide(color: Theme.of(context).dividerColor),
                  borderRadius: BorderRadius.circular(4),
                ),
                leading: Icon(Icons.calendar_today),
                title: Text(trKey('dashboardTableDate')),
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
              SizedBox(height: 12),
              TextFormField(
                controller: _cash,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: trKey('mobileLegacyCashDividendTotalOptional'),
                  border: OutlineInputBorder(),
                ),
              ),
              SizedBox(height: 12),
              TextFormField(
                controller: _shares,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: trKey('mobileLegacyStockDividendSharesOptional'),
                  border: OutlineInputBorder(),
                ),
              ),
              SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _accountId,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: trKey(
                    'mobileLegacyDepositAccountRequiredForCashDividends',
                  ),
                  border: OutlineInputBorder(),
                ),
                items: [
                  DropdownMenuItem(
                    value: null,
                    child: Text(trKey('featuresCommonUnspecified')),
                  ),
                  for (final a in widget.accounts)
                    DropdownMenuItem(value: a.id, child: Text(a.name)),
                ],
                onChanged: (v) => setState(() => _accountId = v),
              ),
              SizedBox(height: 12),
              TextFormField(
                controller: _note,
                decoration: InputDecoration(
                  labelText: trKey('mobileLegacyNoteOptional'),
                  border: OutlineInputBorder(),
                ),
              ),
              SizedBox(height: 20),
              FilledButton(
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
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
        ),
      ),
    );
  }
}

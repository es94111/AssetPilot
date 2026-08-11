import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';

/// 股票手續費／證交稅率設定、股票狀態管理與定期定額。對應網頁版「股票設定」。
class StockSettingsScreen extends StatefulWidget {
  const StockSettingsScreen({super.key});

  @override
  State<StockSettingsScreen> createState() => _StockSettingsScreenState();
}

/// 設定頁需要同時載入的資料：手續費率 + 持股 + 帳戶 + 定期定額。
class _SettingsData {
  final StockSettings settings;
  final List<Stock> stocks;
  final List<Account> accounts;
  final List<StockRecurring> recurring;
  _SettingsData({
    required this.settings,
    required this.stocks,
    required this.accounts,
    required this.recurring,
  });
}

class _StockSettingsScreenState extends State<StockSettingsScreen> {
  late Future<_SettingsData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_SettingsData> _load() async {
    final api = ApiClient.instance;
    final results = await Future.wait([
      api.stockSettings(),
      api.stocks(),
      api.accounts(),
      api.stockRecurring(),
    ]);
    final stocksJson = (results[1] as Map)['stocks'] as List? ?? [];
    return _SettingsData(
      settings: StockSettings.fromJson(
        (results[0] as Map).cast<String, dynamic>(),
      ),
      stocks: stocksJson
          .map((e) => Stock.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      accounts: (results[2] as List)
          .map((e) => Account.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      recurring: (results[3] as List)
          .map((e) => StockRecurring.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
    );
  }

  void _reload() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(trKey('navStocksSettings'))),
      body: AsyncView<_SettingsData>(
        future: _future,
        onRetry: _reload,
        builder: (context, data) => RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _StockSettingsForm(
                initial: data.settings,
                onSaved: _reload,
              ),
              SizedBox(height: 24),
              _StockStatusSection(
                stocks: data.stocks,
                onChanged: _reload,
              ),
              SizedBox(height: 24),
              _RecurringSection(
                stocks: data.stocks,
                accounts: data.accounts,
                recurring: data.recurring,
                onChanged: _reload,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── 手續費／證交稅率設定 ──────────────────────────────────────

class _StockSettingsForm extends StatefulWidget {
  final StockSettings initial;
  final VoidCallback onSaved;
  const _StockSettingsForm({required this.initial, required this.onSaved});

  @override
  State<_StockSettingsForm> createState() => _StockSettingsFormState();
}

class _StockSettingsFormState extends State<_StockSettingsForm> {
  final _formKey = GlobalKey<FormState>();
  late final _feeRate = _ctrl(widget.initial.feeRate);
  late final _feeDiscount = _ctrl(widget.initial.feeDiscount);
  late final _feeMinLot = _ctrl(widget.initial.feeMinLot);
  late final _feeMinOdd = _ctrl(widget.initial.feeMinOdd);
  late final _taxStock = _ctrl(widget.initial.sellTaxRateStock);
  late final _taxEtf = _ctrl(widget.initial.sellTaxRateEtf);
  late final _taxWarrant = _ctrl(widget.initial.sellTaxRateWarrant);
  late final _taxMin = _ctrl(widget.initial.sellTaxMin);
  bool _saving = false;

  static TextEditingController _ctrl(num v) =>
      TextEditingController(text: v % 1 == 0 ? v.toInt().toString() : '$v');

  static String _ctrlText(num v) => v % 1 == 0 ? v.toInt().toString() : '$v';

  @override
  void didUpdateWidget(_StockSettingsForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    // 儲存後 onSaved 觸發重新載入，initial 為新物件，一律刷新欄位值。
    if (oldWidget.initial != widget.initial) {
      _feeRate.text = _ctrlText(widget.initial.feeRate);
      _feeDiscount.text = _ctrlText(widget.initial.feeDiscount);
      _feeMinLot.text = _ctrlText(widget.initial.feeMinLot);
      _feeMinOdd.text = _ctrlText(widget.initial.feeMinOdd);
      _taxStock.text = _ctrlText(widget.initial.sellTaxRateStock);
      _taxEtf.text = _ctrlText(widget.initial.sellTaxRateEtf);
      _taxWarrant.text = _ctrlText(widget.initial.sellTaxRateWarrant);
      _taxMin.text = _ctrlText(widget.initial.sellTaxMin);
    }
  }

  @override
  void dispose() {
    for (final c in [
      _feeRate,
      _feeDiscount,
      _feeMinLot,
      _feeMinOdd,
      _taxStock,
      _taxEtf,
      _taxWarrant,
      _taxMin,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ApiClient.instance.updateStockSettings({
        'feeRate': num.tryParse(_feeRate.text.trim()) ?? 0,
        'feeDiscount': num.tryParse(_feeDiscount.text.trim()) ?? 0,
        'feeMinLot': num.tryParse(_feeMinLot.text.trim()) ?? 0,
        'feeMinOdd': num.tryParse(_feeMinOdd.text.trim()) ?? 0,
        'sellTaxRateStock': num.tryParse(_taxStock.text.trim()) ?? 0,
        'sellTaxRateEtf': num.tryParse(_taxEtf.text.trim()) ?? 0,
        'sellTaxRateWarrant': num.tryParse(_taxWarrant.text.trim()) ?? 0,
        'sellTaxMin': num.tryParse(_taxMin.text.trim()) ?? 0,
      });
      if (mounted) {
        // 先還原按鈕狀態再重新載入；onSaved 觸發 reload 後 State 會被重用，
        // 若沒重設 _saving，按鈕會永遠卡在 loading。
        setState(() => _saving = false);
        toast(context, trKey('featuresAccountsMessagesSaved'));
        widget.onSaved();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, '$e', isError: true);
      }
    }
  }

  Widget _num(String label, TextEditingController c, {String? helper}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(
          labelText: label,
          helperText: helper,
          border: OutlineInputBorder(),
        ),
        validator: (v) {
          final n = num.tryParse(v?.trim() ?? '');
          if (n == null || n < 0) return trKey('mobileLegacyEnterANumberGreaterThanOrEqualTo');
          return null;
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            trKey('featuresStocksSettingsFeeTitle'),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          SizedBox(height: 12),
          _num(trKey('mobileLegacyCommissionRate'), _feeRate, helper: trKey('mobileLegacyStandardBrokerageRate01425')),
          _num(trKey('mobileLegacyDiscount01'), _feeDiscount, helper: trKey('mobileLegacyExample06MeansA40Discount')),
          _num(trKey('mobileLegacyMinimumBoardLotCommission'), _feeMinLot),
          _num(trKey('mobileLegacyMinimumOddLotCommission'), _feeMinOdd),
          SizedBox(height: 8),
          Text(trKey('mobileLegacyTransactionTaxSell'), style: Theme.of(context).textTheme.titleMedium),
          SizedBox(height: 12),
          _num(trKey('mobileLegacyStocks'), _taxStock, helper: trKey('mobileLegacyStandardRate03')),
          _num('ETF（%）', _taxEtf, helper: trKey('mobileLegacyStandardRate01')),
          _num(trKey('mobileLegacyWarrants'), _taxWarrant),
          _num(trKey('mobileLegacyMinimumTransactionTax'), _taxMin),
          SizedBox(height: 8),
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
    );
  }
}

// ── 股票狀態管理 ──────────────────────────────────────────────

class _StockStatusSection extends StatelessWidget {
  final List<Stock> stocks;
  final VoidCallback onChanged;
  const _StockStatusSection({required this.stocks, required this.onChanged});

  Future<void> _toggleDelisted(BuildContext context, Stock stock) async {
    final api = ApiClient.instance;
    final next = !stock.delisted;
    final status = next
        ? trKey('featuresStocksSettingsMessagesDelistedStatus')
        : trKey('featuresStocksSettingsMessagesRestoredStatus');
    try {
      await api.batchUpdateStockPrices([
        {
          'stockId': stock.id,
          'currentPrice': stock.currentPrice,
          'delisted': next,
        },
      ]);
      if (!context.mounted) return;
      toast(
        context,
        trKey('featuresStocksSettingsMessagesStockStatusUpdated', {
          'symbol': stock.symbol,
          'status': status,
        }),
      );
      onChanged();
    } catch (e) {
      if (context.mounted) {
        toast(context, trKey('featuresStocksSettingsMessagesDelistedUpdateFailed'), isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          trKey('featuresStocksSettingsStockStatusTitle'),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        SizedBox(height: 12),
        if (stocks.isEmpty)
          EmptyState(
            icon: Icons.trending_up,
            message: trKey('mobileLegacyNoHoldingsYet'),
          )
        else
          for (final s in stocks)
            Card(
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text('${s.symbol} ${s.name}'),
                subtitle: Text(
                  '${trKey('featuresStocksSettingsCurrentPrice')} ${twd(s.currentPrice)}',
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Chip(
                      label: Text(
                        s.delisted
                            ? trKey('featuresStocksSettingsDelisted')
                            : trKey('featuresStocksSettingsNormalTracking'),
                        style: TextStyle(
                          fontSize: 11,
                          color: s.delisted ? Colors.amber.shade800 : Colors.green.shade700,
                        ),
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                    SizedBox(width: 8),
                    TextButton(
                      onPressed: () => _toggleDelisted(context, s),
                      child: Text(
                        s.delisted
                            ? trKey('featuresStocksSettingsRestoreTracking')
                            : trKey('featuresStocksSettingsMarkDelisted'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

// ── 股票定期定額 ──────────────────────────────────────────────

class _RecurringSection extends StatelessWidget {
  final List<Stock> stocks;
  final List<Account> accounts;
  final List<StockRecurring> recurring;
  final VoidCallback onChanged;
  const _RecurringSection({
    required this.stocks,
    required this.accounts,
    required this.recurring,
    required this.onChanged,
  });

  String _frequencyLabel(String freq) => switch (freq) {
    'daily' => trKey('featuresStocksSettingsFrequencyLabelsDaily'),
    'weekly' => trKey('featuresStocksSettingsFrequencyLabelsWeekly'),
    'yearly' => trKey('featuresStocksSettingsFrequencyLabelsYearly'),
    _ => trKey('featuresStocksSettingsFrequencyLabelsMonthly'),
  };

  Future<void> _openForm(BuildContext context, [StockRecurring? existing]) async {
    if (stocks.isEmpty) {
      toast(context, trKey('mobileLegacyAddAStockOnTheHoldingsTabFirst'));
      return;
    }
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _RecurringForm(
        stocks: stocks,
        accounts: accounts,
        existing: existing,
      ),
    );
    if (changed == true && context.mounted) onChanged();
  }

  Future<void> _toggle(BuildContext context, StockRecurring r) async {
    try {
      await ApiClient.instance.toggleStockRecurring(r.id);
      if (context.mounted) onChanged();
    } catch (e) {
      if (context.mounted) toast(context, '$e', isError: true);
    }
  }

  Future<void> _delete(BuildContext context, StockRecurring r) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('featuresStocksSettingsDeleteRecurringConfirm')),
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
      await ApiClient.instance.deleteStockRecurring(r.id);
      if (context.mounted) {
        toast(context, trKey('mobileLegacyDeleted'));
        onChanged();
      }
    } catch (e) {
      if (context.mounted) toast(context, '$e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                trKey('featuresStocksSettingsRecurringTitle'),
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            FilledButton.tonalIcon(
              onPressed: () => _openForm(context),
              icon: Icon(Icons.add, size: 18),
              label: Text(trKey('featuresStocksSettingsAddRecurringShort')),
            ),
          ],
        ),
        SizedBox(height: 12),
        if (recurring.isEmpty)
          EmptyState(
            icon: Icons.repeat,
            message: trKey('featuresStocksSettingsNewRecurring'),
          )
        else
          for (final r in recurring)
            Card(
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text('${r.symbol} ${r.stockName}'),
                subtitle: Text(
                  '${twd(r.amount)} · ${_frequencyLabel(r.frequency)}'
                  '${r.lastGenerated.isEmpty ? '' : ' · ${trKey('featuresStocksSettingsLastGenerated')} ${r.lastGenerated}'}',
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Chip(
                      label: Text(
                        r.isActive
                            ? trKey('featuresStocksSettingsActive')
                            : trKey('featuresStocksSettingsInactive'),
                        style: TextStyle(
                          fontSize: 11,
                          color: r.isActive ? Colors.green.shade700 : Colors.grey,
                        ),
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                    IconButton(
                      tooltip: r.isActive
                          ? trKey('featuresStocksSettingsInactive')
                          : trKey('featuresStocksSettingsActive'),
                      icon: Icon(r.isActive ? Icons.pause : Icons.play_arrow),
                      onPressed: () => _toggle(context, r),
                    ),
                    IconButton(
                      tooltip: trKey('featuresStocksSettingsEditRecurring'),
                      icon: Icon(Icons.edit_outlined),
                      onPressed: () => _openForm(context, r),
                    ),
                    IconButton(
                      tooltip: trKey('commonDelete'),
                      icon: Icon(Icons.delete_outline),
                      onPressed: () => _delete(context, r),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

class _RecurringForm extends StatefulWidget {
  final List<Stock> stocks;
  final List<Account> accounts;
  final StockRecurring? existing;
  const _RecurringForm({
    required this.stocks,
    required this.accounts,
    this.existing,
  });

  @override
  State<_RecurringForm> createState() => _RecurringFormState();
}

class _RecurringFormState extends State<_RecurringForm> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _note = TextEditingController();
  String? _stockId;
  String _frequency = 'monthly';
  String? _accountId;
  DateTime _startDate = DateTime.now();
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _stockId = widget.stocks.any((s) => s.id == e.stockId)
          ? e.stockId
          : widget.stocks.first.id;
      _amount.text = '${e.amount}';
      _frequency = e.frequency;
      _startDate = DateTime.tryParse(e.startDate) ?? DateTime.now();
      _accountId = widget.accounts.any((a) => a.id == e.accountId)
          ? e.accountId
          : null;
      _note.text = e.note;
    } else {
      _stockId = widget.stocks.first.id;
    }
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  String get _dateStr =>
      '${_startDate.year}-${_startDate.month.toString().padLeft(2, '0')}-${_startDate.day.toString().padLeft(2, '0')}';

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final amount = num.tryParse(_amount.text.trim()) ?? 0;
    if (amount <= 0) {
      toast(context, trKey('featuresStocksSettingsMessagesAmountRequired'));
      return;
    }
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'stockId': _stockId,
        'amount': amount,
        'frequency': _frequency,
        'startDate': _dateStr,
        'accountId': _accountId,
        'note': _note.text.trim(),
      };
      final api = ApiClient.instance;
      if (_isEdit) {
        await api.updateStockRecurring(widget.existing!.id, body);
      } else {
        await api.createStockRecurring(body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, '$e', isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final freqOptions = <String, String>{
      'daily': trKey('featuresStocksSettingsFrequencyLabelsDaily'),
      'weekly': trKey('featuresStocksSettingsFrequencyLabelsWeekly'),
      'monthly': trKey('featuresStocksSettingsFrequencyLabelsMonthly'),
      'yearly': trKey('featuresStocksSettingsFrequencyLabelsYearly'),
    };
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
                    ? trKey('featuresStocksSettingsEditRecurring')
                    : trKey('featuresStocksSettingsNewRecurring'),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              SizedBox(height: 16),
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
                validator: (v) => v == null
                    ? trKey('featuresStocksSettingsMessagesStockRequired')
                    : null,
              ),
              SizedBox(height: 12),
              TextFormField(
                controller: _amount,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: trKey('featuresStocksSettingsRecurringAmountLabel'),
                  border: OutlineInputBorder(),
                ),
              ),
              SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _frequency,
                decoration: InputDecoration(
                  labelText: trKey('featuresStocksSettingsFrequency'),
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final e in freqOptions.entries)
                    DropdownMenuItem(value: e.key, child: Text(e.value)),
                ],
                onChanged: (v) => setState(() => _frequency = v ?? 'monthly'),
              ),
              SizedBox(height: 12),
              ListTile(
                shape: RoundedRectangleBorder(
                  side: BorderSide(color: Theme.of(context).dividerColor),
                  borderRadius: BorderRadius.circular(4),
                ),
                leading: Icon(Icons.calendar_today),
                title: Text(trKey('featuresStocksSettingsStartDate')),
                trailing: Text(_dateStr),
                onTap: () async {
                  final d = await showDatePicker(
                    context: context,
                    initialDate: _startDate,
                    firstDate: DateTime(2000),
                    lastDate: DateTime(2100),
                  );
                  if (d != null) setState(() => _startDate = d);
                },
              ),
              SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _accountId,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: trKey('featuresCommonAccount'),
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
                  labelText: trKey('featuresCommonNote'),
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

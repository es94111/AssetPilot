import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';

/// 股票手續費／證交稅率設定。對應網頁版「股票設定」。
class StockSettingsScreen extends StatefulWidget {
  const StockSettingsScreen({super.key});

  @override
  State<StockSettingsScreen> createState() => _StockSettingsScreenState();
}

class _StockSettingsScreenState extends State<StockSettingsScreen> {
  late Future<StockSettings> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<StockSettings> _load() async =>
      StockSettings.fromJson(await ApiClient.instance.stockSettings());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(trKey('navStocksSettings'))),
      body: AsyncView<StockSettings>(
        future: _future,
        onRetry: () => setState(() => _future = _load()),
        builder: (context, s) => _StockSettingsForm(initial: s),
      ),
    );
  }
}

class _StockSettingsForm extends StatefulWidget {
  final StockSettings initial;
  const _StockSettingsForm({required this.initial});

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
        toast(context, trKey('featuresAccountsMessagesSaved'));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, '$e');
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
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(trKey('featuresStocksTransactionsFeeLabel'), style: Theme.of(context).textTheme.titleMedium),
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

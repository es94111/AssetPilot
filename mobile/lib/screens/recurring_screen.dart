import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app_widget_sync.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';

Map<String, String> get _freqLabels => {
  'daily': trKey('featuresRecurringFrequencyLabelsDaily'),
  'weekly': trKey('featuresRecurringFrequencyLabelsWeekly'),
  'monthly': trKey('featuresRecurringFrequencyLabelsMonthly'),
  'yearly': trKey('featuresRecurringFrequencyLabelsYearly'),
};

class _RecurringData {
  final List<Recurring> items;
  final Map<String, String> catName;
  final Map<String, String> accName;
  final List<Category> categories;
  final List<Account> accounts;
  _RecurringData(
    this.items,
    this.catName,
    this.accName,
    this.categories,
    this.accounts,
  );
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
    await AppWidgetSync.updateRecurringReminders(
      recurring: items,
      categoryNames: {for (final c in categories) c.id: c.name},
      accountNames: {for (final a in accounts) a.id: a.name},
      accounts: accounts,
    );
    return _RecurringData(
      items,
      {for (final c in categories) c.id: c.name},
      {for (final a in accounts) a.id: a.name},
      categories,
      accounts,
    );
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _openForm(_RecurringData data, [Recurring? existing]) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _RecurringForm(
        categories: data.categories,
        accounts: data.accounts,
        existing: existing,
      ),
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
      if (mounted) toast(context, trKey('mobileLegacyDeleted'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(trKey('navRecurring'))),
      floatingActionButton: FutureBuilder<_RecurringData>(
        future: _future,
        builder: (context, snap) => FloatingActionButton.extended(
          onPressed: snap.hasData ? () => _openForm(snap.data!) : null,
          icon: Icon(Icons.add),
          label: Text(trKey('commonAdd')),
        ),
      ),
      body: AsyncView<_RecurringData>(
        future: _future,
        onRetry: _reload,
        builder: (context, data) {
          if (data.items.isEmpty) {
            return EmptyState(
              icon: Icons.repeat,
              message: trKey('mobileLegacyNoRecurringTransactions'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.only(bottom: 88),
              itemCount: data.items.length,
              separatorBuilder: (_, _) => Divider(height: 1),
              itemBuilder: (context, i) {
                final r = data.items[i];
                final isIncome = r.type == 'income';
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: (isIncome ? Colors.green : Colors.red)
                        .withValues(alpha: 0.15),
                    child: Icon(
                      isIncome ? Icons.south_west : Icons.north_east,
                      color: isIncome ? Colors.green : Colors.red,
                      size: 20,
                    ),
                  ),
                  title: Text(
                    data.catName[r.categoryId] ??
                        (r.note.isEmpty
                            ? trKey('dashboardUncategorized')
                            : r.note),
                  ),
                  subtitle: Text(
                    trKey('mobileDynamicRecurringSubtitle', {
                      'frequency': _freqLabels[r.frequency] ?? r.frequency,
                      'account': data.accName[r.accountId] ?? '',
                      'startDate': r.startDate,
                    }),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        (isIncome ? '+' : '-') + money(r.amount, r.currency),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: isIncome ? Colors.green : Colors.red,
                        ),
                      ),
                      Switch(value: r.isActive, onChanged: (_) => _toggle(r)),
                    ],
                  ),
                  onTap: () => _openForm(data, r),
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

const _kRecurringCurrencies = [
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

class _RecurringForm extends StatefulWidget {
  final List<Category> categories;
  final List<Account> accounts;
  final Recurring? existing;
  const _RecurringForm({
    required this.categories,
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
  final _fxFee = TextEditingController();
  final _fxRate = TextEditingController();
  String _type = 'expense';
  String _frequency = 'monthly';
  String? _categoryId;
  String? _accountId;
  String _currency = 'TWD';
  DateTime _start = DateTime.now();
  bool _saving = false;
  bool _excludeFromStats = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _type = e.type == 'income' ? 'income' : 'expense';
      _frequency = e.frequency.isEmpty ? 'monthly' : e.frequency;
      _categoryId = e.categoryId.isEmpty ? null : e.categoryId;
      _accountId = e.accountId.isEmpty ? null : e.accountId;
      _currency = e.currency.isEmpty ? 'TWD' : e.currency;
      _start = DateTime.tryParse(e.startDate) ?? DateTime.now();
      _excludeFromStats = e.excludeFromStats;
      // recurring 的 amount 存的是 TWD；外幣需還原成原幣別金額再編輯。
      final rate = num.tryParse(e.fxRate) ?? 1;
      final shown = (_currency == 'TWD' || rate <= 0)
          ? e.amount
          : e.amount / rate;
      _amount.text = _fmtAmount(shown);
      if (_currency != 'TWD' && rate > 0 && rate != 1) _fxRate.text = e.fxRate;
      if (e.fxFee > 0) _fxFee.text = e.fxFee.round().toString();
    } else {
      _accountId = widget.accounts.isNotEmpty ? widget.accounts.first.id : null;
      final a = _selectedAccount;
      if (a != null) _currency = a.currency;
    }
  }

  static String _fmtAmount(num v) =>
      v % 1 == 0 ? v.toInt().toString() : v.toStringAsFixed(2);

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    _fxFee.dispose();
    _fxRate.dispose();
    super.dispose();
  }

  List<Category> get _cats =>
      widget.categories.where((c) => c.type == _type && !c.isParent).toList();

  Account? get _selectedAccount {
    for (final a in widget.accounts) {
      if (a.id == _accountId) return a;
    }
    return null;
  }

  bool get _overseasApplies {
    final a = _selectedAccount;
    return _type == 'expense' &&
        a != null &&
        a.category == 'credit_card' &&
        _currency != 'TWD' &&
        a.overseasFeeRate > 0;
  }

  List<String> get _currencyOptions => <String>{
    _currency,
    'TWD',
    for (final a in widget.accounts) a.currency,
    ..._kRecurringCurrencies,
  }.toList();

  String get _startStr =>
      '${_start.year}-${_start.month.toString().padLeft(2, '0')}-${_start.day.toString().padLeft(2, '0')}';

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final amount = num.parse(_amount.text.trim());
      final body = <String, dynamic>{
        'type': _type,
        'amount': amount,
        'currency': _currency,
        'categoryId': _categoryId,
        'accountId': _accountId,
        'frequency': _frequency,
        'startDate': _startStr,
        'note': _note.text.trim(),
        'excludeFromStats': _excludeFromStats,
      };
      if (_currency != 'TWD') {
        final rate = num.tryParse(_fxRate.text.trim());
        if (rate != null && rate > 0) body['fxRate'] = rate;
      }
      final feeText = _fxFee.text.trim();
      if (_overseasApplies && feeText.isNotEmpty) {
        body['fxFee'] = num.tryParse(feeText) ?? 0;
      }
      final api = ApiClient.instance;
      if (_isEdit) {
        await api.updateRecurring(widget.existing!.id, body);
      } else {
        await api.createRecurring(body);
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
    final cats = _cats;
    if (_categoryId != null && !cats.any((c) => c.id == _categoryId)) {
      _categoryId = null;
    }
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
                    ? trKey('featuresRecurringEdit')
                    : trKey('featuresRecurringAdd'),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              SizedBox(height: 16),
              SegmentedButton<String>(
                segments: [
                  ButtonSegment(
                    value: 'expense',
                    label: Text(trKey('dashboardOverviewExpense')),
                  ),
                  ButtonSegment(
                    value: 'income',
                    label: Text(trKey('dashboardOverviewIncome')),
                  ),
                ],
                selected: {_type},
                // 後端不允許編輯後變更類型，故編輯時鎖定。
                onSelectionChanged: _isEdit
                    ? null
                    : (s) => setState(() {
                        _type = s.first;
                        _categoryId = null;
                      }),
              ),
              SizedBox(height: 12),
              TextFormField(
                controller: _amount,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: trKey('dashboardTableAmount'),
                  border: OutlineInputBorder(),
                ),
                validator: (v) {
                  final n = num.tryParse(v?.trim() ?? '');
                  if (n == null || n <= 0) {
                    return trKey('mobileLegacyEnterAnAmountGreaterThan0');
                  }
                  return null;
                },
              ),
              SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _currency,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: trKey('featuresCommonCurrency'),
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
                SizedBox(height: 12),
                TextFormField(
                  controller: _fxRate,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: InputDecoration(
                    labelText: trKey('mobileDynamicExchangeRateForCurrency', {
                      'currency': _currency,
                    }),
                    helperText: trKey('featuresTransactionsFxRatePlaceholder'),
                    prefixIcon: Icon(Icons.currency_exchange),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) {
                    final s = v?.trim() ?? '';
                    if (s.isEmpty) return null;
                    final n = num.tryParse(s);
                    if (n == null || n <= 0) {
                      return trKey(
                        'mobileLegacyExchangeRateMustBeGreaterThan0',
                      );
                    }
                    return null;
                  },
                ),
              ],
              SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _frequency,
                decoration: InputDecoration(
                  labelText: trKey('mobileLegacyFrequency'),
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final e in _freqLabels.entries)
                    DropdownMenuItem(value: e.key, child: Text(e.value)),
                ],
                onChanged: (v) => setState(() => _frequency = v!),
              ),
              SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _categoryId,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: trKey('dashboardTableCategory'),
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final c in cats)
                    DropdownMenuItem(value: c.id, child: Text(c.name)),
                ],
                onChanged: (v) => setState(() => _categoryId = v),
                validator: (v) =>
                    v == null ? trKey('mobileLegacySelectACategory') : null,
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
                  for (final a in widget.accounts)
                    DropdownMenuItem(value: a.id, child: Text(a.name)),
                ],
                onChanged: (v) => setState(() {
                  _accountId = v;
                  final a = _selectedAccount;
                  if (a != null) {
                    _currency = a.currency;
                    _fxRate.clear();
                  }
                }),
                validator: (v) =>
                    v == null ? trKey('mobileLegacySelectAnAccount') : null,
              ),
              SizedBox(height: 12),
              ListTile(
                shape: RoundedRectangleBorder(
                  side: BorderSide(color: Theme.of(context).dividerColor),
                  borderRadius: BorderRadius.circular(4),
                ),
                leading: Icon(Icons.calendar_today),
                title: Text(trKey('featuresRecurringStartDate')),
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
              SizedBox(height: 12),
              TextFormField(
                controller: _note,
                decoration: InputDecoration(
                  labelText: trKey('mobileLegacyNoteOptional'),
                  border: OutlineInputBorder(),
                ),
              ),
              if (_overseasApplies) ...[
                SizedBox(height: 12),
                TextFormField(
                  controller: _fxFee,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: InputDecoration(
                    labelText: trKey(
                      'mobileLegacyForeignTransactionFeeInTwdOptional',
                    ),
                    helperText: trKey('mobileDynamicCardRateAutoFee', {
                      'rate': _selectedAccount!.overseasFeeRate,
                    }),
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(trKey('featuresCommonExcludeFromStats')),
                value: _excludeFromStats,
                onChanged: (v) => setState(() => _excludeFromStats = v),
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

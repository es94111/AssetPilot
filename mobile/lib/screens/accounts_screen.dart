import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';

Map<String, String> get _accountCategories => {
  'bank': trKey('mobileLegacyBank'),
  'credit_card': trKey('featuresAccountsTypeLabelsCredit_card'),
  'cash': trKey('featuresAccountsTypeLabelsCash'),
  'virtual_wallet': trKey('featuresAccountsTypeLabelsVirtual_wallet'),
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

  // 供 AppBar「信用卡還款」按鈕取用最近載入的帳戶清單。
  List<Account>? _lastAccounts;

  Future<void> _openRepayment(List<Account> accounts) async {
    final cards = accounts.where((a) => a.category == 'credit_card').toList();
    final payers = accounts.where((a) => a.category != 'credit_card').toList();
    if (cards.isEmpty || payers.isEmpty) {
      toast(context, trKey('mobileLegacyACreditCardAndANonCreditCard'));
      return;
    }
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _RepaymentSheet(cards: cards, payers: payers),
    );
    if (changed == true) {
      if (mounted) toast(context, trKey('mobileLegacyPaymentRecorded'));
      _reload();
    }
  }

  Future<void> _openForm([Account? account]) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AccountForm(existing: account),
    );
    if (changed == true) _reload();
  }

  Future<void> _delete(Account a) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('mobileLegacyDeleteAccount')),
        content: Text(
          trKey('mobileDynamicDeleteAccountName', {'name': a.name}),
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
      await ApiClient.instance.deleteAccount(a.id);
      if (mounted) toast(context, trKey('mobileLegacyDeleted'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(trKey('featuresCommonAccount')),
        actions: [
          IconButton(
            tooltip: trKey('featuresAccountsRepaymentTitle'),
            icon: Icon(Icons.credit_score_outlined),
            onPressed: _lastAccounts == null
                ? null
                : () => _openRepayment(_lastAccounts!),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: Icon(Icons.add),
        label: Text(trKey('featuresAccountsAddAccount')),
      ),
      body: AsyncView<List<Account>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) {
          _lastAccounts = list;
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.account_balance_wallet,
              message: trKey('notificationsEmptyNoAccount'),
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
                          trKey('mobileLegacyTotalAssetsInTwd'),
                          style: TextStyle(
                            color: Theme.of(
                              context,
                            ).colorScheme.onPrimaryContainer,
                          ),
                        ),
                        SizedBox(height: 6),
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
                    isThreeLine:
                        a.statementClosingDay != null &&
                        a.cycleSpending != null,
                    title: Text(a.name),
                    subtitle: _accountSubtitle(context, a),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          money(a.balance, a.currency),
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: a.balance < 0 ? Colors.red : null,
                          ),
                        ),
                        if (a.statementClosingDay != null)
                          IconButton(
                            tooltip: trKey('featuresAccountsCyclesTitle'),
                            icon: Icon(Icons.receipt_long_outlined),
                            onPressed: () => _openCycles(a),
                          ),
                      ],
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

  /// 帳戶副標題：類型／不計入註記，信用卡若已設結帳日再補一行「本期消費」。
  Widget _accountSubtitle(BuildContext context, Account a) {
    final base =
        '${_accountCategories[a.category] ?? a.category}'
        '${a.excludeFromTotal ? trKey('mobileLegacyMessagebde18a20') : ''}';
    if (a.statementClosingDay == null || a.cycleSpending == null) {
      return Text(base);
    }
    final range = (a.cycleStart != null && a.cycleEnd != null)
        ? '（${_md(a.cycleStart!)}–${_md(a.cycleEnd!)}）'
        : '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(base),
        SizedBox(height: 2),
        Text(
          trKey('mobileDynamicCurrentSpending', {
            'amount': money(a.cycleSpending!, a.currency),
            'range': range,
          }),
          style: TextStyle(
            color: Theme.of(context).colorScheme.error,
            fontWeight: FontWeight.w500,
          ),
        ),
        if (a.lastCycleSpending != null)
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: trKey('mobileLegacyPreviousStatement')),
                TextSpan(
                  text: trKey('mobileDynamicSpentAmount', {
                    'amount': money(a.lastCycleSpending!, a.currency),
                  }),
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
                TextSpan(text: ' / '),
                TextSpan(
                  text: trKey('mobileDynamicPaidAmount', {
                    'amount': money(a.lastCyclePayment ?? 0, a.currency),
                  }),
                  style: TextStyle(color: Color(0xFF2E7D32)),
                ),
              ],
            ),
            style: TextStyle(fontWeight: FontWeight.w500),
          ),
      ],
    );
  }

  /// 開啟信用卡每期帳單明細（底部彈窗）。
  Future<void> _openCycles(Account a) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _StatementCyclesSheet(account: a),
    );
  }

  /// 'YYYY-MM-DD' → 'M/D'
  String _md(String iso) {
    final m = RegExp(r'^\d{4}-(\d{2})-(\d{2})$').firstMatch(iso);
    if (m == null) return '';
    return '${int.parse(m.group(1)!)}/${int.parse(m.group(2)!)}';
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
  late final _closingDay = TextEditingController(
    text: (widget.existing?.statementClosingDay ?? 0) > 0
        ? widget.existing!.statementClosingDay.toString()
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
    _closingDay.dispose();
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
      final cd = _closingDay.text.trim();
      body['statementClosingDay'] = cd.isEmpty ? null : (int.tryParse(cd) ?? 0);
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
              _isEdit
                  ? trKey('featuresAccountsEditAccount')
                  : trKey('featuresAccountsAddAccount'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            SizedBox(height: 16),
            TextFormField(
              controller: _name,
              decoration: InputDecoration(
                labelText: trKey('mobileLegacyAccountName'),
                border: OutlineInputBorder(),
              ),
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? trKey('mobileLegacyEnterAName')
                  : null,
            ),
            SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: InputDecoration(
                labelText: trKey('featuresCommonType'),
                border: OutlineInputBorder(),
              ),
              items: [
                for (final e in _accountCategories.entries)
                  DropdownMenuItem(value: e.key, child: Text(e.value)),
              ],
              onChanged: (v) => setState(() => _category = v!),
            ),
            SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _currency,
                    decoration: InputDecoration(
                      labelText: trKey('featuresCommonCurrency'),
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      for (final c in _currencies)
                        DropdownMenuItem(value: c, child: Text(c)),
                    ],
                    onChanged: (v) => setState(() => _currency = v!),
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _initial,
                    enabled: !_isEdit,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
                    decoration: InputDecoration(
                      labelText: trKey('featuresAccountsInitialBalance'),
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            if (_category == 'credit_card') ...[
              SizedBox(height: 12),
              TextFormField(
                controller: _overseasFeeRate,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: trKey('featuresAccountsOverseasFeeRate'),
                  helperText: trKey('mobileLegacyExample15Means15FeesAre'),
                  border: OutlineInputBorder(),
                ),
              ),
              SizedBox(height: 12),
              TextFormField(
                controller: _closingDay,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: trKey('featuresAccountsStatementClosingDay'),
                  helperText: trKey(
                    'mobileLegacyWhenSetTheAccountCardShowsSpendingFor',
                  ),
                  border: OutlineInputBorder(),
                ),
                validator: (v) {
                  final s = v?.trim() ?? '';
                  if (s.isEmpty) return null;
                  final n = int.tryParse(s);
                  if (n == null || n < 1 || n > 31) {
                    return trKey('mobileLegacyEnterAValueFrom1To31');
                  }
                  return null;
                },
              ),
            ],
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(trKey('featuresAccountsExcludeFromTotal')),
              value: _exclude,
              onChanged: (v) => setState(() => _exclude = v),
            ),
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
      ),
    );
  }
}

/// 信用卡還款：自一個非信用卡帳戶轉出，清償一或多張信用卡。
/// 後端會為每張卡建立一對 transfer_out / transfer_in 交易。
class _RepaymentSheet extends StatefulWidget {
  final List<Account> cards;
  final List<Account> payers;
  const _RepaymentSheet({required this.cards, required this.payers});

  @override
  State<_RepaymentSheet> createState() => _RepaymentSheetState();
}

class _RepaymentSheetState extends State<_RepaymentSheet> {
  late String? _fromAccountId = widget.payers.first.id;
  DateTime _date = DateTime.now();
  late final Map<String, TextEditingController> _amounts = {
    for (final c in widget.cards) c.id: TextEditingController(),
  };
  bool _saving = false;

  @override
  void dispose() {
    for (final c in _amounts.values) {
      c.dispose();
    }
    super.dispose();
  }

  String get _dateStr =>
      '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  Future<void> _save() async {
    final repayments = <Map<String, dynamic>>[];
    for (final entry in _amounts.entries) {
      final amt = num.tryParse(entry.value.text.trim()) ?? 0;
      if (amt > 0) repayments.add({'cardId': entry.key, 'amount': amt});
    }
    if (repayments.isEmpty) {
      toast(context, trKey('mobileLegacyEnterAPaymentForAtLeastOneCard'));
      return;
    }
    setState(() => _saving = true);
    try {
      await ApiClient.instance.creditCardRepayment({
        'fromAccountId': _fromAccountId,
        'date': _dateStr,
        'repayments': repayments,
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
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              trKey('featuresAccountsRepaymentTitle'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _fromAccountId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: trKey('featuresAccountsRepaymentPaymentAccount'),
                border: OutlineInputBorder(),
              ),
              items: [
                for (final a in widget.payers)
                  DropdownMenuItem(
                    value: a.id,
                    child: Text(
                      '${a.name}${a.currency != 'TWD' ? '（${a.currency}）' : ''}',
                    ),
                  ),
              ],
              onChanged: (v) => setState(() => _fromAccountId = v),
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
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                trKey('mobileLegacyPaymentAmountForEachCardInCardCurrency'),
              ),
            ),
            SizedBox(height: 8),
            for (final c in widget.cards)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: TextFormField(
                  controller: _amounts[c.id],
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: InputDecoration(
                    labelText:
                        '${c.name}${c.currency != 'TWD' ? '（${c.currency}）' : ''}',
                    hintText: trKey('mobileLegacy0NoPayment'),
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
            SizedBox(height: 12),
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
                  : Text(trKey('featuresAccountsRepaymentConfirm')),
            ),
          ],
        ),
      ),
    );
  }
}

/// 信用卡每期帳單明細：每期顯示消費與實際繳款金額（以卡片幣別計）。
class _StatementCyclesSheet extends StatefulWidget {
  final Account account;
  const _StatementCyclesSheet({required this.account});

  @override
  State<_StatementCyclesSheet> createState() => _StatementCyclesSheetState();
}

class _StatementCyclesSheetState extends State<_StatementCyclesSheet> {
  late Future<List<StatementCycle>> _future;
  String _currency = 'TWD';

  @override
  void initState() {
    super.initState();
    _currency = widget.account.currency;
    _future = _load();
  }

  Future<List<StatementCycle>> _load() async {
    final m = await ApiClient.instance.accountStatementCycles(
      widget.account.id,
      count: 12,
    );
    final c = m['currency'];
    if (c is String && c.isNotEmpty) _currency = c;
    final list = (m['cycles'] as List?) ?? [];
    return list
        .map((e) => StatementCycle.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  String _md(String iso) {
    final m = RegExp(r'^\d{4}-(\d{2})-(\d{2})$').firstMatch(iso);
    if (m == null) return iso;
    return '${int.parse(m.group(1)!)}/${int.parse(m.group(2)!)}';
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            trKey('featuresAccountsCyclesTitle'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          SizedBox(height: 4),
          Text(
            trKey('mobileDynamicStatementCloses', {
              'name': widget.account.name,
              'day': widget.account.statementClosingDay,
            }),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          SizedBox(height: 4),
          Text(
            trKey('mobileLegacyPaymentsAreAssignedToTheStatementTheySettle'),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          SizedBox(height: 12),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.6,
            ),
            child: FutureBuilder<List<StatementCycle>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (snap.hasError) {
                  return Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: Text(
                        trKey('mobileDynamicFailedToLoad', {
                          'value': snap.error,
                        }),
                      ),
                    ),
                  );
                }
                final cycles = snap.data ?? [];
                if (cycles.isEmpty) {
                  return Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: Text(trKey('commonNoData'))),
                  );
                }
                return ListView.separated(
                  shrinkWrap: true,
                  itemCount: cycles.length,
                  separatorBuilder: (_, _) => Divider(height: 1),
                  itemBuilder: (context, i) {
                    final c = cycles[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Text('${_md(c.start)}–${_md(c.end)}'),
                                if (c.current) ...[
                                  SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.primaryContainer,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      trKey('featuresAccountsCyclesCurrent'),
                                      style: TextStyle(fontSize: 11),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                trKey('mobileDynamicSpentAmount', {
                                  'amount': money(c.spending, _currency),
                                }),
                                style: TextStyle(
                                  color: Color(0xFFD32F2F),
                                  fontSize: 13,
                                ),
                              ),
                              Text(
                                trKey('mobileDynamicPaidAmount', {
                                  'amount': money(c.payment, _currency),
                                }),
                                style: TextStyle(
                                  color: Color(0xFF2E7D32),
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

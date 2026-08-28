import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app_widget_sync.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';
import '../theme.dart';

class _BudgetData {
  final List<Budget> budgets;
  final Map<String, Category> catById;
  _BudgetData(this.budgets, this.catById);
}

class BudgetsScreen extends StatefulWidget {
  const BudgetsScreen({super.key});

  @override
  State<BudgetsScreen> createState() => _BudgetsScreenState();
}

class _BudgetsScreenState extends State<BudgetsScreen> {
  late DateTime _month;
  late Future<_BudgetData> _future;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
    _future = _load();
  }

  String get _ym => '${_month.year}-${_month.month.toString().padLeft(2, '0')}';

  Future<_BudgetData> _load() async {
    final api = ApiClient.instance;
    final raw = await api.budgets(_ym);
    final cats = await api.categories();
    final budgets = raw
        .map((e) => Budget.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    final categories = cats
        .map((e) => Category.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    final catById = {for (final category in categories) category.id: category};
    await AppWidgetSync.updateBudgetAlerts(
      yearMonth: _ym,
      budgets: budgets,
      categoryNames: {
        for (final category in categories) category.id: category.name,
      },
    );
    return _BudgetData(budgets, catById);
  }

  void _reload() => setState(() => _future = _load());

  void _shiftMonth(int delta) => setState(() {
    _month = DateTime(_month.year, _month.month + delta);
    _future = _load();
  });

  Future<void> _add() async {
    final cats = await ApiClient.instance.categories();
    final categories = cats
        .map((e) => Category.fromJson((e as Map).cast<String, dynamic>()))
        .where((c) => c.type == 'expense')
        .toList();
    if (!mounted) return;
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _BudgetForm(yearMonth: _ym, categories: categories),
    );
    if (changed == true) _reload();
  }

  Future<void> _delete(Budget b) async {
    try {
      await ApiClient.instance.deleteBudget(b.id);
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
        title: Text(trKey('mobileLegacyBudgets')),
        actions: [
          IconButton(
            onPressed: () => _shiftMonth(-1),
            icon: Icon(Icons.chevron_left),
          ),
          Center(child: Text(_ym)),
          IconButton(
            onPressed: () => _shiftMonth(1),
            icon: Icon(Icons.chevron_right),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        icon: Icon(Icons.add),
        label: Text(trKey('featuresBudgetAddBudget')),
      ),
      body: AsyncView<_BudgetData>(
        future: _future,
        onRetry: _reload,
        builder: (context, data) {
          if (data.budgets.isEmpty) {
            return EmptyState(
              icon: Icons.savings_outlined,
              title: trKey('mobileLegacyNoBudgetThisMonth'),
              message: trKey('featuresBudgetAddBudget'),
              onAction: _add,
              actionLabel: trKey('featuresBudgetAddBudget'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                ApSpace.lg,
                ApSpace.sm,
                ApSpace.lg,
                88,
              ),
              children: [
                for (final (i, b) in data.budgets.indexed)
                  StaggerIn(
                    index: i,
                    child: _BudgetTile(
                      budget: b,
                      name: b.categoryId == null
                          ? trKey('mobileLegacyMonthlyBudget')
                          : (data.catById[b.categoryId]?.name ??
                                trKey('mobileLegacyUnknownCategory')),
                      onDelete: () => _delete(b),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _BudgetTile extends StatelessWidget {
  final Budget budget;
  final String name;
  final VoidCallback onDelete;
  const _BudgetTile({
    required this.budget,
    required this.name,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final p = budget.progress;
    final tokens = apTokens(context);
    final color = p >= 1
        ? tokens.expense
        : p >= 0.9
        ? tokens.warning
        : p >= 0.7
        ? tokens.loss
        : tokens.income;
    return LedgerCard(
      margin: const EdgeInsets.only(bottom: ApSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                onPressed: onDelete,
                icon: Icon(Icons.delete_outline, size: 20),
              ),
            ],
          ),
          const SizedBox(height: ApSpace.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: p.clamp(0, 1).toDouble(),
              minHeight: 10,
              borderRadius: BorderRadius.circular(5),
              backgroundColor: color.withValues(alpha: 0.15),
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
          const SizedBox(height: ApSpace.xs + 2),
          Text.rich(
            TextSpan(
              text: twd(budget.used),
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: color,
              ),
              children: [
                TextSpan(
                  text: ' / ${twd(budget.amount)}',
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                TextSpan(
                  text: '　(${(p * 100).round()}%)',
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BudgetForm extends StatefulWidget {
  final String yearMonth;
  final List<Category> categories;
  const _BudgetForm({required this.yearMonth, required this.categories});

  @override
  State<_BudgetForm> createState() => _BudgetFormState();
}

class _BudgetFormState extends State<_BudgetForm> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  String? _categoryId; // null = 總預算
  bool _saving = false;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ApiClient.instance.createBudget({
        'categoryId': _categoryId,
        'amount': num.parse(_amount.text.trim()),
        'yearMonth': widget.yearMonth,
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
            Text(
              trKey('mobileDynamicAddBudgetForMonth', {
                'month': widget.yearMonth,
              }),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            SizedBox(height: 16),
            DropdownButtonFormField<String?>(
              initialValue: _categoryId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: trKey('dashboardTableCategory'),
                border: OutlineInputBorder(),
              ),
              items: [
                DropdownMenuItem(
                  value: null,
                  child: Text(trKey('mobileLegacyMonthlyBudget')),
                ),
                for (final c in widget.categories)
                  DropdownMenuItem(value: c.id, child: Text(c.name)),
              ],
              onChanged: (v) => setState(() => _categoryId = v),
            ),
            SizedBox(height: 12),
            TextFormField(
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: trKey('mobileLegacyBudgetAmount'),
                border: OutlineInputBorder(),
              ),
              validator: (v) {
                final n = num.tryParse(v?.trim() ?? '');
                if (n == null || n <= 0) {
                  return trKey('mobileLegacyEnterAPositiveWholeNumber');
                }
                return null;
              },
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

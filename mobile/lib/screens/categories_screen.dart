import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';
import '../l10n.dart';

const _palette = [
  // 分類色盤跟隨 Warm Console 暖色階（與 Web 圖表色盤同組）。
  '#B0521C',
  '#1E6B52',
  '#8A5A1F',
  '#B3372F',
  '#D98A4A',
  '#5F8D7A',
  '#C98A3D',
  '#9C4A3A',
  '#7D9464',
  '#A8683A',
];

class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 2, vsync: this);
  late Future<List<Category>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<List<Category>> _load() async {
    final list = await ApiClient.instance.categories();
    return list
        .map((e) => Category.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _openForm({Category? existing, List<Category>? all}) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _CategoryForm(
        existing: existing,
        type: _tab.index == 0 ? 'expense' : 'income',
        allCategories: all ?? [],
      ),
    );
    if (changed == true) _reload();
  }

  Future<void> _delete(Category c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('mobileLegacyDeleteCategory')),
        content: Text(
          trKey('mobileDynamicConfirmDeleteNamed', {'name': c.name}),
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
      await ApiClient.instance.deleteCategory(c.id);
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
        title: Text(trKey('dashboardTableCategory')),
        bottom: TabBar(
          controller: _tab,
          onTap: (_) => setState(() {}),
          tabs: [
            Tab(text: trKey('dashboardOverviewExpense')),
            Tab(text: trKey('dashboardOverviewIncome')),
          ],
        ),
      ),
      floatingActionButton: AsyncFab(
        future: _future,
        onPressed: (all) => _openForm(all: all),
      ),
      body: AsyncView<List<Category>>(
        future: _future,
        onRetry: _reload,
        builder: (context, all) => TabBarView(
          controller: _tab,
          children: [_buildList(all, 'expense'), _buildList(all, 'income')],
        ),
      ),
    );
  }

  Widget _buildList(List<Category> all, String type) {
    final parents = all.where((c) => c.type == type && c.isParent).toList();
    if (parents.isEmpty) {
      return EmptyState(
        icon: Icons.category,
        message: trKey('mobileLegacyNoCategoriesYet'),
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
          for (final p in parents) ...[
            LedgerCard(
              margin: const EdgeInsets.only(bottom: ApSpace.xs + 2),
              padding: EdgeInsets.zero,
              onTap: () => _openForm(existing: p, all: all),
              child: ListTile(
                leading: _dot(p.color),
                title: Text(
                  p.name,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                onTap: () => _openForm(existing: p, all: all),
                onLongPress: () => _delete(p),
              ),
            ),
            for (final child in all.where((c) => c.parentId == p.id))
              LedgerCard(
                margin: const EdgeInsets.only(bottom: ApSpace.xs + 2),
                padding: EdgeInsets.zero,
                onTap: () => _openForm(existing: child, all: all),
                child: ListTile(
                  contentPadding: const EdgeInsets.only(
                    left: 56,
                    right: ApSpace.lg,
                  ),
                  leading: _dot(child.color),
                  title: Text(child.name),
                  onTap: () => _openForm(existing: child, all: all),
                  onLongPress: () => _delete(child),
                ),
              ),
            const SizedBox(height: ApSpace.sm),
          ],
        ],
      ),
    );
  }

  Widget _dot(String color) => Container(
    width: 16,
    height: 16,
    decoration: BoxDecoration(color: parseColor(color), shape: BoxShape.circle),
  );
}

/// FAB 需要分類清單才能在表單裡選父分類，因此等 future 完成才啟用。
class AsyncFab extends StatelessWidget {
  final Future<List<Category>> future;
  final void Function(List<Category>) onPressed;
  const AsyncFab({super.key, required this.future, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Category>>(
      future: future,
      builder: (context, snap) => FloatingActionButton.extended(
        onPressed: snap.hasData ? () => onPressed(snap.data!) : null,
        icon: Icon(Icons.add),
        label: Text(trKey('featuresCategoriesAddCategory')),
      ),
    );
  }
}

class _CategoryForm extends StatefulWidget {
  final Category? existing;
  final String type;
  final List<Category> allCategories;
  const _CategoryForm({
    required this.existing,
    required this.type,
    required this.allCategories,
  });

  @override
  State<_CategoryForm> createState() => _CategoryFormState();
}

class _CategoryFormState extends State<_CategoryForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late String _type = widget.existing?.type ?? widget.type;
  late String _color = widget.existing?.color ?? _palette.first;
  late String? _parentId = widget.existing?.parentId.isNotEmpty == true
      ? widget.existing!.parentId
      : null;
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  List<Category> get _parentOptions => widget.allCategories
      .where(
        (c) => c.type == _type && c.isParent && c.id != widget.existing?.id,
      )
      .toList();

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final body = {
      'name': _name.text.trim(),
      'type': _type,
      'color': _color,
      'parentId': _parentId ?? '',
    };
    try {
      final api = ApiClient.instance;
      if (_isEdit) {
        await api.updateCategory(widget.existing!.id, body);
      } else {
        await api.createCategory(body);
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
                  ? trKey('featuresCategoriesEditCategory')
                  : trKey('featuresCategoriesAddCategory'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            SizedBox(height: 16),
            TextFormField(
              controller: _name,
              decoration: InputDecoration(
                labelText: trKey('mobileLegacyCategoryName'),
                border: OutlineInputBorder(),
              ),
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? trKey('mobileLegacyEnterAName')
                  : null,
            ),
            SizedBox(height: 12),
            if (!_isEdit)
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
                onSelectionChanged: (s) => setState(() {
                  _type = s.first;
                  _parentId = null;
                }),
              ),
            SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: _parentId,
              decoration: InputDecoration(
                labelText: trKey(
                  'mobileLegacyParentCategoryNoneCreatesAParent',
                ),
                border: OutlineInputBorder(),
              ),
              items: [
                DropdownMenuItem(
                  value: null,
                  child: Text(trKey('mobileLegacyNoneCreateAsParent')),
                ),
                for (final p in _parentOptions)
                  DropdownMenuItem(value: p.id, child: Text(p.name)),
              ],
              onChanged: (v) => setState(() => _parentId = v),
            ),
            SizedBox(height: 16),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                trKey('featuresCategoriesColorLabel'),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            SizedBox(height: 8),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final c in _palette)
                  GestureDetector(
                    onTap: () => setState(() => _color = c),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: parseColor(c),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _color == c
                              ? Theme.of(context).colorScheme.primary
                              : Colors.transparent,
                          width: 3,
                        ),
                      ),
                    ),
                  ),
              ],
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

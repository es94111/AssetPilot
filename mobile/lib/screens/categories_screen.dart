import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';

const _palette = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
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
        title: Text(tr('刪除分類')),
        content: Text(trPair('確定刪除「${c.name}」？', 'Delete “${c.name}”?')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(tr('取消')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(tr('刪除')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.deleteCategory(c.id);
      if (mounted) toast(context, tr('已刪除'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('分類')),
        bottom: TabBar(
          controller: _tab,
          onTap: (_) => setState(() {}),
          tabs: [
            Tab(text: tr('支出')),
            Tab(text: tr('收入')),
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
      return EmptyState(icon: Icons.category, message: tr('尚無分類'));
    }
    return RefreshIndicator(
      onRefresh: () async => _reload(),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 88),
        children: [
          for (final p in parents) ...[
            ListTile(
              leading: _dot(p.color),
              title: Text(
                p.name,
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              onTap: () => _openForm(existing: p, all: all),
              onLongPress: () => _delete(p),
            ),
            for (final child in all.where((c) => c.parentId == p.id))
              ListTile(
                contentPadding: const EdgeInsets.only(left: 48, right: 16),
                leading: _dot(child.color),
                title: Text(child.name),
                onTap: () => _openForm(existing: child, all: all),
                onLongPress: () => _delete(child),
              ),
            Divider(height: 1),
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
        label: Text(tr('新增分類')),
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
              _isEdit ? tr('編輯分類') : tr('新增分類'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            SizedBox(height: 16),
            TextFormField(
              controller: _name,
              decoration: InputDecoration(
                labelText: tr('分類名稱'),
                border: OutlineInputBorder(),
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? tr('請輸入名稱') : null,
            ),
            SizedBox(height: 12),
            if (!_isEdit)
              SegmentedButton<String>(
                segments: [
                  ButtonSegment(value: 'expense', label: Text(tr('支出'))),
                  ButtonSegment(value: 'income', label: Text(tr('收入'))),
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
                labelText: tr('父分類（不選＝建立父分類）'),
                border: OutlineInputBorder(),
              ),
              items: [
                DropdownMenuItem(value: null, child: Text(tr('（無，作為父分類）'))),
                for (final p in _parentOptions)
                  DropdownMenuItem(value: p.id, child: Text(p.name)),
              ],
              onChanged: (v) => setState(() => _parentId = v),
            ),
            SizedBox(height: 16),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                tr('顏色'),
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
                  : Text(tr('儲存')),
            ),
          ],
        ),
      ),
    );
  }
}

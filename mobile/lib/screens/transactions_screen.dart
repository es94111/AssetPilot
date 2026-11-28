import 'dart:async';

import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app_widget_sync.dart';
import '../format.dart';
import '../models.dart';
import '../offline/offline_draft_service.dart';
import '../platform/notification_capture.dart';
import '../widgets.dart';
import '../theme.dart';
import 'transaction_form_screen.dart';
import 'notification_capture_screens.dart';
import 'offline_drafts_screen.dart';
import '../l10n.dart';

class TransactionsScreen extends StatefulWidget {
  final VoidCallback? onLedgerChanged;
  final VoidCallback? onTransactionsChanged;
  final int transactionsRevision;

  const TransactionsScreen({
    super.key,
    this.onLedgerChanged,
    this.onTransactionsChanged,
    this.transactionsRevision = 0,
  });

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsData {
  final List<Txn> items;
  final Map<String, String> catName;
  final List<Account> accounts;
  final List<Category> categories; // 篩選下拉用：父分類 + 其子分類（依序）
  const _TransactionsData(
    this.items,
    this.catName,
    this.accounts,
    this.categories,
  );
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  late Future<_TransactionsData> _future;
  String _filter = 'all';
  final _search = TextEditingController();
  Timer? _searchDebounce;
  // 進階篩選
  DateTime? _dateFrom;
  DateTime? _dateTo;
  String? _filterAccountId;
  String? _filterCategoryId;
  String _keyword = '';

  bool get _hasFilters => _activeFilterCount > 0 || _keyword.isNotEmpty;

  int get _activeFilterCount => [
    _filter != 'all',
    _dateFrom != null || _dateTo != null,
    _filterAccountId != null,
    _filterCategoryId != null,
  ].where((active) => active).length;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  static String _ymd(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  void didUpdateWidget(covariant TransactionsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.transactionsRevision != oldWidget.transactionsRevision) {
      _future = _load();
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _updateSearch(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted || value.trim() == _keyword) return;
      _keyword = value.trim();
      _reload();
    });
  }

  void _transactionsChanged() {
    if (!mounted) return;
    final onChanged = widget.onTransactionsChanged;
    if (onChanged == null) {
      _reload();
    } else {
      onChanged();
    }
  }

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
    // 篩選下拉用清單：父分類（可選＝該父分類底下全部）後接其子分類，與 WEB 一致。
    // 選父分類時送出父分類 id，後端會自動展開為其所有子分類。無子分類的父分類略過
    // （交易只會掛在子分類，選了也篩不到任何結果）。
    final filterCats = <Category>[];
    for (final p in categories.where((c) => c.isParent)) {
      final children = categories.where((c) => c.parentId == p.id).toList();
      if (children.isEmpty) continue;
      filterCats.add(p);
      filterCats.addAll(children);
    }
    return _TransactionsData(items, catName, accounts, filterCats);
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _refreshDashboardWidget() async {
    try {
      final now = DateTime.now();
      final ym = '${now.year}-${now.month.toString().padLeft(2, '0')}';
      final json = await ApiClient.instance.dashboard(ym);
      await AppWidgetSync.updateDashboard(Dashboard.fromJson(json));
    } catch (_) {
      // 小工具同步失敗不應阻斷交易操作。
    }
  }

  Future<void> _openFilters(_TransactionsData data) async {
    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _TxnFilterSheet(
        accounts: data.accounts,
        categories: data.categories,
        dateFrom: _dateFrom,
        dateTo: _dateTo,
        accountId: _filterAccountId,
        categoryId: _filterCategoryId,
        type: _filter,
        onClear: _clearFilters,
        onApply: (type, from, to, accountId, categoryId) {
          setState(() {
            _filter = type;
            _dateFrom = from;
            _dateTo = to;
            _filterAccountId = accountId;
            _filterCategoryId = categoryId;
          });
        },
      ),
    );
    if (applied == true && mounted) _reload();
  }

  void _clearFilters() {
    _searchDebounce?.cancel();
    _search.clear();
    setState(() {
      _filter = 'all';
      _dateFrom = null;
      _dateTo = null;
      _filterAccountId = null;
      _filterCategoryId = null;
      _keyword = '';
    });
    _reload();
  }

  Future<void> _openForm([Txn? txn]) async {
    if (ApiClient.instance.activeLedgerReadOnly) return;
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TransactionFormScreen(existing: txn)),
    );
    if (changed == true) _transactionsChanged();
  }

  /// 刪除一筆交易（需確認）。回傳是否真的刪除成功，供滑動刪除判斷是否移除列項。
  Future<bool> _delete(Txn t) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('mobileLegacyDeleteTransaction')),
        content: Text(
          trKey('mobileDynamicDeleteTransactionCompact', {'date': t.date}),
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
    if (ok != true || ApiClient.instance.activeLedgerReadOnly) return false;
    try {
      await ApiClient.instance.deleteTransaction(t.id);
      await _refreshDashboardWidget();
      if (mounted) toast(context, trKey('mobileLegacyDeleted'));
      _transactionsChanged();
      return true;
    } catch (e) {
      if (mounted) toast(context, '$e');
      return false;
    }
  }

  /// 還原「AI 建立」的交易（需確認）：整組移除（含連動的轉帳／手續費交易）。
  Future<void> _openRepaymentSummary(String summaryId) async {
    try {
      final data = await ApiClient.instance.getRepaymentSummary(summaryId);
      final summary = RepaymentSummary.fromJson(data);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(trKey('featuresTransactionsRepaymentSummaryTitle')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (summary.stale)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      trKey('featuresTransactionsRepaymentSummaryStale'),
                      style: TextStyle(color: apTokens(context).warning),
                    ),
                  ),
                Text('${trKey('dashboardTableDate')}：${summary.date}'),
                Text(
                  '${trKey('featuresAccountsRepaymentPaymentAccount')}：${summary.fromAccountName}',
                ),
                Text(
                  '${trKey('featuresTransactionsRepaymentSummaryTotal')}：${summary.totalAmount} ${summary.fromAccountCurrency}',
                ),
                SizedBox(height: 12),
                for (final a in summary.allocations)
                  ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(a.cardName),
                    subtitle: Text(_summaryStatusKey(a.status)),
                    trailing: Text('${a.amount} ${a.cardCurrency}'),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(trKey('commonClose')),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  String _summaryStatusKey(String status) {
    switch (status) {
      case 'modified':
        return trKey('featuresTransactionsRepaymentSummaryStatusModified');
      case 'deleted':
        return trKey('featuresTransactionsRepaymentSummaryStatusDeleted');
      default:
        return trKey('featuresTransactionsRepaymentSummaryStatusIntact');
    }
  }

  Future<void> _restoreAiCreated(Txn t) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('featuresTransactionsRestoreCreatedTitle')),
        content: Text(trKey('featuresTransactionsRestoreCreatedMessage')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(trKey('commonConfirm')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.restoreAiCreatedTransaction(t.id);
      await _refreshDashboardWidget();
      if (mounted) toast(context, trKey('mobileLegacyDeleted'));
      _transactionsChanged();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  /// 還原「備註經 AI 修改」的交易（需確認）：先抓取預覽快照，備註復原為 AI 修改前的文字。
  Future<void> _restoreAiNote(Txn t) async {
    Map<String, dynamic> snapshot;
    try {
      snapshot = await ApiClient.instance.getAiNoteSnapshot(t.id);
    } catch (e) {
      if (mounted) toast(context, '$e');
      return;
    }
    if (!mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('featuresTransactionsRestoreNoteTitle')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(trKey('featuresTransactionsRestoreNoteConfirmMessage')),
            const SizedBox(height: 12),
            Text(
              trKey('featuresTransactionsRestoreNoteCurrentLabel'),
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            Text('${snapshot['currentNote'] ?? ''}'),
            const SizedBox(height: 8),
            Text(
              trKey('featuresTransactionsRestoreNotePreviewLabel'),
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            Text('${snapshot['preAiNote'] ?? ''}'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(trKey('commonConfirm')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.restoreAiNote(
        t.id,
        snapshot['updatedAt'] as num,
      );
      await _refreshDashboardWidget();
      if (mounted) toast(context, trKey('mobileLegacyDeleted'));
      _transactionsChanged();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  Future<void> _openDrafts() async {
    final source = !NotificationCapturePlatform.supported.value
        ? 'offline'
        : await showModalBottomSheet<String>(
            context: context,
            useSafeArea: true,
            builder: (context) => SafeArea(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.all(ApSpace.lg),
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      trKey('uxDrafts'),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.edit_note_outlined),
                    title: Text(trKey('offlineDraftsTitle')),
                    onTap: () => Navigator.pop(context, 'offline'),
                  ),
                  if (NotificationCapturePlatform.supported.value)
                    ListTile(
                      leading: const Icon(Icons.receipt_long_outlined),
                      title: Text(trKey('notificationCaptureDrafts')),
                      onTap: () => Navigator.pop(context, 'notification'),
                    ),
                ],
              ),
            ),
          );
    if (!mounted || source == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => source == 'offline'
            ? const OfflineDraftsScreen()
            : NotificationDraftsScreen(
                onLedgerChanged: widget.onLedgerChanged,
                onPosted: _transactionsChanged,
              ),
      ),
    );
    _transactionsChanged();
  }

  @override
  Widget build(BuildContext context) {
    final readOnly = ApiClient.instance.activeLedgerReadOnly;
    return Scaffold(
      appBar: AppBar(title: Text(trKey('mobileLegacyTransactions8084a8ea'))),
      // viewer 帳本不顯示新增入口（伺服器端同樣會拒絕寫入）。
      floatingActionButton: ApiClient.instance.activeLedgerReadOnly
          ? null
          : RecordButton(onPressed: () => _openForm()),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              ApSpace.lg,
              0,
              ApSpace.lg,
              ApSpace.sm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (readOnly)
                  Padding(
                    padding: const EdgeInsets.only(bottom: ApSpace.sm),
                    child: Text(trKey('ledgerReadOnlyNotice')),
                  ),
                TextField(
                  controller: _search,
                  onChanged: _updateSearch,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    labelText: trKey('mobileLegacyNoteKeyword'),
                    prefixIcon: const Icon(Icons.search),
                  ),
                ),
                const SizedBox(height: ApSpace.sm),
                FutureBuilder<_TransactionsData>(
                  future: _future,
                  builder: (context, snapshot) {
                    final data = snapshot.data;
                    final count = _activeFilterCount;
                    final summary = [
                      if (_filter != 'all') _typeLabel(_filter),
                      if (_dateFrom case final from?) _ymd(from),
                      if (_dateTo case final to?) _ymd(to),
                      if (_filterAccountId != null && data != null)
                        ...data.accounts
                            .where((item) => item.id == _filterAccountId)
                            .map((item) => item.name),
                      if (_filterCategoryId != null && data != null)
                        ...data.categories
                            .where((item) => item.id == _filterCategoryId)
                            .map((item) => item.name),
                    ];
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: ApSpace.sm,
                          runSpacing: ApSpace.xs,
                          children: [
                            OutlinedButton.icon(
                              onPressed: data == null
                                  ? null
                                  : () => _openFilters(data),
                              icon: const Icon(Icons.tune),
                              label: Text(
                                count == 0
                                    ? trKey('mobileLegacyFilter')
                                    : "${trKey('mobileLegacyFilter')} ($count)",
                              ),
                            ),
                            ValueListenableBuilder<int>(
                              valueListenable:
                                  OfflineDraftService.instance.pendingCount,
                              builder: (context, offlineCount, _) =>
                                  ValueListenableBuilder(
                                    valueListenable:
                                        NotificationCapturePlatform.snapshot,
                                    builder: (context, snapshot, _) {
                                      final draftCount =
                                          (OfflineDraftService
                                                      .instance
                                                      .ledgerId ==
                                                  ApiClient
                                                      .instance
                                                      .activeLedgerId
                                              ? offlineCount
                                              : 0) +
                                          (NotificationCapturePlatform
                                                  .supported
                                                  .value
                                              ? snapshot.drafts.length
                                              : 0);
                                      final label = trKey('uxDrafts');
                                      return TextButton.icon(
                                        onPressed: _openDrafts,
                                        icon: const Icon(
                                          Icons.edit_note_outlined,
                                        ),
                                        label: Text(
                                          draftCount == 0
                                              ? label
                                              : '$label ($draftCount)',
                                        ),
                                      );
                                    },
                                  ),
                            ),
                          ],
                        ),
                        if (summary.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: ApSpace.sm),
                            child: Text(summary.join(' · ')),
                          ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: AsyncView<_TransactionsData>(
              future: _future,
              onRetry: _reload,
              builder: (context, data) {
                final list = data.items;
                if (list.isEmpty) {
                  return EmptyState(
                    icon: Icons.receipt_long,
                    message: trKey(
                      _hasFilters
                          ? 'mobileLegacyNoTransactionsMatchTheseFilters'
                          : readOnly
                          ? 'ledgerReadOnlyNotice'
                          : 'uxEmptyLedgerHint',
                    ),
                    onAction: _hasFilters ? _clearFilters : null,
                    actionLabel: _hasFilters
                        ? trKey('mobileLegacyClearFilters')
                        : null,
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async => _reload(),
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(
                      ApSpace.md + 2,
                      ApSpace.sm,
                      ApSpace.md + 2,
                      96,
                    ),
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    itemCount: list.length,
                    itemBuilder: (context, i) {
                      final t = list[i];
                      return StaggerIn(
                        index: i,
                        child: Dismissible(
                          key: ValueKey(t.id),
                          direction: readOnly
                              ? DismissDirection.none
                              : DismissDirection.endToStart,
                          // 由 confirmDismiss 跳出確認並執行刪除；回傳 false 時列項不會被移除。
                          confirmDismiss: (_) => _delete(t),
                          background: Container(
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.error,
                              borderRadius: ApRadius.rMd,
                            ),
                            alignment: Alignment.centerRight,
                            padding: const EdgeInsets.symmetric(
                              horizontal: ApSpace.xl,
                            ),
                            child: const Icon(
                              Icons.delete,
                              color: Colors.white,
                            ),
                          ),
                          child: _TxnTile(
                            t: t,
                            categoryName: data.catName[t.categoryId],
                            onTap: readOnly
                                ? null
                                : () => t.type == 'transfer'
                                      ? toast(
                                          context,
                                          trKey(
                                            'mobileLegacyEditTransfersInTheWebApp',
                                          ),
                                        )
                                      : t.isFxFee
                                      ? toast(
                                          context,
                                          trKey(
                                            'mobileLegacyForeignCardFeesAreGeneratedAutomaticallyEditThe',
                                          ),
                                        )
                                      : _openForm(t),
                            onLongPress: readOnly ? null : () => _delete(t),
                            onDelete: readOnly ? null : () => _delete(t),
                            onRestoreCreated: !readOnly && t.aiCreated
                                ? () => _restoreAiCreated(t)
                                : null,
                            onRestoreNote: !readOnly && t.noteAiModified
                                ? () => _restoreAiNote(t)
                                : null,
                            onViewRepaymentSummary:
                                t.repaymentSummaryId.isNotEmpty
                                ? () => _openRepaymentSummary(
                                    t.repaymentSummaryId,
                                  )
                                : null,
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TxnTile extends StatelessWidget {
  final Txn t;
  final String? categoryName;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final VoidCallback? onDelete;
  final VoidCallback? onRestoreCreated;
  final VoidCallback? onRestoreNote;
  final VoidCallback? onViewRepaymentSummary;
  const _TxnTile({
    required this.t,
    required this.categoryName,
    required this.onTap,
    required this.onLongPress,
    required this.onDelete,
    this.onRestoreCreated,
    this.onRestoreNote,
    this.onViewRepaymentSummary,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isIncome = t.type == 'income';
    final isTransfer = t.type == 'transfer';
    final color = isTransfer
        ? scheme.onSurfaceVariant
        : flowColor(income: isIncome, context: context);
    final icon = isTransfer
        ? Icons.swap_horiz
        : (isIncome ? Icons.south_west : Icons.north_east);
    final sign = isTransfer ? '' : (isIncome ? '+' : '-');
    final title = categoryName?.isNotEmpty == true
        ? categoryName!
        : t.catName?.isNotEmpty == true
        ? t.catName!
        : (isTransfer
              ? trKey('featuresTransactionsTransfer')
              : (t.note.isEmpty ? trKey('dashboardUncategorized') : t.note));

    return LedgerCard(
      margin: const EdgeInsets.only(bottom: ApSpace.sm),
      padding: EdgeInsets.zero,
      onTap: onTap,
      child: ListTile(
        onTap: onTap,
        onLongPress: onLongPress,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: ApSpace.md + 2,
          vertical: ApSpace.xs,
        ),
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.14),
          child: Icon(icon, color: color, size: 20),
        ),
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Wrap(
          spacing: 6,
          runSpacing: 2,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(t.date),
            if (t.note.isNotEmpty &&
                (categoryName?.isNotEmpty == true ||
                    t.catName?.isNotEmpty == true))
              Text(t.note, maxLines: 1, overflow: TextOverflow.ellipsis),
            if (t.attachmentCount > 0)
              _TxnMeta(
                icon: Icons.image_outlined,
                label: '${t.attachmentCount}',
              ),
            if (t.aiCreated)
              _TxnMeta(
                icon: Icons.auto_awesome_outlined,
                label: trKey('featuresTransactionsAiCreated'),
              ),
            if (t.noteAiModified)
              _TxnMeta(
                icon: Icons.edit_note_outlined,
                label: trKey('featuresTransactionsNoteAiModified'),
              ),
            if (t.repaymentSummaryId.isNotEmpty)
              _TxnMeta(
                icon: Icons.account_balance_wallet_outlined,
                label: trKey('featuresTransactionsViewRepaymentAllocation'),
              ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedTextSwap(
              // 外幣交易顯示原幣別金額（如 USD 100），TWD 交易維持台幣金額。
              text: sign + money(t.originalAmount, t.currency),
              style: TextStyle(fontWeight: FontWeight.w700, color: color),
            ),
            if (onDelete != null ||
                onRestoreCreated != null ||
                onRestoreNote != null ||
                onViewRepaymentSummary != null)
              PopupMenuButton<String>(
                tooltip: trKey('mobileLegacyMore'),
                onSelected: (value) {
                  switch (value) {
                    case 'delete':
                      onDelete?.call();
                      break;
                    case 'restore-created':
                      onRestoreCreated?.call();
                      break;
                    case 'restore-note':
                      onRestoreNote?.call();
                      break;
                    case 'repayment':
                      onViewRepaymentSummary?.call();
                      break;
                  }
                },
                itemBuilder: (_) => [
                  if (onRestoreCreated != null)
                    PopupMenuItem(
                      value: 'restore-created',
                      child: Text(trKey('featuresTransactionsRestoreCreated')),
                    ),
                  if (onRestoreNote != null)
                    PopupMenuItem(
                      value: 'restore-note',
                      child: Text(trKey('featuresTransactionsRestoreNote')),
                    ),
                  if (onViewRepaymentSummary != null)
                    PopupMenuItem(
                      value: 'repayment',
                      child: Text(
                        trKey('featuresTransactionsViewRepaymentAllocation'),
                      ),
                    ),
                  if (onDelete != null)
                    PopupMenuItem(
                      value: 'delete',
                      child: Text(
                        trKey('commonDelete'),
                        style: TextStyle(color: scheme.error),
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

class _TxnMeta extends StatelessWidget {
  final IconData icon;
  final String label;

  const _TxnMeta({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurfaceVariant;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 2),
        Text(label, style: TextStyle(fontSize: 12, color: color)),
      ],
    );
  }
}

String _typeLabel(String type) => trKey(switch (type) {
  'expense' => 'dashboardOverviewExpense',
  'income' => 'dashboardOverviewIncome',
  'transfer' => 'featuresTransactionsTransfer',
  _ => 'mobileLegacyAll',
});

/// 交易進階篩選：類型、日期區間、帳戶與分類。
class _TxnFilterSheet extends StatefulWidget {
  final List<Account> accounts;
  final List<Category> categories; // 父分類 + 其子分類（依序）
  final DateTime? dateFrom;
  final DateTime? dateTo;
  final String? accountId;
  final String? categoryId;
  final String type;
  final VoidCallback onClear;
  final void Function(
    String type,
    DateTime? from,
    DateTime? to,
    String? accountId,
    String? categoryId,
  )
  onApply;

  const _TxnFilterSheet({
    required this.accounts,
    required this.categories,
    required this.dateFrom,
    required this.dateTo,
    required this.accountId,
    required this.categoryId,
    required this.type,
    required this.onClear,
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
  late String _type = widget.type;

  static String _ymd(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _pick(bool isFrom) async {
    final d = await showDatePicker(
      context: context,
      initialDate: (isFrom ? _from : _to) ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (d != null && mounted) setState(() => isFrom ? _from = d : _to = d);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    // 下拉值需存在於選項中，否則重設為 null（全部）。
    final accountId = widget.accounts.any((a) => a.id == _accountId)
        ? _accountId
        : null;
    final categoryId = widget.categories.any((c) => c.id == _categoryId)
        ? _categoryId
        : null;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              trKey('mobileLegacyFilterTransactions'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: ApSpace.md),
            DropdownButtonFormField<String>(
              initialValue: _type,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: trKey('featuresCommonType'),
              ),
              items: [
                for (final type in ['all', 'expense', 'income', 'transfer'])
                  DropdownMenuItem(value: type, child: Text(_typeLabel(type))),
              ],
              onChanged: (type) {
                if (type != null) setState(() => _type = type);
              },
            ),
            SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: Icon(Icons.calendar_today, size: 18),
                    label: Text(
                      _from == null
                          ? trKey('mobileLegacyStartDate')
                          : _ymd(_from!),
                    ),
                    onPressed: () => _pick(true),
                  ),
                ),
                SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: Icon(Icons.event, size: 18),
                    label: Text(
                      _to == null ? trKey('mobileLegacyEndDate') : _ymd(_to!),
                    ),
                    onPressed: () => _pick(false),
                  ),
                ),
                if (_from != null || _to != null)
                  IconButton(
                    icon: Icon(Icons.clear),
                    tooltip: trKey('mobileLegacyClearDates'),
                    onPressed: () => setState(() {
                      _from = null;
                      _to = null;
                    }),
                  ),
              ],
            ),
            SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: accountId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: trKey('featuresCommonAccount'),
                border: OutlineInputBorder(),
              ),
              items: [
                DropdownMenuItem(
                  value: null,
                  child: Text(trKey('mobileLegacyAllAccounts')),
                ),
                for (final a in widget.accounts)
                  DropdownMenuItem(value: a.id, child: Text(a.name)),
              ],
              onChanged: (v) => setState(() => _accountId = v),
            ),
            SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: categoryId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: trKey('dashboardTableCategory'),
                border: OutlineInputBorder(),
              ),
              items: [
                DropdownMenuItem(
                  value: null,
                  child: Text(trKey('mobileLegacyAllCategories')),
                ),
                // 父分類顯示「名稱（全部）」並可選；選了會篩出該父分類底下所有交易。
                // 子分類縮排顯示於所屬父分類之下。
                for (final c in widget.categories)
                  DropdownMenuItem(
                    value: c.id,
                    child: Text(
                      c.isParent
                          ? trKey('mobileDynamicAllForName', {'name': c.name})
                          : '  ${c.name}',
                      style: c.isParent
                          ? TextStyle(fontWeight: FontWeight.w600)
                          : null,
                    ),
                  ),
              ],
              onChanged: (v) => setState(() => _categoryId = v),
            ),
            SizedBox(height: 12),
            TextButton(
              onPressed: () {
                widget.onClear();
                Navigator.pop(context);
              },
              child: Text(trKey('mobileLegacyClearFilters')),
            ),
            FilledButton(
              onPressed: (_from != null && _to != null && _from!.isAfter(_to!))
                  ? null
                  : () {
                      widget.onApply(
                        _type,
                        _from,
                        _to,
                        _accountId,
                        _categoryId,
                      );
                      Navigator.pop(context, true);
                    },
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(trKey('mobileLegacyApply')),
            ),
          ],
        ),
      ),
    );
  }
}

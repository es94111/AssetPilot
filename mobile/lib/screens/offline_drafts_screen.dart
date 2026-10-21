import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n.dart';
import '../offline/connectivity_service.dart';
import '../offline/offline_draft_core.dart';
import '../offline/offline_draft_service.dart';
import '../widgets.dart';

/// 離線草稿清單：讓使用者檢視、逐筆或一次確認送出。
///
/// 驗收要點（計畫書 5.5）：
/// - 草稿明確標示「尚未入帳」，不計入正式餘額。
/// - 送出前重新送出；後端確認成功後才移除本地草稿。
/// - 失敗可重試、修改或捨棄，不顯示虛假的成功訊息。
class OfflineDraftsScreen extends StatefulWidget {
  const OfflineDraftsScreen({super.key});

  @override
  State<OfflineDraftsScreen> createState() => _OfflineDraftsScreenState();
}

class _OfflineDraftsScreenState extends State<OfflineDraftsScreen> {
  late Future<List<OfflineDraft>> _future;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = OfflineDraftService.instance.list();
  }

  void _reload() =>
      setState(() => _future = OfflineDraftService.instance.list());

  Future<void> _submit(OfflineDraft draft) async {
    setState(() => _busy = true);
    final result = await OfflineDraftService.instance.submit(draft);
    if (!mounted) return;
    setState(() => _busy = false);
    if (result.isSynced) {
      toast(context, trKey('offlineDraftsSynced'));
    } else {
      toast(context, result.message);
    }
    _reload();
  }

  Future<void> _submitAll() async {
    final drafts = await OfflineDraftService.instance.list();
    final pending = drafts
        .where((d) => d.status == OfflineDraftStatus.pending)
        .toList();
    if (pending.isEmpty) return;
    if (!mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(trKey('offlineDraftsConfirmSubmitAll')),
        content: Text(
          trKey('offlineDraftsSubmitAllHint', {'count': pending.length}),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(trKey('offlineDraftsSubmitAll')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    if (!mounted) return;

    setState(() => _busy = true);
    final results = await OfflineDraftService.instance.submitAll();
    if (!mounted) return;
    setState(() => _busy = false);
    final posted = results
        .where((r) => r.isSynced || r.isPostedWithPendingPhotos)
        .length;
    final pendingPhotos = results.fold<int>(
      0,
      (count, result) => count + result.pendingPhotoCount,
    );
    final failed = results
        .where((r) => r.outcome == DraftSubmitOutcome.failed)
        .length;
    if (posted > 0) {
      toast(context, trKey('offlineDraftsSyncedCount', {'count': posted}));
    }
    if (pendingPhotos > 0) {
      toast(
        context,
        trKey('offlineDraftsPhotoPending', {'count': pendingPhotos}),
      );
    }
    if (failed > 0) {
      toast(context, trKey('offlineDraftsFailedCount', {'count': failed}));
    }
    _reload();
  }

  Future<void> _discard(OfflineDraft draft) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(trKey('offlineDraftsDiscardTitle')),
        content: Text(trKey('offlineDraftsDiscardHint')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(trKey('commonDelete')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await OfflineDraftService.instance.discard(draft);
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(trKey('offlineDraftsTitle')),
        actions: [
          ValueListenableBuilder<bool>(
            valueListenable: ConnectivityService.instance.isOnline,
            builder: (context, online, _) => Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Text(
                  online
                      ? trKey('offlineDraftsOnline')
                      : trKey('offlineDraftsOffline'),
                  style: TextStyle(
                    fontSize: 12,
                    color: online
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.error,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: FutureBuilder<List<OfflineDraft>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final drafts = snapshot.data ?? const <OfflineDraft>[];
          if (drafts.isEmpty) {
            return Center(child: Text(trKey('offlineDraftsEmpty')));
          }
          final pending = drafts
              .where((d) => d.status == OfflineDraftStatus.pending)
              .toList();
          return Column(
            children: [
              if (pending.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          trKey('offlineDraftsPendingHint', {
                            'count': pending.length,
                          }),
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                      FilledButton(
                        onPressed: _busy ? null : _submitAll,
                        child: Text(trKey('offlineDraftsSubmitAll')),
                      ),
                    ],
                  ),
                ),
              Expanded(
                child: ListView.separated(
                  itemCount: drafts.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) => _tile(drafts[index]),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _tile(OfflineDraft draft) {
    final amount = draft.payload['amount'];
    final currency = '${draft.payload['currency'] ?? ''}';
    final date = '${draft.payload['date'] ?? ''}';
    final note = '${draft.payload['note'] ?? ''}';
    final type = '${draft.payload['type'] ?? 'expense'}';
    final isIncome = type == 'income';

    return ListTile(
      leading: Icon(
        draft.status == OfflineDraftStatus.failed
            ? Icons.error_outline
            : isIncome
            ? Icons.trending_up
            : Icons.trending_down,
        color: draft.status == OfflineDraftStatus.failed
            ? Theme.of(context).colorScheme.error
            : null,
      ),
      title: Text(
        '$amount $currency',
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            draft.postedTransactionId == null
                ? trKey('offlineDraftsNotPostedYet')
                : trKey('offlineDraftsSynced'),
          ),
          if (date.isNotEmpty) Text(date),
          if (note.isNotEmpty) Text(note),
          if (draft.photoPaths.isNotEmpty)
            Text(
              trKey('offlineDraftsPhotoPending', {
                'count': draft.photoPaths.length,
              }),
            ),
          Text(
            trKey('offlineDraftsSavedAt', {
              'time': DateFormat('yyyy-MM-dd HH:mm').format(draft.createdAt),
            }),
          ),
          if (draft.lastError != null)
            Text(
              draft.lastError!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
        ],
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: trKey('offlineDraftsSubmit'),
            icon: const Icon(Icons.send),
            onPressed: _busy ? null : () => _submit(draft),
          ),
          IconButton(
            tooltip: trKey('offlineDraftsDiscardTitle'),
            icon: const Icon(Icons.delete_outline),
            onPressed: _busy ? null : () => _discard(draft),
          ),
        ],
      ),
    );
  }
}

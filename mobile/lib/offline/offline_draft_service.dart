import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../api_client.dart';
import '../l10n.dart';
import 'offline_draft_core.dart';
import 'offline_draft_store.dart';

abstract class OfflineDraftApi {
  Future<void> transfer(Map<String, dynamic> body);

  Future<Map<String, dynamic>> createTransaction(Map<String, dynamic> body);

  Future<void> uploadTransactionPhotos(
    String transactionId,
    List<String> paths,
  );
}

class _ApiOfflineDraftApi implements OfflineDraftApi {
  const _ApiOfflineDraftApi();

  @override
  Future<void> transfer(Map<String, dynamic> body) =>
      ApiClient.instance.transfer(body);

  @override
  Future<Map<String, dynamic>> createTransaction(Map<String, dynamic> body) =>
      ApiClient.instance.createTransaction(body);

  @override
  Future<void> uploadTransactionPhotos(
    String transactionId,
    List<String> paths,
  ) async {
    await ApiClient.instance.uploadTransactionPhotos(transactionId, paths);
  }
}

/// 離線草稿的協調層：保存、確認送出、失敗處理與狀態通知。
///
/// 與後端的關係：
/// - 送出時一律帶 `clientRef`，後端以 `(user_id, client_ref)` 唯一鍵去重，
///   因此逾時或結果不明時可以用同一識別重試，不會重複入帳。
/// - 只有後端回應成功後才移除本地草稿；失敗時保留草稿並標記原因，
///   讓使用者可以重試、修改或捨棄。
class OfflineDraftService {
  OfflineDraftService._() {
    // 監聽登入狀態：登出（或 session 過期）時必須停止自動重試，
    // 否則會在未登入狀態下嘗試送出草稿。
    // 草稿本身**不會**被刪除——它依「使用者 + 帳本」分檔保存，
    // 同一帳號下次登入仍可找回（計畫書 5.5）。
    ApiClient.instance.authState.addListener(() {
      if (!ApiClient.instance.isLoggedIn) pause();
    });
  }

  static final OfflineDraftService instance = OfflineDraftService._();

  @visibleForTesting
  static OfflineDraftApi? overrideApi;

  /// 草稿狀態變更通知；畫面 listen 這個 notifier 更新待處理筆數。
  final ValueNotifier<int> pendingCount = ValueNotifier<int>(0);

  Timer? _retryTimer;

  String _userId = '';
  String _ledgerId = '';

  String get userId => _userId;
  String get ledgerId => _ledgerId;

  /// 綁定目前使用者與帳本。切換時先停止自動重試，避免把前一帳本的草稿
  /// 在新帳號下送出。
  Future<void> bind({required String userId, required String ledgerId}) async {
    if (_userId == userId && _ledgerId == ledgerId) return;
    _userId = userId;
    _ledgerId = ledgerId;
    _retryTimer?.cancel();
    _retryTimer = null;
    await OfflineDraftStore.recoverInterruptedSends(userId, ledgerId);
    await OfflineDraftStore.rememberUserId(userId);
    await refreshCount();
  }

  /// 網路不可用但登入 Cookie 仍在時，還原上次驗證過的使用者分檔。
  Future<bool> restoreRememberedBinding({required String ledgerId}) async {
    if (!ApiClient.instance.isLoggedIn) return false;
    final userId = await OfflineDraftStore.readRememberedUserId();
    if (userId == null) return false;
    await bind(userId: userId, ledgerId: ledgerId);
    return true;
  }

  /// 帳本切換時只換帳本、不換使用者，不需要網路。尚未綁定使用者時略過
  /// （初次綁定會在取得使用者後讀取最新的帳本 id）。
  Future<void> bindLedger(String ledgerId) async {
    if (_userId.isEmpty) return;
    await bind(userId: _userId, ledgerId: ledgerId);
  }

  /// 讀出目前帳本底下的草稿。
  Future<List<OfflineDraft>> list() =>
      OfflineDraftStore.load(_userId, _ledgerId);

  /// 更新待處理筆數（供 UI 顯示徽章）。
  Future<void> refreshCount() async {
    final drafts = await list();
    pendingCount.value = drafts.where(isOutstanding).length;
  }

  /// 保存一筆草稿（離線或使用者主動選擇「稍後送出」）。
  ///
  /// 若 [clientRef] 已存在則覆寫該筆（同一草稿的後續編輯），
  /// 否則建立新草稿並附上照片副本。
  Future<OfflineDraft> save({
    required Map<String, dynamic> payload,
    OfflineDraftKind kind = OfflineDraftKind.transaction,
    String? clientRef,
    List<String> photoPaths = const [],
  }) async {
    final drafts = await list();
    final ref = clientRef ?? newClientRef(_random);
    final now = DateTime.now();
    final existing = drafts.where((d) => d.clientRef == ref).firstOrNull;
    final savedPhotos = photoPaths.isEmpty
        ? (existing?.photoPaths ?? const <String>[])
        : await OfflineDraftStore.persistPhotos(photoPaths);
    final draft = OfflineDraft(
      clientRef: ref,
      kind: kind,
      ledgerId: _ledgerId,
      payload: payload,
      status: OfflineDraftStatus.pending,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      attempts: existing?.attempts ?? 0,
      photoPaths: savedPhotos,
    );
    final next = [...drafts.where((d) => d.clientRef != ref), draft]
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    await OfflineDraftStore.save(_userId, _ledgerId, next);
    await refreshCount();
    return draft;
  }

  /// 送出草稿。成功才移除本地資料。
  ///
  /// 回傳 [DraftSubmitResult]，讓 UI 能區分「已入帳」與「仍待處理」，
  /// 不顯示虛假的成功訊息。
  Future<DraftSubmitResult> submit(OfflineDraft draft) async {
    final drafts = await list();
    final current = drafts
        .where((d) => d.clientRef == draft.clientRef)
        .firstOrNull;
    if (current == null) {
      return const DraftSubmitResult(
        outcome: DraftSubmitOutcome.missing,
        message: '草稿已不存在，可能已被送出或捨棄',
      );
    }

    // 送出前重新驗證登入、帳本與權限（計畫書 5.5）。登入與帳本不符屬於
    // App 當下的狀態而非草稿本身的問題，因此不改動草稿；唯讀則寫入失敗原因，
    // 讓使用者在清單上看得到為何無法送出。
    final gate = await checkDraftSendGate(
      current.ledgerId,
      overrideSendContext ?? const _ApiDraftSendContext(),
    );
    switch (gate) {
      case DraftSendGate.notLoggedIn:
        return _notLoggedInResult;
      case DraftSendGate.otherLedger:
        return _otherLedgerResult;
      case DraftSendGate.readOnly:
        return _handleFailure(current, 403, trKey('ledgerReadOnlyNotice'));
      case DraftSendGate.ok:
        break;
    }

    final api = overrideApi ?? const _ApiOfflineDraftApi();
    var inProgress = current.copyWith(status: OfflineDraftStatus.sending);
    await _persist(inProgress);

    final body = buildSubmitBody(inProgress);
    try {
      if (inProgress.kind == OfflineDraftKind.transfer) {
        await api.transfer(body);
      } else {
        var transactionId = inProgress.postedTransactionId;
        if (transactionId == null || transactionId.isEmpty) {
          final created = await api.createTransaction(body);
          transactionId = '${created['id'] ?? ''}';
          if (transactionId.isEmpty && inProgress.photoPaths.isNotEmpty) {
            throw StateError('Transaction response did not include an ID');
          }
          if (inProgress.photoPaths.isNotEmpty) {
            // 先保存已建立的交易 ID；重啟或照片失敗後只重試附件，不重複記帳。
            inProgress = inProgress.copyWith(
              status: OfflineDraftStatus.sending,
              postedTransactionId: transactionId,
            );
            await _persist(inProgress);
          }
        }
        if (inProgress.photoPaths.isNotEmpty) {
          if (transactionId.isEmpty) {
            return await _handlePhotoUploadFailure(inProgress);
          }
          try {
            await api.uploadTransactionPhotos(
              transactionId,
              inProgress.photoPaths,
            );
          } catch (_) {
            return await _handlePhotoUploadFailure(inProgress);
          }
        }
      }
      await OfflineDraftStore.remove(_userId, _ledgerId, inProgress.clientRef);
      await OfflineDraftStore.deletePhotos(inProgress.photoPaths);
      await refreshCount();
      return const DraftSubmitResult(
        outcome: DraftSubmitOutcome.synced,
        message: '已入帳',
      );
    } on ApiException catch (e) {
      return await _handleFailure(current, e.statusCode, e.message);
    } catch (e) {
      return await _handleFailure(current, 0, '$e');
    }
  }

  Future<DraftSubmitResult> _handlePhotoUploadFailure(
    OfflineDraft draft,
  ) async {
    final message =
        '${trKey('offlineDraftsSynced')} · '
        '${trKey('offlineDraftsPhotoPending', {'count': draft.photoPaths.length})}';
    final failed = draft.copyWith(
      status: OfflineDraftStatus.failed,
      attempts: draft.attempts + 1,
      lastError: message,
    );
    await _persist(failed);
    await refreshCount();
    return DraftSubmitResult(
      outcome: DraftSubmitOutcome.postedPhotoPending,
      message: message,
      pendingPhotoCount: draft.photoPaths.length,
    );
  }

  Future<DraftSubmitResult> _handleFailure(
    OfflineDraft draft,
    int statusCode,
    String message,
  ) async {
    final attempts = draft.attempts + 1;
    final retryable = isRetryableStatus(statusCode);
    // 自動重試次數用完，或遇到不可重試的 4xx：標為 failed 交由使用者決定。
    final exhausted = attempts >= maxAutoAttempts;
    final status = (!retryable || exhausted)
        ? OfflineDraftStatus.failed
        : OfflineDraftStatus.pending;
    await _persist(
      draft.copyWith(status: status, attempts: attempts, lastError: message),
    );
    await refreshCount();
    if (status == OfflineDraftStatus.pending) {
      _scheduleRetry(draft.clientRef, attempts);
    }
    return DraftSubmitResult(
      outcome: status == OfflineDraftStatus.failed
          ? DraftSubmitOutcome.failed
          : DraftSubmitOutcome.retryLater,
      message: message,
      retryable: retryable,
    );
  }

  Future<void> _persist(OfflineDraft draft) async {
    final drafts = await list();
    final next = drafts
        .map((d) => d.clientRef == draft.clientRef ? draft : d)
        .toList();
    await OfflineDraftStore.save(_userId, _ledgerId, next);
  }

  /// 指數退避後自動重試一次；使用者尚未確認前不改變「已入帳」語意。
  void _scheduleRetry(String clientRef, int attempts) {
    _retryTimer?.cancel();
    _retryTimer = Timer(
      Duration(milliseconds: retryDelayMs(attempts)),
      () async {
        final drafts = await list();
        final draft = drafts.where((d) => d.clientRef == clientRef).firstOrNull;
        if (draft == null) return;
        if (draft.status != OfflineDraftStatus.pending) return;
        await submit(draft);
      },
    );
  }

  /// 捨棄草稿（使用者明確放棄）。已入帳的草稿不應出現在這裡。
  Future<void> discard(OfflineDraft draft) async {
    await OfflineDraftStore.remove(_userId, _ledgerId, draft.clientRef);
    await OfflineDraftStore.deletePhotos(draft.photoPaths);
    await refreshCount();
  }

  /// 送出所有等待確認的草稿。
  ///
  /// **恢復連線時只呼叫這裡的「提示」而非直接入帳**：本方法供使用者
  /// 明確按下「全部送出」時使用；App 啟動或網路恢復時只更新狀態。
  Future<List<DraftSubmitResult>> submitAll() async {
    final drafts = await list();
    final results = <DraftSubmitResult>[];
    for (final draft in drafts) {
      if (!isAwaitingConfirmation(draft) &&
          draft.status != OfflineDraftStatus.failed) {
        continue;
      }
      results.add(await submit(draft));
    }
    return results;
  }

  /// 登出時停止自動重試，避免在未登入狀態下送出草稿。
  void pause() {
    _retryTimer?.cancel();
    _retryTimer = null;
  }

  static final Random _random = Random.secure();

  @visibleForTesting
  static DraftSendContext? overrideSendContext;

  static const DraftSubmitResult _notLoggedInResult = DraftSubmitResult(
    outcome: DraftSubmitOutcome.failed,
    message: '尚未登入，請先登入後再送出草稿',
  );

  static const DraftSubmitResult _otherLedgerResult = DraftSubmitResult(
    outcome: DraftSubmitOutcome.failed,
    message: '草稿屬於其他帳本，請切換回該帳本後再送出',
  );
}

class _ApiDraftSendContext implements DraftSendContext {
  const _ApiDraftSendContext();

  @override
  bool get isLoggedIn => ApiClient.instance.isLoggedIn;

  @override
  String get activeLedgerId => ApiClient.instance.activeLedgerId;

  @override
  Future<bool> refreshLedgerReadOnly() =>
      ApiClient.instance.refreshLedgerRole();
}

/// 草稿送出結果。
enum DraftSubmitOutcome {
  /// 後端已確認入帳。
  synced,

  /// 交易已入帳，但照片仍待補上傳。
  postedPhotoPending,

  /// 暫時性失敗，稍後自動重試。
  retryLater,

  /// 失敗且需使用者決定（重試／修改／捨棄）。
  failed,

  /// 草稿已不存在。
  missing,
}

class DraftSubmitResult {
  final DraftSubmitOutcome outcome;
  final String message;

  /// 失敗是否值得再次嘗試（4xx 驗證錯誤為 false）。
  final bool retryable;

  /// 交易已入帳但附件尚未成功上傳的照片數。
  final int pendingPhotoCount;

  const DraftSubmitResult({
    required this.outcome,
    required this.message,
    this.retryable = false,
    this.pendingPhotoCount = 0,
  });

  bool get isSynced => outcome == DraftSubmitOutcome.synced;

  bool get isPostedWithPendingPhotos =>
      outcome == DraftSubmitOutcome.postedPhotoPending;
}

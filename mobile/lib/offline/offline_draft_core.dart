import 'dart:math';

/// 離線記帳草稿的純邏輯：資料形狀、狀態機與送出決策。
///
/// 本檔不得 import 任何 Flutter／平台 API，以便在純 Dart 測試中驗證。
/// 持久化（`offline_draft_store.dart`）與實際送出（`offline_draft_service.dart`）
/// 分別負責 I/O 與網路，本檔只定義「什麼狀態、什麼時候該做什麼」。
///
/// 設計要點（對應計畫書 5.5）：
/// - 草稿一律不計入正式餘額或 Widget 收支；要等使用者確認且後端回應成功才算入帳。
/// - 每筆草稿帶穩定的冪等識別（`clientRef`），逾時或結果不明時以同一識別重試，
///   不會重複入帳。
/// - 草稿依「使用者 + 帳本」隔離，切換帳號不會送出前一帳號的草稿。

/// 草稿狀態。
///
/// - [editing]：使用者仍在表單中編輯，尚未保存。
/// - [pending]：已保存，等待使用者確認送出。
/// - [sending]：正在送出。
/// - [synced]：後端已確認入帳（本地會盡快移除）。
/// - [failed]：送出失敗，可重試、修改或捨棄。
enum OfflineDraftStatus { editing, pending, sending, synced, failed }

/// 草稿類型：一般收支或轉帳（兩者打不同端點、驗證條件不同）。
enum OfflineDraftKind { transaction, transfer }

/// 一筆離線草稿。
class OfflineDraft {
  /// 冪等識別：client 產生，送出時原樣帶給後端。後端以
  /// `(user_id, client_ref)` 唯一鍵去重，重送不會產生第二筆交易。
  final String clientRef;

  final OfflineDraftKind kind;

  /// 草稿所屬帳本；空字串代表個人帳本。
  final String ledgerId;

  /// 送出時原樣 POST 的請求本體（金額、幣別、日期、分類、帳戶、備註等）。
  final Map<String, dynamic> payload;

  final OfflineDraftStatus status;

  final DateTime createdAt;

  final DateTime updatedAt;

  /// 已嘗試送出次數（第一次送出前為 0）。
  final int attempts;

  /// 最後一次失敗訊息，供 UI 顯示。
  final String? lastError;

  /// 後端已建立的交易 ID；有值時重試只補傳照片，不會再建立交易。
  final String? postedTransactionId;

  /// 照片附件的路徑。離線草稿以文字為主（計畫書 5.5），
  /// 附件另存於 App 私有目錄並於此記錄，避免使用者以為照片已保存。
  final List<String> photoPaths;

  const OfflineDraft({
    required this.clientRef,
    required this.kind,
    required this.ledgerId,
    required this.payload,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.attempts = 0,
    this.lastError,
    this.postedTransactionId,
    this.photoPaths = const [],
  });

  OfflineDraft copyWith({
    OfflineDraftStatus? status,
    int? attempts,
    String? lastError,
    String? postedTransactionId,
    List<String>? photoPaths,
    Map<String, dynamic>? payload,
  }) {
    return OfflineDraft(
      clientRef: clientRef,
      kind: kind,
      ledgerId: ledgerId,
      payload: payload ?? this.payload,
      status: status ?? this.status,
      createdAt: createdAt,
      updatedAt: DateTime.now(),
      attempts: attempts ?? this.attempts,
      lastError: lastError,
      postedTransactionId: postedTransactionId ?? this.postedTransactionId,
      photoPaths: photoPaths ?? this.photoPaths,
    );
  }

  Map<String, dynamic> toJson() => {
    'clientRef': clientRef,
    'kind': kind.name,
    'ledgerId': ledgerId,
    'payload': payload,
    'status': status.name,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'attempts': attempts,
    if (lastError != null) 'lastError': lastError,
    if (postedTransactionId != null) 'postedTransactionId': postedTransactionId,
    'photoPaths': photoPaths,
  };

  /// 解析持久化資料；形狀不合法回傳 null（外來資料一律不信任）。
  static OfflineDraft? fromJson(Object? value) {
    if (value is! Map) return null;
    final clientRef = value['clientRef'];
    if (clientRef is! String || clientRef.isEmpty) return null;
    final kindName = value['kind'];
    final kind = kindName == 'transfer'
        ? OfflineDraftKind.transfer
        : OfflineDraftKind.transaction;
    final payload = value['payload'];
    if (payload is! Map) return null;
    final statusName = value['status'];
    final status = OfflineDraftStatus.values.firstWhere(
      (s) => s.name == statusName,
      orElse: () => OfflineDraftStatus.pending,
    );
    final createdAt =
        DateTime.tryParse('${value['createdAt'] ?? ''}') ?? DateTime.now();
    final updatedAt =
        DateTime.tryParse('${value['updatedAt'] ?? ''}') ?? createdAt;
    final attempts = value['attempts'];
    final photoPaths = value['photoPaths'];
    return OfflineDraft(
      clientRef: clientRef,
      kind: kind,
      ledgerId: '${value['ledgerId'] ?? ''}',
      payload: payload.cast<String, dynamic>(),
      status: status,
      createdAt: createdAt,
      updatedAt: updatedAt,
      attempts: attempts is int && attempts > 0 ? attempts : 0,
      lastError: value['lastError'] is String
          ? value['lastError'] as String
          : null,
      postedTransactionId: value['postedTransactionId'] is String
          ? value['postedTransactionId'] as String
          : null,
      photoPaths: photoPaths is List
          ? photoPaths.map((e) => '$e').toList(growable: false)
          : const [],
    );
  }
}

/// 草稿是否為「等待使用者確認」——恢復連線時只提示，不自動入帳。
bool isAwaitingConfirmation(OfflineDraft draft) =>
    draft.status == OfflineDraftStatus.pending;

/// 草稿是否佔用「待處理」計數（含失敗待處理）。
bool isOutstanding(OfflineDraft draft) =>
    draft.status == OfflineDraftStatus.pending ||
    draft.status == OfflineDraftStatus.sending ||
    draft.status == OfflineDraftStatus.failed;

/// 送出失敗是否值得自動重試。
///
/// 可重試：連線錯誤、逾時、429、5xx。
/// 不可重試：4xx 驗證／權限錯誤（例如帳戶已被刪除、只讀帳本），
/// 這類必須讓使用者決定「重試／修改／捨棄」，不能自動重送。
bool isRetryableStatus(int statusCode) {
  if (statusCode == 0) return true; // 連線錯誤
  if (statusCode == 408 || statusCode == 429) return true;
  return statusCode >= 500;
}

/// 草稿是否屬於目前使用中的帳本；空字串代表個人帳本。
///
/// 送出一律使用全域的 `x-ledger-id`，草稿所屬帳本與目前帳本不同時必須拒絕，
/// 避免把 A 帳本的草稿寫進 B 帳本（計畫書 5.5）。
bool isDraftForLedger(String draftLedgerId, String activeLedgerId) =>
    draftLedgerId.trim() == activeLedgerId.trim();

/// 送出前檢查的結果（計畫書 5.5「送出前重新驗證登入、帳本權限」）。
enum DraftSendGate { ok, notLoggedIn, otherLedger, readOnly }

/// [checkDraftSendGate] 需要的外部狀態；以介面隔開 `ApiClient`，
/// 讓檢查順序可以不靠網路進行單元測試。
abstract class DraftSendContext {
  bool get isLoggedIn;

  String get activeLedgerId;

  /// 向伺服器重新確認目前帳本的角色，回傳是否唯讀。
  Future<bool> refreshLedgerReadOnly();
}

/// 依序檢查：登入 → 草稿所屬帳本 → 帳本是否唯讀。
///
/// 帳本不符不需要網路，所以排在唯讀查詢之前。唯讀查詢期間 session 可能過期，
/// 因此回來後要再確認一次登入。
Future<DraftSendGate> checkDraftSendGate(
  String draftLedgerId,
  DraftSendContext context,
) async {
  if (!context.isLoggedIn) return DraftSendGate.notLoggedIn;
  if (!isDraftForLedger(draftLedgerId, context.activeLedgerId)) {
    return DraftSendGate.otherLedger;
  }
  final readOnly = await context.refreshLedgerReadOnly();
  if (!context.isLoggedIn) return DraftSendGate.notLoggedIn;
  return readOnly ? DraftSendGate.readOnly : DraftSendGate.ok;
}

/// 自動重試次數上限；超過即標為 failed，交由使用者決定。
const int maxAutoAttempts = 5;

/// 指數退避基準（毫秒）。
const int retryBaseDelayMs = 5000;

/// 指數退避上限（毫秒）。
const int retryMaxDelayMs = 5 * 60 * 1000;

/// 依失敗次數計算下次自動重試的等待時間。
int retryDelayMs(int attempts) {
  if (attempts <= 0) return 0;
  final delay = retryBaseDelayMs * (1 << (attempts - 1));
  return delay > retryMaxDelayMs ? retryMaxDelayMs : delay;
}

/// 產生 client 端冪等識別（32 碼十六進位，與後端 uid() 形狀一致）。
String newClientRef(Random random) {
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}

/// 送出後要帶給後端的本體：把冪等識別放進 `clientRef`。
///
/// 伺服器以 `(user_id, client_ref)` 唯一鍵去重，因此逾時後用同一識別重試
/// 不會產生第二筆交易，也不會因為換識別而重複入帳。
Map<String, dynamic> buildSubmitBody(OfflineDraft draft) {
  return {...draft.payload, 'clientRef': draft.clientRef};
}

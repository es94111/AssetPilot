import 'dart:async';

import 'app_link_service.dart';

/// 深層連結入口的共用判斷與暫存。
///
/// ## 為什麼需要這層
///
/// Widget 與 Siri 捷徑都用 `assetpilot://transaction/new?...` 開啟 App，
/// 但連結可能在「尚未登入」的狀態下送達（例如使用者在鎖定畫面用
/// Widget 快速記帳、或 Siri 在背景喚醒 App）。此時主畫面尚未建立，
/// 連結若直接丟掉，使用者就會看到 App 打開後停在登入頁，剛才輸入的
/// 金額不翼而飛。
///
/// 計畫書第 5.4 節要求「冷啟動／重新登入後仍可安全接續確認」，
/// 因此這裡把待處理的連結存起來，等登入完成後再交給主畫面處理。
///
/// 平台的差異（iOS 走自訂原生通道、Android 走 `app_links`）由
/// [AppLinkService] 隱藏，本類別只處理「業務規則」。
///
/// ## 連結格式
///
/// - `assetpilot://transaction/new?type=expense&amount=120&category=餐費`
///   — 開啟記帳表單（Widget 與 Siri 共用）。
/// - `assetpilot://ledger/invite?token=…`
///   — 開啟共享帳本邀請。
class DeepLinkService {
  DeepLinkService._();

  static final DeepLinkService instance = DeepLinkService._();

  /// 記帳入口與共享帳本邀請所使用的 host。
  ///
  /// 登入回呼（`google-callback`／`line-callback`／`auth-ticket`）屬於
  /// 另一條流程，不在這裡處理，因此取回冷啟動連結時會以這組 host 過濾，
  /// 避免把登入回呼誤當成記帳入口。
  static const List<String> entryHosts = ['transaction', 'ledger'];

  /// 同一個連結在這段時間內只會被處理一次。
  ///
  /// 冷啟動的連結可能同時走兩條路徑抵達 Dart 端：原生層在事件通道
  /// 訂閱時補送（推播），以及呼叫端在主畫面建立時取回（拉取）。
  /// 計畫書第 5.4 節要求「相同呼叫不可因重複交接產生兩筆交易」，
  /// 因此這裡以短時間窗做去重。時間窗刻意設得很短（2 秒），
  /// 使用者在 Widget 上再次點擊（需要離開 App 再回來）不會被誤擋。
  static const Duration dedupWindow = Duration(seconds: 2);

  final AppLinkService _appLinks = AppLinkService.instance;
  StreamSubscription<Uri>? _subscription;

  /// 尚未被主畫面接走的連結。
  ///
  /// 非 null 代表「有連結等著被處理」。主畫面在建立時會先取走
  /// （[takePending]），避免同一個連結被處理兩次。
  Uri? _pending;

  /// 最近觀察到的連結及其時間戳（毫秒）。用於 [dedupWindow] 內的去重。
  final Map<String, int> _handled = <String, int>{};

  /// 連結串流：每次有新的 `assetpilot://` 連結送達時發出。
  final StreamController<Uri> _controller = StreamController<Uri>.broadcast();

  /// 連結串流：每次有新的 `assetpilot://` 連結送達時發出。
  Stream<Uri> get links => _controller.stream;

  /// 開始監聽系統傳來的深層連結。App 啟動時呼叫一次即可。
  Future<void> start() async {
    // 先訂閱 Dart 端的事件串流，再啟動原生端的監聽。
    // 順序很重要：原生層在事件通道訂閱的那一刻就會補送「待處理連結」，
    // 若這時 Dart 端還沒訂閱事件串流，補送的那一筆就會被漏掉。
    _subscription ??= _appLinks.links.listen(
      _handle,
      onError: (_) {},
    );
    await _appLinks.start();
  }

  /// 讀取冷啟動時系統帶來的連結（App 尚未執行就被喚醒）。
  ///
  /// 冷啟動的連結只會回傳一次，不寫入 [_pending]：此時 App 已經在
  /// 啟動流程中，呼叫端（主畫面）會直接處理它。
  ///
  /// 只取記帳入口類的連結（[entryHosts]），登入回呼由各自的流程處理。
  Future<Uri?> initialLink() async {
    final uri = await _appLinks.takeInitialLink(hosts: entryHosts);
    if (uri == null || !isSupported(uri)) return null;
    // 若這個連結已經處理過（例如事件串流已先一步送達），就不再重複處理。
    if (_seenRecently(uri)) return null;
    return uri;
  }

  /// 取走目前待處理的連結（若有）。取走後 [_pending] 會被清空，
  /// 確保同一個連結不會被重複處理。
  Uri? takePending() {
    final uri = _pending;
    _pending = null;
    return uri;
  }

  /// 標記 [uri] 已被處理：若 [_pending] 正是它，就清掉。
  ///
  /// 避免「主畫面已就緒時收到連結」的路徑把連結留在 [_pending]，
  /// 日後登出再登入時被重複開啟。
  void consume(Uri uri) {
    if (_pending == uri) _pending = null;
    _markSeen(uri);
  }

  /// 清除尚未被主畫面接走的連結。
  ///
  /// 登出、切換帳號或權限失效時呼叫（計畫書 5.2 步驟 7：
  /// 「同步清除或隔離 Widget 快照、離線草稿與待處理的捷徑輸入」）。
  /// 未清除的話，上一個帳號收到的捷徑連結會在下一個帳號登入後
  /// 被取出，等於把別人的輸入帶進新帳號。
  ///
  /// 只清「待處理」，不碰 [_handled] 去重紀錄：去重紀錄的作用是
  /// 避免同一筆連結被重複交接，跨帳號清除反而可能讓同一個連結
  /// 在短時間內被處理兩次。
  Future<void> clearPending() async {
    _pending = null;
    await _appLinks.clearPending();
  }

  /// 判斷連結是否是本 App 支援的深層連結。
  static bool isSupported(Uri uri) =>
      uri.scheme == 'assetpilot' &&
      (uri.host == 'transaction' || uri.host == 'ledger');

  /// 記住連結並通知訂閱者。
  void _handle(Uri uri) {
    if (!isSupported(uri)) return;
    // 同一個連結在短時間內重複送達時只處理一次。
    if (_seenRecently(uri)) return;
    // 先存起來：若此刻主畫面尚未就緒（未登入），[takePending] 會在
    // 登入後取走它；主畫面已就緒時則會在同一個事件迴圈內立即取走。
    _pending = uri;
    if (!_controller.isClosed) _controller.add(uri);
  }

  /// 判斷 [uri] 是否已在 [dedupWindow] 內處理過。
  bool _seenRecently(Uri uri) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final key = uri.toString();
    final last = _handled[key];
    final withinWindow =
        last != null && (now - last) <= dedupWindow.inMilliseconds;
    if (!withinWindow) {
      _handled[key] = now;
    }
    // 清掉過期的紀錄，避免 Map 無限成長。
    _handled.removeWhere((_, ts) => (now - ts) > dedupWindow.inMilliseconds);
    return withinWindow;
  }

  /// 記錄 [uri] 已被觀察到。
  void _markSeen(Uri uri) {
    _handled[uri.toString()] = DateTime.now().millisecondsSinceEpoch;
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
    await _controller.close();
  }
}

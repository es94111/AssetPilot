import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/services.dart';

import 'platform_info.dart';

/// 跨平台的深層連結／App Link 收發點。
///
/// ## 為什麼 iOS 要自己走原生通道
///
/// `app_links` 套件在 iOS 上有兩個限制，會讓 Widget／Siri 開啟的連結
/// 送不到 Dart 端（詳見 `ios/Runner/DeepLinkChannel.swift` 的說明）：
///
/// 1. 插件透過 `registrar.addSceneDelegate(...)` 註冊場景代理，而本專案
///    使用 `FlutterImplicitEngineDelegate`，插件註冊時機晚於場景連線，
///    **冷啟動**時帶在 `connectionOptions.urlContexts` 的連結不會被看見。
/// 2. 插件的 `handleLink(url:)` 在 Dart 端尚未訂閱事件通道時直接丟棄連結。
///
/// 因此 iOS 改由自訂的原生事件通道接收
/// （見 `ios/Runner/DeepLinkChannel.swift`），Android 則沿用 `app_links`。
/// 本類別把兩者包成同一個 API，讓上層（記帳入口、OAuth 回呼）不必分平台。
///
/// ## 兩個通道名稱不可共用
///
/// `FlutterMethodChannel` 與 `FlutterEventChannel` 底層都用
/// `setMessageHandlerOnChannel:` 註冊處理器，Flutter 官方文件明載
/// 「identically named channels interfere with each other's communication」。
/// 因此原生層刻意拆成兩個名稱，本類別也必須比照：
///
/// - 方法通道 [methodChannelName]：`assetpilot/deep_link`
/// - 事件通道 [eventChannelName]：`assetpilot/deep_link/events`
///
/// ## 待處理連結要依 host 分取
///
/// 本 App 有兩類互不相干的連結消費者：記帳入口（`transaction`／`ledger`）
/// 與登入回呼（`google-callback`／`line-callback`／`auth-ticket`）。
/// 若只有一格待處理連結，任一方先取走就會讓另一方收不到冷啟動連結。
/// 因此 [takeInitialLink] 與 [peekInitialLink] 都支援以 host 過濾。
class AppLinkService {
  AppLinkService._();

  static final AppLinkService instance = AppLinkService._();

  /// iOS 原生**方法**通道名稱（與 `ios/Runner/DeepLinkChannel.swift` 一致）。
  static const String methodChannelName = 'assetpilot/deep_link';

  /// iOS 原生**事件**通道名稱（與 `ios/Runner/DeepLinkChannel.swift` 一致）。
  static const String eventChannelName = 'assetpilot/deep_link/events';

  final AppLinks _appLinks = AppLinks();

  /// iOS 原生事件通道。
  static const EventChannel _nativeChannel = EventChannel(eventChannelName);

  /// iOS 原生方法通道（取回冷啟動連結）。
  static const MethodChannel _nativeMethodChannel =
      MethodChannel(methodChannelName);

  StreamSubscription<dynamic>? _subscription;
  final StreamController<Uri> _controller = StreamController<Uri>.broadcast();

  /// 連結串流：每次有新的連結送達時發出。
  Stream<Uri> get links => _controller.stream;

  bool _started = false;

  /// 開始監聽系統傳來的連結。App 啟動時呼叫一次即可（重複呼叫無副作用）。
  Future<void> start() async {
    if (_started) return;
    _started = true;

    if (PlatformInfo.isIOS) {
      // iOS：走自訂原生通道。事件通道訂閱後，原生層若有「待處理連結」
      // 會立即補送（見 DeepLinkChannel.onListen）。
      _subscription = _nativeChannel.receiveBroadcastStream().listen(
        _handle,
        onError: (_) {},
      );
      return;
    }

    // Android／其他平台：沿用 app_links。
    _subscription = _appLinks.uriLinkStream.listen(
      _handle,
      onError: (_) {},
    );
  }

  /// 取回冷啟動時系統帶來的連結（App 尚未執行就被喚醒）。
  ///
  /// 回傳的連結只會在此回傳一次；呼叫端負責直接處理它。
  ///
  /// [hosts] 用來指定要取哪一類連結（例如登入回呼只取
  /// `google-callback`），避免與其他用途的消費者互相搶走連結。
  Future<Uri?> takeInitialLink({List<String>? hosts}) async {
    if (PlatformInfo.isIOS) {
      try {
        final link = await _nativeMethodChannel.invokeMethod<String>(
          'takePendingLink',
          hosts == null ? null : {'hosts': hosts},
        );
        if (link == null || link.isEmpty) return null;
        return Uri.tryParse(link);
      } catch (_) {
        return null;
      }
    }
    // Android：app_links 的 initial link 只有一格，無法依 host 分取。
    // 取回後若不符合條件則丟棄（與原本的行為一致）。
    try {
      final uri = await _appLinks.getInitialLink();
      if (uri == null) return null;
      if (hosts != null && hosts.isNotEmpty && !hosts.contains(uri.host)) {
        return null;
      }
      return uri;
    } catch (_) {
      return null;
    }
  }

  /// 讀取「最近喚起 App 的 URI」，但不將它視為本次要處理的連結。
  ///
  /// OAuth 流程用它來判斷「這次的回呼是不是新產生的」：上一次登入的
  /// 回呼會殘留於此，直接拿來比對會讓第二次登入立刻被舊回呼
  /// （帶舊 state）完成。
  Future<Uri?> peekInitialLink({List<String>? hosts}) async {
    if (PlatformInfo.isIOS) {
      try {
        final link = await _nativeMethodChannel.invokeMethod<String>(
          'getInitialLink',
          hosts == null ? null : {'hosts': hosts},
        );
        if (link == null || link.isEmpty) return null;
        return Uri.tryParse(link);
      } catch (_) {
        return null;
      }
    }
    try {
      final uri = await _appLinks.getInitialLink();
      if (uri == null) return null;
      if (hosts != null && hosts.isNotEmpty && !hosts.contains(uri.host)) {
        return null;
      }
      return uri;
    } catch (_) {
      return null;
    }
  }

  /// 清除「待處理」的深層連結，但保留歷史記錄。
  ///
  /// 登出、切換帳號或權限失效時呼叫（計畫書 5.2 步驟 7）：
  /// 未送達的捷徑輸入不得跨帳號延續，否則上一個帳號收到的
  /// `assetpilot://transaction/new` 會在下一個帳號登入後被取出，
  /// 以錯誤的身分開啟記帳表單。
  ///
  /// 歷史記錄刻意不清：那是給 OAuth 流程比對「這次回呼是不是新產生的」
  /// 用的，與帳號權限無關。
  Future<void> clearPending() async {
    if (PlatformInfo.isIOS) {
      try {
        await _nativeMethodChannel.invokeMethod<void>('clearPendingLinks');
      } catch (_) {
        // 原生層未提供此方法時忽略（Android 走 app_links，無對應概念）。
      }
      return;
    }
    // Android：app_links 的 initial link 沒有可清除的 API。
    // app_links 本身在收到連結時即派送事件，不存在「待處理」佇列，
    // 因此這裡不需要額外處理。
  }

  /// 記住連結並通知訂閱者。
  ///
  /// iOS 原生層送來的是字串，Android 的 `app_links` 送來的是 [Uri]，
  /// 這裡統一轉成 [Uri]。
  void _handle(dynamic raw) {
    final Uri? uri;
    if (raw is Uri) {
      uri = raw;
    } else if (raw is String && raw.isNotEmpty) {
      uri = Uri.tryParse(raw);
    } else {
      uri = null;
    }
    if (uri == null) return;
    if (!_controller.isClosed) _controller.add(uri);
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
    await _controller.close();
  }
}

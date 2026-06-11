import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';

/// 與原生 Android 端（MainActivity 的 MethodChannel）溝通，取得 Play Integrity
/// token。設計為「軟性」：非 Android、或任何失敗都回 `null`，呼叫端據此忽略並
/// 照常送出登入／註冊（不阻斷使用者）。後端再依 token 有無與設定決定如何處理。
class PlayIntegrity {
  PlayIntegrity._();

  static const _channel = MethodChannel('assetpilot/play_integrity');

  static bool get _isAndroid => !kIsWeb && Platform.isAndroid;

  /// 以 [nonce] 向 Google Play 請求 integrity token；失敗回 `null`。
  static Future<String?> requestToken(String nonce) async {
    if (!_isAndroid) return null;
    try {
      final token = await _channel.invokeMethod<String>('requestToken', {
        'nonce': nonce,
      });
      return (token != null && token.isNotEmpty) ? token : null;
    } catch (_) {
      return null;
    }
  }
}

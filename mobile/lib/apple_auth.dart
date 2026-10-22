import 'package:flutter/services.dart';

import '../api_client.dart';
import '../l10n.dart';
import '../platform/platform_info.dart';

/// Sign in with Apple 的 App 端流程。
///
/// iOS 必須使用系統的 `ASAuthorizationAppleIDProvider` 取得身分令牌，
/// 因此由原生層（ios/Runner/AppleAuthChannel.swift）執行授權，透過
/// platform channel 把身分令牌與使用者姓名交回 Dart 層。
///
/// 伺服器端會驗證令牌的簽章、iss、aud、exp 與 nonce；App 端不自行判定
/// 身分真偽，只負責取得令牌並原樣送交。
class AppleAuth {
  AppleAuth._();

  static const _channel = MethodChannel('assetpilot/apple_auth');

  /// Apple 登入是否可用：iOS 且後端已設定 Service ID。
  static bool get isSupported => PlatformInfo.isIOS;

  /// 執行 Apple 登入；成功則 [ApiClient] 已持有 Cookie。失敗拋 [ApiException]。
  static Future<void> signIn({
    required String clientId,
    required String baseUrl,
    String? turnstileToken,
  }) async {
    if (!isSupported) {
      throw ApiException(0, trKey('mobileDynamicProviderLoginFailed', {
        'provider': 'Apple',
        'error': 'Sign in with Apple 目前僅支援 iOS 版本',
      }));
    }

    // 先向後端取得 state / bindingToken / nonce，nonce 必須嵌入身分令牌。
    final stateData = await ApiClient.instance.appleState();
    final state = stateData['state'] ?? '';
    final bindingToken = stateData['bindingToken'] ?? '';
    final nonce = stateData['nonce'] ?? '';
    if (state.isEmpty || nonce.isEmpty || bindingToken.isEmpty) {
      throw ApiException(0, trKey('mobileLegacyUnableToCreateLineSignInState'));
    }

    final result = await _authorize(clientId: clientId, nonce: nonce);
    final identityToken = '${result['identityToken'] ?? ''}';
    if (identityToken.isEmpty) {
      throw ApiException(0, trKey('mobileDynamicProviderLoginFailed', {
        'provider': 'Apple',
        'error': '未取得 Apple 身分令牌',
      }));
    }
    final fullName = result['fullName'] as String?;

    await ApiClient.instance.appleLogin(
      identityToken: identityToken,
      state: state,
      bindingToken: bindingToken,
      fullName: fullName,
      turnstileToken: turnstileToken,
    );
  }

  /// 把 Apple 身分綁定到「目前已登入的帳號」。
  ///
  /// 與 [signIn] 相同需要系統授權視窗，但後端流程是 link：state 必須由已
  /// 登入的使用者發起並綁定同一個 userId，避免他人把 Apple 身分轉接到
  /// 本帳號。
  static Future<void> link({
    required String clientId,
    required String baseUrl,
  }) async {
    if (!isSupported) {
      throw ApiException(0, trKey('mobileDynamicProviderLoginFailed', {
        'provider': 'Apple',
        'error': 'Sign in with Apple 目前僅支援 iOS 版本',
      }));
    }

    final stateData = await ApiClient.instance.appleState(flow: 'link');
    final state = stateData['state'] ?? '';
    final bindingToken = stateData['bindingToken'] ?? '';
    final nonce = stateData['nonce'] ?? '';
    if (state.isEmpty || nonce.isEmpty || bindingToken.isEmpty) {
      throw ApiException(0, trKey('mobileLegacyUnableToCreateLineSignInState'));
    }

    final result = await _authorize(clientId: clientId, nonce: nonce);
    final identityToken = '${result['identityToken'] ?? ''}';
    if (identityToken.isEmpty) {
      throw ApiException(0, trKey('mobileDynamicProviderLoginFailed', {
        'provider': 'Apple',
        'error': '未取得 Apple 身分令牌',
      }));
    }

    await ApiClient.instance.appleLink(
      identityToken: identityToken,
      state: state,
      bindingToken: bindingToken,
    );
  }

  /// 呼叫原生層取得 Apple 身分令牌；使用者取消時以 [ApiException] 表示。
  static Future<Map<Object?, Object?>> _authorize({
    required String clientId,
    required String nonce,
  }) async {
    try {
      final result = await _channel.invokeMapMethod<Object?, Object?>('signIn', {
        'clientId': clientId,
        'nonce': nonce,
      });
      if (result == null) {
        throw ApiException(
          0,
          trKey('mobileLegacyGoogleSignInTimedOutOrWasCancelled'),
        );
      }
      return result;
    } on PlatformException catch (e) {
      throw ApiException(0, _messageForErrorCode(e.code, e.message));
    } on MissingPluginException {
      throw ApiException(0, trKey('mobileDynamicProviderLoginFailed', {
        'provider': 'Apple',
        'error': '原生 Apple 登入模組未就緒，請更新 App 後再試',
      }));
    }
  }

  /// 取消 Apple 授權時，原生層回傳特定 error code；此時不顯示紅色錯誤框，
  /// 只當作使用者主動取消。
  static bool isUserCancelled(Object error) {
    if (error is ApiException) {
      return error.message.contains('cancel') ||
          error.message.contains('取消') ||
          error.message.contains('timed out');
    }
    return false;
  }

  static String _messageForErrorCode(String code, String? message) {
    switch (code) {
      case 'cancelled':
        return trKey('mobileLegacyGoogleSignInTimedOutOrWasCancelled');
      case 'failed':
        return trKey('mobileDynamicProviderLoginFailed', {
          'provider': 'Apple',
          'error': message ?? 'unknown',
        });
      case 'not_supported':
        return trKey('mobileDynamicProviderLoginFailed', {
          'provider': 'Apple',
          'error': '此裝置不支援 Sign in with Apple',
        });
      default:
        return trKey('mobileDynamicProviderLoginFailed', {
          'provider': 'Apple',
          'error': message ?? code,
        });
    }
  }
}

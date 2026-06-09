import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';

/// Google SSO（Authorization Code Flow，系統瀏覽器 + App Link 回呼）。
///
/// 流程：
/// 1. 跟後端取一次性 state。
/// 2. 用系統瀏覽器開 Google 授權頁（redirect_uri 指向後端的 App Link 路徑）。
/// 3. 使用者登入後 Google 導回 `<baseUrl>/app/google-callback?code=…&state=…`，
///    由 Android App Link 喚起本 App，[AppLinks] 收到該 URI。
/// 4. 核對 state、取出 code，POST 給後端以 client_secret 兌換並登入。
class GoogleAuth {
  static const callbackPath = '/app/google-callback';
  static const callbackScheme = 'assetpilot';
  static const callbackHost = 'google-callback';

  /// 執行 Google 登入；成功則 [ApiClient] 已持有 Cookie。失敗拋 [ApiException]。
  static Future<void> signIn({
    required String clientId,
    required String baseUrl,
  }) async {
    final redirectUri = '$baseUrl$callbackPath';
    final state = await ApiClient.instance.googleState();

    final authUrl = Uri.https('accounts.google.com', '/o/oauth2/v2/auth', {
      'client_id': clientId,
      'redirect_uri': redirectUri,
      'response_type': 'code',
      'scope': 'openid email profile',
      'state': state,
      'prompt': 'select_account',
    });

    final appLinks = AppLinks();
    final completer = Completer<Uri>();
    void completeIfCallback(Uri uri) {
      final isHttpsAppLink = uri.path == callbackPath;
      final isCustomScheme =
          uri.scheme == callbackScheme && uri.host == callbackHost;
      if ((isHttpsAppLink || isCustomScheme) &&
          uri.queryParameters['code'] != null &&
          !completer.isCompleted) {
        completer.complete(uri);
      }
    }

    final sub = appLinks.uriLinkStream.listen(completeIfCallback);

    try {
      final launched = await launchUrl(
        authUrl,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        throw ApiException(0, '無法開啟瀏覽器進行 Google 登入');
      }

      final initialUri = await appLinks.getInitialLink();
      if (initialUri != null) completeIfCallback(initialUri);

      final Uri cb;
      try {
        cb = await completer.future.timeout(const Duration(minutes: 5));
      } on TimeoutException {
        throw ApiException(0, 'Google 登入逾時或已取消');
      }

      final returnedState = cb.queryParameters['state'] ?? '';
      if (returnedState != state) {
        throw ApiException(0, 'Google 登入狀態不符，請重試');
      }
      final code = cb.queryParameters['code']!;
      await ApiClient.instance.googleLogin(
        code: code,
        redirectUri: redirectUri,
        state: state,
      );
    } finally {
      await sub.cancel();
    }
  }
}

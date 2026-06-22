import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';
import 'l10n.dart';

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

    // 啟動瀏覽器前先記錄目前的 initial link。getInitialLink() 會回傳「最初喚起 App
    // 的 URI」且具持久性：上一次 Google 登入的回呼會殘留於此。若直接拿來比對，
    // 第二次登入會立刻被舊回呼（帶舊 state）完成，導致「登入狀態不符」。
    final staleInitialUri = await appLinks.getInitialLink();

    final sub = appLinks.uriLinkStream.listen(completeIfCallback);

    try {
      // 用 in-app 瀏覽器分頁（Android Custom Tab）開授權頁，登入完成後可由
      // closeInAppWebView() 主動關閉；外部瀏覽器（externalApplication）無法被關閉，
      // 會在導回 App 後殘留。
      final launched = await launchUrl(
        authUrl,
        mode: LaunchMode.inAppBrowserView,
      );
      if (!launched) {
        throw ApiException(0, tr('無法開啟瀏覽器進行 Google 登入'));
      }

      // 僅在 initial link 與啟動前不同（真正的冷啟動回呼）時才採用，
      // 避免把上一次登入殘留的舊回呼當成本次結果。
      final initialUri = await appLinks.getInitialLink();
      if (initialUri != null &&
          initialUri.toString() != staleInitialUri?.toString()) {
        completeIfCallback(initialUri);
      }

      final Uri cb;
      try {
        cb = await completer.future.timeout(Duration(minutes: 5));
      } on TimeoutException {
        throw ApiException(0, tr('Google 登入逾時或已取消'));
      }

      final returnedState = cb.queryParameters['state'] ?? '';
      if (returnedState != state) {
        throw ApiException(0, tr('Google 登入狀態不符，請重試'));
      }
      final code = cb.queryParameters['code']!;
      await ApiClient.instance.googleLogin(
        code: code,
        redirectUri: redirectUri,
        state: state,
      );
    } finally {
      await sub.cancel();
      // 收到回呼導回 App 後，關閉殘留的 in-app 瀏覽器分頁（未開啟時為 no-op）。
      await closeInAppWebView();
    }
  }
}

import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';
import 'l10n.dart';

class LineAuth {
  static const callbackPath = '/app/line-callback';
  static const callbackScheme = 'assetpilot';
  static const callbackHost = 'line-callback';

  static Future<void> signIn({
    required String channelId,
    required String baseUrl,
  }) async {
    final redirectUri = '$baseUrl$callbackPath';
    final stateData = await ApiClient.instance.lineState();
    final state = stateData['state'] ?? '';
    final nonce = stateData['nonce'] ?? '';
    if (state.isEmpty || nonce.isEmpty) {
      throw ApiException(0, tr('無法建立 LINE 登入狀態'));
    }

    // 不帶 disable_auto_login（預設 false）→ 啟用 LINE auto-login：裝置上已登入
    // LINE App 時，授權頁會直接喚起 LINE App 一鍵授權，免輸入帳密；未安裝 LINE App
    // 才 fallback 回網頁登入。
    final authUrl = Uri.https('access.line.me', '/oauth2/v2.1/authorize', {
      'response_type': 'code',
      'client_id': channelId,
      'redirect_uri': redirectUri,
      'state': state,
      'scope': 'openid profile email',
      'nonce': nonce,
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
    // 的 URI」且具持久性：上一次登入的回呼會殘留於此。若直接拿來比對，第二次登入
    // 會立刻被舊回呼（帶舊 state）完成，導致「登入狀態不符」。
    final staleInitialUri = await appLinks.getInitialLink();

    final sub = appLinks.uriLinkStream.listen(completeIfCallback);
    try {
      // 用 in-app 瀏覽器分頁（Android Custom Tab）開授權頁，登入完成後可由
      // closeInAppWebView() 主動關閉；外部瀏覽器無法被關閉，會在導回 App 後殘留。
      final launched = await launchUrl(
        authUrl,
        mode: LaunchMode.inAppBrowserView,
      );
      if (!launched) throw ApiException(0, tr('無法開啟瀏覽器進行 LINE 登入'));

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
        throw ApiException(0, tr('LINE 登入逾時或已取消'));
      }

      final returnedState = cb.queryParameters['state'] ?? '';
      if (returnedState != state) throw ApiException(0, tr('LINE 登入狀態不符，請重試'));
      await ApiClient.instance.lineLogin(
        code: cb.queryParameters['code']!,
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

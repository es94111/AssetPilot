import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';

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
      throw ApiException(0, '無法建立 LINE 登入狀態');
    }

    final authUrl = Uri.https('access.line.me', '/oauth2/v2.1/authorize', {
      'response_type': 'code',
      'client_id': channelId,
      'redirect_uri': redirectUri,
      'state': state,
      'scope': 'openid profile email',
      'nonce': nonce,
      'disable_auto_login': 'true',
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
      if (!launched) throw ApiException(0, '無法開啟瀏覽器進行 LINE 登入');

      final initialUri = await appLinks.getInitialLink();
      if (initialUri != null) completeIfCallback(initialUri);

      final Uri cb;
      try {
        cb = await completer.future.timeout(const Duration(minutes: 5));
      } on TimeoutException {
        throw ApiException(0, 'LINE 登入逾時或已取消');
      }

      final returnedState = cb.queryParameters['state'] ?? '';
      if (returnedState != state) throw ApiException(0, 'LINE 登入狀態不符，請重試');
      await ApiClient.instance.lineLogin(
        code: cb.queryParameters['code']!,
        redirectUri: redirectUri,
        state: state,
      );
    } finally {
      await sub.cancel();
    }
  }
}

import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';
import 'l10n.dart';

class PasskeyAuth {
  static const callbackScheme = 'assetpilot';
  static const callbackHost = 'auth-ticket';

  static Future<void> signIn({required String baseUrl}) async {
    final appLinks = AppLinks();
    final completer = Completer<Uri>();
    void completeIfCallback(Uri uri) {
      if (uri.scheme == callbackScheme &&
          uri.host == callbackHost &&
          uri.queryParameters['ticket'] != null &&
          !completer.isCompleted) {
        completer.complete(uri);
      }
    }

    final sub = appLinks.uriLinkStream.listen(completeIfCallback);
    try {
      final launched = await launchUrl(
        Uri.parse('$baseUrl/app/passkey-login'),
        mode: LaunchMode.externalApplication,
      );
      if (!launched) throw ApiException(0, tr('無法開啟瀏覽器進行 Passkey 登入'));

      final initialUri = await appLinks.getInitialLink();
      if (initialUri != null) completeIfCallback(initialUri);

      final Uri cb;
      try {
        cb = await completer.future.timeout(Duration(minutes: 5));
      } on TimeoutException {
        throw ApiException(0, tr('Passkey 登入逾時或已取消'));
      }

      await ApiClient.instance.exchangeAppAuthTicket(
        cb.queryParameters['ticket']!,
      );
    } finally {
      await sub.cancel();
    }
  }
}

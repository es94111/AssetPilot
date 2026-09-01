import 'dart:async';
import 'dart:math';

import 'package:app_links/app_links.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';
import 'l10n.dart';

/// 32 bytes of CSPRNG randomness, hex-encoded.
String _generateDeviceNonce() {
  final random = Random.secure();
  final bytes = List<int>.generate(32, (_) => random.nextInt(256));
  return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}

class PasskeyAuth {
  static const callbackScheme = 'assetpilot';
  static const callbackHost = 'auth-ticket';

  static Future<void> signIn({
    required String baseUrl,
    String? turnstileToken,
  }) async {
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

    // 綁定本次 handoff：deviceNonce 只透過這個 outbound URL 交給網頁端，從不出現
    // 在 assetpilot://auth-ticket 回呼裡，因此攔截到回呼 URI 的第三方無法取得，
    // 兌換時仍需由本 App 從記憶體中原樣附上才能通過驗證（見安全報告 AUTHZ-VULN-07）。
    final deviceNonce = _generateDeviceNonce();

    final sub = appLinks.uriLinkStream.listen(completeIfCallback);
    try {
      final passkeyUri = Uri.parse('$baseUrl/app/passkey-login');
      final launched = await launchUrl(
        passkeyUri.replace(
          queryParameters: {
            ...passkeyUri.queryParameters,
            'deviceNonce': deviceNonce,
            if (turnstileToken != null && turnstileToken.isNotEmpty)
              'turnstileToken': turnstileToken,
          },
        ),
        mode: LaunchMode.externalApplication,
      );
      if (!launched) throw ApiException(0, trKey('mobileLegacyUnableToOpenTheBrowserForPasskeySign'));

      final initialUri = await appLinks.getInitialLink();
      if (initialUri != null) completeIfCallback(initialUri);

      final Uri cb;
      try {
        cb = await completer.future.timeout(Duration(minutes: 5));
      } on TimeoutException {
        throw ApiException(0, trKey('mobileLegacyPasskeySignInTimedOutOrWasCancelled'));
      }

      await ApiClient.instance.exchangeAppAuthTicket(
        cb.queryParameters['ticket']!,
        deviceNonce: deviceNonce,
      );
    } finally {
      await sub.cancel();
    }
  }
}

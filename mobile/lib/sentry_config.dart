import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// assetpilot-app 專案的 Sentry DSN。
///
/// 對行動 App 來說 DSN 不算機密（無論如何都會被打包進 binary），因此可直接內嵌。
/// 若日後要指向不同的 Sentry 專案，可在建置時覆寫：
///   flutter build appbundle --dart-define=SENTRY_DSN=https://...
const String sentryDsn = String.fromEnvironment(
  'SENTRY_DSN',
  defaultValue:
      'https://23869632046d947149cd51a80aef46ce@o4511575169040384.ingest.de.sentry.io/4511578714931280',
);

/// 設定 Sentry SDK。在 `main.dart` 透過 `SentryFlutter.init` 套用。
void configureSentry(SentryFlutterOptions options) {
  options.dsn = sentryDsn;
  // 用建置模式區分環境，方便在 Sentry 後台過濾 production / 開發中事件。
  options.environment = kReleaseMode ? 'production' : 'development';
  // 效能追蹤取樣率：先用 20%，事件量大時可再調低（純錯誤監控可設為 0）。
  options.tracesSampleRate = 0.2;
  // 財務 App：絕不附帶可識別個資（IP、Cookie、預設 request body 等）。
  options.sendDefaultPii = false;
  // 送出前再保險清掉可能挾帶的機敏標頭（JWT Cookie、Authorization）。
  options.beforeSend = _scrubSensitiveData;
}

/// 移除事件中可能挾帶 JWT Cookie / 授權資訊的標頭，避免上傳到 Sentry。
///
/// App 以 `flutter_secure_storage` 保管登入 Cookie、並會處理金額與記帳憑證照片，
/// 這些都不應離開裝置進到第三方監控服務。
FutureOr<SentryEvent?> _scrubSensitiveData(SentryEvent event, Hint hint) {
  final request = event.request;
  if (request != null && request.headers.isNotEmpty) {
    final headers = Map<String, String>.from(request.headers)
      ..removeWhere((key, _) {
        final lower = key.toLowerCase();
        return lower == 'authorization' ||
            lower == 'cookie' ||
            lower == 'set-cookie';
      });
    event = event.copyWith(request: request.copyWith(headers: headers));
  }
  return event;
}

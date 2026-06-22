import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
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
  // 啟用結構化日誌（Sentry Logs），可用 `Sentry.logger` 送出 info/warn/error 等級日誌。
  // 注意：寫 log 時不要帶入金額、Cookie、JWT 等機敏內容。
  options.enableLogs = true;
  // 指標（Sentry Metrics）於 SDK >= 9.11.0 預設自動啟用，無需額外設定旗標；
  // 直接以 `Sentry.metrics.count/gauge/distribution(...)` 發送即可。
  // 同樣注意：指標名稱與標籤勿帶入金額、個資等機敏內容。

  // Session Replay（畫面回溯錄製）。本 App 為財務性質，採最保守策略：
  //   - 正式版（release）：平時完全不錄一般 session，只有發生錯誤/當機時才回溯
  //     錄一段（onErrorSampleRate=1.0），把畫面錄製的隱私衝擊降到最低。
  //   - 開發版（debug）：全程錄製，方便驗證設定。
  options.replay.sessionSampleRate = kReleaseMode ? 0.0 : 1.0;
  options.replay.onErrorSampleRate = 1.0;

  // 遮罩策略：使用者的內容一律打碼，App 自身的介面圖案保留可見以便辨識畫面。
  //   - maskAllText：所有文字（含金額、帳號、Email）全程打碼。
  //   - maskAllImages：使用者內容圖片（交易憑證照片，以 Image.network /
  //     Image.file 載入）全程打碼。
  //   - maskAssetImages=false：App 打包在程式內的 asset 圖片（品牌 logo、插圖等）
  //     非使用者資料，不打碼（此為套件預設，這裡明確標示意圖）。
  //   - unmask<Icon>()：Flutter 的 Icon 內部以 RichText 渲染，會被 maskAllText
  //     的 RichText 規則一併打碼，導致 App 自己的圖示（錢包、導覽列等）在回溯中
  //     被黑掉。這裡明確解除遮罩讓 App 圖示可見；Icon 為固定字型字符、不含任何
  //     使用者或財務資料，解除遮罩無隱私風險。
  //   （本專案 release 未開 --obfuscate，型別名稱保留，泛型遮罩規則可靠生效。）
  options.privacy.maskAllText = true;
  options.privacy.maskAllImages = true;
  options.privacy.maskAssetImages = false;
  options.privacy.unmask<Icon>();

  // 送出前再保險清掉可能挾帶的機敏標頭（JWT Cookie、Authorization）與查詢字串。
  options.beforeSend = _scrubSensitiveData;

  // HTTP 自動埋點（api_client 以 SentryHttpClient 發送）會為每個 API 請求產生
  // 效能 span 與麵包屑，用來監控 API 延遲造成的效能下降。但 SDK 預設會把請求的
  // query string（如搜尋 `?keyword=…`）一併記進 span 與麵包屑；本 App 為財務性質，
  // 與 _logPath() 對 Sentry Logs 的處理一致，於送出前一律移除 http.query／
  // http.fragment，只保留路徑、方法、狀態碼與耗時（效能診斷所需、非個資）。
  options.beforeBreadcrumb = _scrubHttpBreadcrumb;
  options.beforeSendTransaction = _scrubHttpSpans;
}

/// 移除事件中可能挾帶 JWT Cookie / 授權資訊的標頭，避免上傳到 Sentry。
///
/// App 以 `flutter_secure_storage` 保管登入 Cookie、並會處理金額與記帳憑證照片，
/// 這些都不應離開裝置進到第三方監控服務。
FutureOr<SentryEvent?> _scrubSensitiveData(SentryEvent event, Hint hint) {
  final request = event.request;
  if (request != null) {
    // headers getter 為不可變副本，須整份替換才能移除機敏標頭。
    request.headers = Map<String, String>.of(request.headers)
      ..removeWhere((key, _) {
        final lower = key.toLowerCase();
        return lower == 'authorization' ||
            lower == 'cookie' ||
            lower == 'set-cookie';
      });
    // SentryHttpClient 擷取失敗請求（如 5xx）為事件時，會把查詢字串放進
    // request.queryString，可能挾帶使用者搜尋關鍵字；一律清除不送第三方。
    request.queryString = null;
    request.fragment = null;
  }
  return event;
}

/// 移除 HTTP 麵包屑中的查詢字串與片段（搜尋關鍵字等可能機敏內容），
/// 保留路徑／方法／狀態碼／耗時等效能診斷所需資訊。
Breadcrumb? _scrubHttpBreadcrumb(Breadcrumb? breadcrumb, Hint hint) {
  if (breadcrumb?.category == 'http') {
    breadcrumb?.data
      ?..remove('http.query')
      ..remove('http.fragment');
  }
  return breadcrumb;
}

/// 移除效能交易中各 HTTP span 的查詢字串與片段。span 結束後 removeData 會被忽略，
/// 故直接操作 data map（getter 回傳的是即時參照）移除機敏鍵。
FutureOr<SentryTransaction?> _scrubHttpSpans(
  SentryTransaction transaction,
  Hint hint,
) {
  for (final span in transaction.spans) {
    span.data
      ..remove('http.query')
      ..remove('http.fragment');
  }
  return transaction;
}

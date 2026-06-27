import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'api_client.dart';
import 'app.dart';
import 'l10n.dart';
import 'sentry_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Android 15（targetSdk 35）起，系統強制以 edge-to-edge 顯示，且
  // Window.setStatusBarColor／setNavigationBarColor 等系統列著色 API 已棄用並失效。
  // 明確啟用 edge-to-edge 並將狀態列與導覽列設為透明（關閉系統對比強制），
  // 由 Material 的 Scaffold／AppBar／NavigationBar 與各頁的 SafeArea 處理安全區內距，
  // 確保內容不被系統列遮擋、外觀在淺色／深色主題下皆正確。
  // 參考：https://developer.android.com/about/versions/15/behavior-changes-15#edge-to-edge
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarContrastEnforced: false,
  ));

  // 用 SentryFlutter.init 包住整個啟動流程，連初始化階段的錯誤也能被攔截上報。
  await SentryFlutter.init(
    configureSentry,
    appRunner: () async {
      await loadAppLocale();
      await loadThemeMode();
      await ApiClient.instance.init();
      // SentryWidget 是 Session Replay 擷取畫面所需的根節點包裝。
      runApp(SentryWidget(child: const AssetPilotApp()));
    },
  );
}

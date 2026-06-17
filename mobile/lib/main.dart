import 'package:flutter/material.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'api_client.dart';
import 'app.dart';
import 'sentry_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // 用 SentryFlutter.init 包住整個啟動流程，連初始化階段的錯誤也能被攔截上報。
  await SentryFlutter.init(
    configureSentry,
    appRunner: () async {
      await ApiClient.instance.init();
      await loadThemeMode();
      runApp(const AssetPilotApp());
    },
  );
}

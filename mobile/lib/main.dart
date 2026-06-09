import 'package:flutter/material.dart';

import 'api_client.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiClient.instance.init();
  await loadThemeMode();
  runApp(const AssetPilotApp());
}

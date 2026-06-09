import 'package:flutter/material.dart';

import 'api_client.dart';
import 'screens/dashboard_screen.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiClient.instance.init();
  runApp(const AssetPilotApp());
}

class AssetPilotApp extends StatelessWidget {
  const AssetPilotApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF2563EB); // AssetPilot 品牌藍
    return MaterialApp(
      title: 'AssetPilot',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: seed),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
            seedColor: seed, brightness: Brightness.dark),
        useMaterial3: true,
      ),
      home: const AuthGate(),
    );
  }
}

/// 依登入狀態切換登入頁／儀表板。
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _loggedIn = ApiClient.instance.isLoggedIn;

  @override
  Widget build(BuildContext context) {
    if (_loggedIn) {
      return DashboardScreen(
        onLoggedOut: () => setState(() => _loggedIn = false),
      );
    }
    return LoginScreen(
      onLoggedIn: () => setState(() => _loggedIn = true),
    );
  }
}

import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'generated/l10n/app_localizations.dart';
import 'screens/dashboard_screen.dart';
import 'screens/login_screen.dart';
import 'screens/more_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/reports_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/stocks_screen.dart';
import 'screens/transaction_form_screen.dart';
import 'screens/transactions_screen.dart';
import 'l10n.dart';
import 'theme.dart';

/// 全域主題模式（system / light / dark），可在設定頁切換並持久化。
final ValueNotifier<ThemeMode> themeMode = ValueNotifier(ThemeMode.system);

const _kThemeKey = 'themeMode';

Future<void> loadThemeMode() async {
  final p = await SharedPreferences.getInstance();
  switch (p.getString(_kThemeKey)) {
    case 'light':
      themeMode.value = ThemeMode.light;
      break;
    case 'dark':
      themeMode.value = ThemeMode.dark;
      break;
    default:
      themeMode.value = ThemeMode.system;
  }
}

Future<void> setThemeMode(ThemeMode mode) async {
  themeMode.value = mode;
  final p = await SharedPreferences.getInstance();
  await p.setString(_kThemeKey, mode.name);
}

ThemeData _buildTheme(Brightness brightness) => buildAssetPilotTheme(brightness);

class AssetPilotApp extends StatelessWidget {
  const AssetPilotApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String>(
      valueListenable: appLocale,
      builder: (context, locale, _) => ValueListenableBuilder<ThemeMode>(
        valueListenable: themeMode,
        builder: (context, mode, _) => MaterialApp(
          title: 'AssetPilot',
          debugShowCheckedModeBanner: false,
          locale: flutterLocaleFor(locale),
          supportedLocales: supportedAppLocales
              .map(flutterLocaleFor)
              .toList(growable: false),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          themeMode: mode,
          // 監控畫面切換的效能：為每次導覽建立 Sentry 交易，量測畫面顯示耗時與
          // 卡頓／凍結畫格（slow/frozen frames），用於發現效能下降。
          navigatorObservers: [SentryNavigatorObserver()],
          theme: _buildTheme(Brightness.light),
          darkTheme: _buildTheme(Brightness.dark),
          home: RootGate(),
          // 系統或深層連結可能推送 App 未註冊的路由（例如背景啟動時 OS 傳來的
          // route information）。本 App 採純 home 導覽、未設定具名路由，若不提供
          // onUnknownRoute，Flutter 框架在 release 模式（assert 被移除）會對
          // widget.onUnknownRoute 做 null check 而崩潰
          // （ASSETPILOT-APP-2: Null check operator used on a null value）。
          // 這裡統一導回主畫面，安全忽略未知路由。
          onUnknownRoute: (settings) => MaterialPageRoute(
            builder: (_) => RootGate(),
            settings: RouteSettings(name: '/'),
          ),
        ),
      ),
    );
  }
}

/// 啟動閘道：先播放品牌入場動畫，播放完後才切到依登入狀態的 [AuthGate]。
class RootGate extends StatefulWidget {
  const RootGate({super.key});

  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  bool _showSplash = true;

  @override
  Widget build(BuildContext context) {
    if (_showSplash) {
      return SplashScreen(onDone: () {
        if (mounted) setState(() => _showSplash = false);
      });
    }
    return const AuthGate();
  }
}

/// 依登入狀態切換登入頁／主畫面。
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late bool _loggedIn = ApiClient.instance.authState.value;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.authState.addListener(_handleAuthChange);
  }

  @override
  void dispose() {
    ApiClient.instance.authState.removeListener(_handleAuthChange);
    super.dispose();
  }

  void _handleAuthChange() {
    final loggedIn = ApiClient.instance.authState.value;
    if (mounted) setState(() => _loggedIn = loggedIn);
    if (!loggedIn) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loggedIn) return HomeShell(onLoggedOut: () {});
    return LoginScreen(onLoggedIn: () {});
  }
}

/// 自適應主畫面：Compact 使用底部導覽，較大視窗使用 NavigationRail。
class HomeShell extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const HomeShell({super.key, required this.onLoggedOut});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSubscription;
  bool _openingDeepLink = false;

  @override
  void initState() {
    super.initState();
    _linkSubscription = _appLinks.uriLinkStream.listen(_handleIncomingLink);
    // 第一次進到主畫面時自動彈出使用教學（看過後不再出現）。
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_handleInitialLink());
      if (mounted) OnboardingScreen.showIfFirstTime(context);
    });
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    super.dispose();
  }

  Future<void> _handleInitialLink() async {
    try {
      final uri = await _appLinks.getInitialLink();
      if (uri != null) await _handleIncomingLink(uri);
    } catch (_) {}
  }

  Future<void> _handleIncomingLink(Uri uri) async {
    if (!_isNewTransactionLink(uri) || _openingDeepLink || !mounted) return;

    // 同步設旗標（await 前），擋掉冷啟動時 getInitialLink 與 uriLinkStream
    // 對同一連結的重複投遞；但不長存去重，讓 widget 捷徑可重複點擊記帳。
    _openingDeepLink = true;
    try {
      final changed = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => TransactionFormScreen(
            initialType: 'expense',
            initialCategoryShortcut: uri.queryParameters['category'],
          ),
        ),
      );
      if (changed == true && mounted) {
        setState(() => _index = 0);
      }
    } finally {
      _openingDeepLink = false;
    }
  }

  bool _isNewTransactionLink(Uri uri) =>
      uri.scheme == 'assetpilot' &&
      uri.host == 'transaction' &&
      uri.path == '/new';

  @override
  Widget build(BuildContext context) {
    // 五個分頁：總覽／交易／股票／報表／更多。報表從「更多」提升為一級分頁，
    // 高頻功能（帳戶、預算）則由 Dashboard 快速入口與「更多」分區進入。
    final pages = [
      DashboardScreen(),
      TransactionsScreen(),
      StocksScreen(),
      ReportsScreen(),
      MoreScreen(onLoggedOut: widget.onLoggedOut),
    ];
    final labels = [
      trKey('mobileLegacyHome'),
      trKey('mobileLegacyTransactions8084a8ea'),
      trKey('featuresCommonStock'),
      trKey('navReports'),
      trKey('mobileLegacyMore'),
    ];
    final icons = [
      (Icons.space_dashboard_outlined, Icons.space_dashboard),
      (Icons.receipt_long_outlined, Icons.receipt_long),
      (Icons.trending_up_outlined, Icons.trending_up),
      (Icons.donut_small_outlined, Icons.donut_small),
      (Icons.menu, Icons.menu_open),
    ];
    final width = MediaQuery.sizeOf(context).width;
    final compact = width < 600;
    final extended = width >= 840;
    final content = Expanded(
      child: IndexedStack(index: _index, children: pages),
    );

    return Scaffold(
      body: SafeArea(
        top: false,
        bottom: false,
        child: compact
            ? Row(children: [content])
            : Row(
                children: [
                  NavigationRail(
                    selectedIndex: _index,
                    onDestinationSelected: (i) => setState(() => _index = i),
                    extended: extended,
                    groupAlignment: -0.85,
                    leading: Padding(
                      padding: const EdgeInsets.only(top: 16, bottom: 24),
                      child: Icon(
                        Icons.account_balance_wallet_rounded,
                        color: Theme.of(context).colorScheme.primary,
                        size: 28,
                      ),
                    ),
                    destinations: [
                      for (var i = 0; i < labels.length; i++)
                        NavigationRailDestination(
                          icon: Icon(icons[i].$1),
                          selectedIcon: Icon(icons[i].$2),
                          label: Text(labels[i]),
                        ),
                    ],
                  ),
                  content,
                ],
              ),
      ),
      bottomNavigationBar: compact
          ? NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: (i) => setState(() => _index = i),
              destinations: [
                for (var i = 0; i < labels.length; i++)
                  NavigationDestination(
                    icon: Icon(icons[i].$1),
                    selectedIcon: Icon(icons[i].$2),
                    label: labels[i],
                  ),
              ],
            )
          : null,
    );
  }
}

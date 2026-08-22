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

ThemeData _buildTheme(Color seed, Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(seedColor: seed, brightness: brightness)
      .copyWith(
        primary: isDark ? const Color(0xFF7B93FA) : const Color(0xFF3B55D9),
        onPrimary: isDark ? const Color(0xFF0C0F16) : Colors.white,
        primaryContainer: isDark
            ? const Color(0xFF202B50)
            : const Color(0xFFEEF2FF),
        onPrimaryContainer: isDark
            ? const Color(0xFFE8EAEF)
            : const Color(0xFF1E293B),
        surface: isDark ? const Color(0xFF151922) : Colors.white,
        onSurface: isDark ? const Color(0xFFE8EAEF) : const Color(0xFF1A1D26),
        onSurfaceVariant: isDark
            ? const Color(0xFFCBD5E1)
            : const Color(0xFF475569),
        surfaceContainerHighest: isDark
            ? const Color(0xFF19202D)
            : const Color(0xFFF1F5F9),
        outline: isDark ? const Color(0xFF303949) : const Color(0xFFE2E8F0),
        outlineVariant: isDark
            ? const Color(0xFF303949)
            : const Color(0xFFE4E7EC),
        error: isDark ? const Color(0xFFFCA5A5) : const Color(0xFFDC2626),
        errorContainer: isDark
            ? const Color(0xFF450A0A)
            : const Color(0xFFFEF2F2),
        onErrorContainer: isDark
            ? const Color(0xFFFEE2E2)
            : const Color(0xFF991B1B),
      );
  const radius = BorderRadius.all(Radius.circular(12));
  final shape = RoundedRectangleBorder(borderRadius: radius);
  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: isDark
        ? const Color(0xFF0C0F16)
        : const Color(0xFFF4F6FA),
    useMaterial3: true,
    extensions: [assetPilotThemeFor(brightness)],
    visualDensity: VisualDensity.standard,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: scheme.onSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: scheme.onSurface,
        fontSize: 22,
        fontWeight: FontWeight.w700,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: radius),
      enabledBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: scheme.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: scheme.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: scheme.error, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.padded,
        shape: shape,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.padded,
        shape: shape,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.padded,
        shape: shape,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        minimumSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.padded,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 1,
      indicatorColor: scheme.primaryContainer,
      height: 72,
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: scheme.surface,
      elevation: 1,
      indicatorColor: scheme.primaryContainer,
      useIndicator: true,
    ),
    dividerTheme: DividerThemeData(
      color: scheme.outlineVariant,
      space: 1,
      thickness: 1,
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: scheme.primary,
      foregroundColor: scheme.onPrimary,
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
  );
}

class AssetPilotApp extends StatelessWidget {
  const AssetPilotApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF2563EB); // AssetPilot 品牌藍
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
          theme: _buildTheme(seed, Brightness.light),
          darkTheme: _buildTheme(seed, Brightness.dark),
          home: AuthGate(),
          // 系統或深層連結可能推送 App 未註冊的路由（例如背景啟動時 OS 傳來的
          // route information）。本 App 採純 home 導覽、未設定具名路由，若不提供
          // onUnknownRoute，Flutter 框架在 release 模式（assert 被移除）會對
          // widget.onUnknownRoute 做 null check 而崩潰
          // （ASSETPILOT-APP-2: Null check operator used on a null value）。
          // 這裡統一導回主畫面，安全忽略未知路由。
          onUnknownRoute: (settings) => MaterialPageRoute(
            builder: (_) => AuthGate(),
            settings: RouteSettings(name: '/'),
          ),
        ),
      ),
    );
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
    final pages = [
      DashboardScreen(),
      TransactionsScreen(),
      StocksScreen(),
      MoreScreen(onLoggedOut: widget.onLoggedOut),
    ];
    final labels = [
      trKey('mobileLegacyHome'),
      trKey('mobileLegacyTransactions8084a8ea'),
      trKey('featuresCommonStock'),
      trKey('mobileLegacyMore'),
    ];
    final icons = [
      (Icons.dashboard_outlined, Icons.dashboard),
      (Icons.receipt_long_outlined, Icons.receipt_long),
      (Icons.trending_up_outlined, Icons.trending_up),
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

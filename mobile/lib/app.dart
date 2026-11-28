import 'dart:async';

import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb;
import 'package:flutter/gestures.dart' show PointerDeviceKind;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'generated/l10n/app_localizations.dart';
import 'offline/connectivity_service.dart';
import 'offline/offline_draft_service.dart';
import 'offline/offline_draft_store.dart';
import 'platform/deep_link_service.dart';
import 'platform/notification_capture.dart';
import 'screens/dashboard_screen.dart';
import 'screens/ledger_screen.dart';
import 'screens/login_screen.dart';
import 'screens/more_screen.dart';
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

ThemeData _buildTheme(Brightness brightness) =>
    buildAssetPilotTheme(brightness);

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
          builder: (context, child) {
            if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) {
              return child!;
            }
            // 留白輕點交給 App 處理，欄位、按鈕與捲動保留各自的手勢。
            return GestureDetector(
              behavior: HitTestBehavior.translucent,
              excludeFromSemantics: true,
              supportedDevices: const {PointerDeviceKind.touch},
              onTap: () {
                final focus = FocusManager.instance.primaryFocus;
                if (focus != null && focus is! FocusScopeNode) {
                  focus.unfocus();
                }
              },
              child: child,
            );
          },
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
      return SplashScreen(
        onDone: () {
          if (mounted) setState(() => _showSplash = false);
        },
      );
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
    // 深層連結監聽必須在「未登入」狀態就開始，否則 Widget 或 Siri 在
    // 登入前喚醒 App 時連結會被丟掉（計畫書 5.4 節的冷啟動接續要求）。
    // 連結會由 DeepLinkService 暫存，等 HomeShell 建立後再取走。
    unawaited(DeepLinkService.instance.start());
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

/// 手機使用底部導覽，較大視窗使用 NavigationRail。
class HomeShell extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const HomeShell({super.key, required this.onLoggedOut});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  int _index = 0;

  /// 帳本切換時遞增，讓 IndexedStack 內的分頁全部重建（不保留舊帳本快取）。
  int _homeEpoch = 0;
  int _transactionsRevision = 0;
  final _sectionNavigators = List.generate(
    4,
    (_) => GlobalKey<NavigatorState>(),
  );
  final DeepLinkService _deepLinks = DeepLinkService.instance;
  StreamSubscription<Uri>? _linkSubscription;
  Timer? _notificationRetryTimer;
  bool _openingDeepLink = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ApiClient.instance.activeLedgerReadOnlyChanges.addListener(
      _updateLedgerPermissions,
    );
    unawaited(_restoreActiveLedger());
    ConnectivityService.instance.isOnline.addListener(
      _scheduleNotificationRetry,
    );
    NotificationCapturePlatform.snapshot.addListener(
      _scheduleNotificationRetry,
    );
    unawaited(NotificationCapturePlatform.initialize());
    _linkSubscription = _deepLinks.links.listen(_handleIncomingLink);
    // 離線草稿需要知道目前連線狀態，以及草稿所屬的使用者／帳本。
    unawaited(ConnectivityService.instance.start());
    unawaited(_bindOfflineDrafts());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_handleInitialLink());
    });
  }

  Future<void> _restoreActiveLedger() async {
    final api = ApiClient.instance;
    final savedId = api.activeLedgerId;
    if (savedId.isEmpty) return;
    try {
      final ledgers = await api.ledgers();
      if (!mounted) return;
      if (await api.resetMissingActiveLedger(savedId, ledgers)) _reloadAll();
    } catch (_) {
      // 離線無法確認權限時，保留目前帳本選取。
    }
  }

  /// 把離線草稿服務綁定到目前使用者與帳本，避免跨帳號／跨帳本混用草稿。
  Future<void> _bindOfflineDrafts() async {
    try {
      final me = await ApiClient.instance.me();
      if (!mounted || !ApiClient.instance.isLoggedIn) return;
      final userId = '${me['id'] ?? ''}';
      await OfflineDraftService.instance.bind(
        userId: userId,
        ledgerId: ApiClient.instance.activeLedgerId,
      );
      if (mounted && ApiClient.instance.isLoggedIn) {
        await NotificationCapturePlatform.bindOwner(userId);
      }
    } catch (_) {
      if (ApiClient.instance.isLoggedIn) {
        await OfflineDraftService.instance.restoreRememberedBinding(
          ledgerId: ApiClient.instance.activeLedgerId,
        );
      } else {
        await OfflineDraftStore.clearRememberedUserId();
      }
    } finally {
      if (mounted && ApiClient.instance.isLoggedIn) {
        unawaited(NotificationCapturePlatform.retry());
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _scheduleNotificationRetry();
    if (state == AppLifecycleState.resumed && ApiClient.instance.isLoggedIn) {
      unawaited(NotificationCapturePlatform.retry());
    }
  }

  void _scheduleNotificationRetry() {
    _notificationRetryTimer?.cancel();
    final nextRetry = NotificationCapturePlatform.snapshot.value.nextRetryAt;
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    if (nextRetry == null ||
        !ApiClient.instance.isLoggedIn ||
        !ConnectivityService.instance.online ||
        lifecycle != AppLifecycleState.resumed) {
      return;
    }
    final remaining = nextRetry.difference(DateTime.now());
    const minimumDelay = Duration(seconds: 1);
    _notificationRetryTimer = Timer(
      remaining < minimumDelay ? minimumDelay : remaining,
      () {
        if (mounted &&
            ApiClient.instance.isLoggedIn &&
            ConnectivityService.instance.online &&
            WidgetsBinding.instance.lifecycleState ==
                AppLifecycleState.resumed) {
          unawaited(NotificationCapturePlatform.retry());
        }
      },
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    ApiClient.instance.activeLedgerReadOnlyChanges.removeListener(
      _updateLedgerPermissions,
    );
    ConnectivityService.instance.isOnline.removeListener(
      _scheduleNotificationRetry,
    );
    NotificationCapturePlatform.snapshot.removeListener(
      _scheduleNotificationRetry,
    );
    _notificationRetryTimer?.cancel();
    _linkSubscription?.cancel();
    super.dispose();
  }

  Future<void> _handleInitialLink() async {
    try {
      // 冷啟動時系統可能帶來一個連結（App 尚未執行就被喚醒）。
      // 若它是在登入前抵達的，會由 [DeepLinkService] 暫存，
      // 這裡取回來處理。
      final uri = await _deepLinks.initialLink() ?? _deepLinks.takePending();
      if (uri != null) await _handleIncomingLink(uri);
    } catch (_) {}
  }

  Future<void> _handleIncomingLink(Uri uri) async {
    // 這個連結已被接手，不要留在 DeepLinkService 的待處理佇列，
    // 否則登出再登入時會被重複開啟。
    _deepLinks.consume(uri);
    if (_isLedgerInviteLink(uri) && !_openingDeepLink && mounted) {
      _openingDeepLink = true;
      try {
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => LedgerScreen(
              invitationToken:
                  uri.queryParameters['token'] ?? uri.queryParameters['invite'],
              onLedgerChanged: _reloadAll,
            ),
          ),
        );
        if (mounted) _reloadAll();
      } finally {
        _openingDeepLink = false;
      }
      return;
    }
    if (!_isNewTransactionLink(uri) || _openingDeepLink || !mounted) return;

    // 同步設旗標（await 前），擋掉冷啟動時 getInitialLink 與 uriLinkStream
    // 對同一連結的重複投遞；但不長存去重，讓 widget 捷徑可重複點擊記帳。
    _openingDeepLink = true;
    try {
      // 唯讀帳本不得經由捷徑／Widget 交接開啟記帳表單（計畫書 4.1／5.4）。
      // 冷啟動後唯讀旗標尚未載入，連線時先向伺服器重新確認一次角色；
      // 離線時沿用已知旗標，且逾時即放行，避免拖慢離線草稿流程。
      final readOnly = ConnectivityService.instance.online
          ? await ApiClient.instance.refreshLedgerRole().timeout(
              const Duration(seconds: 4),
              onTimeout: () => ApiClient.instance.activeLedgerReadOnly,
            )
          : ApiClient.instance.activeLedgerReadOnly;
      if (!mounted) return;
      if (readOnly) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(trKey('ledgerReadOnlyNotice'))));
        return;
      }
      final changed = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => TransactionFormScreen(
            initialType: _linkTransactionType(uri),
            initialCategoryShortcut: uri.queryParameters['category'],
            initialAmount: uri.queryParameters['amount'],
            initialAccount: uri.queryParameters['account'],
            initialCategory: uri.queryParameters['category'],
          ),
        ),
      );
      if (changed == true && mounted) {
        _backToSectionRoot(0);
        setState(() {
          _index = 0;
          _transactionsRevision++;
        });
      }
    } finally {
      _openingDeepLink = false;
    }
  }

  /// 深層連結帶入的收支類型。Siri 捷徑會帶 `type=expense|income`；
  /// 未帶或帶入無法辨識的值時回到預設的支出。
  String _linkTransactionType(Uri uri) {
    final type = uri.queryParameters['type'];
    if (type == 'income' || type == 'expense') return type!;
    return 'expense';
  }

  bool _isNewTransactionLink(Uri uri) =>
      uri.scheme == 'assetpilot' &&
      uri.host == 'transaction' &&
      uri.path == '/new';

  /// 共享帳本邀請連結：assetpilot://ledger/invite?token=…
  bool _isLedgerInviteLink(Uri uri) {
    final customScheme =
        uri.scheme == 'assetpilot' &&
        uri.host == 'ledger' &&
        uri.path == '/invite';
    final verifiedWebLink =
        uri.scheme == 'https' &&
        uri.host == 'asset.shao.one' &&
        uri.path == '/settings/ledgers';
    final token =
        uri.queryParameters['token'] ?? uri.queryParameters['invite'] ?? '';
    return (customScheme || verifiedWebLink) && token.isNotEmpty;
  }

  void _backToSectionRoot(int section) {
    _sectionNavigators[section].currentState?.popUntil(
      (route) => route.isFirst,
    );
  }

  /// 清除舊帳本的子頁與快取，並把離線草稿服務繫結到新帳本。
  void _reloadAll({int? keepSection}) {
    if (!mounted) return;
    for (var section = 0; section < _sectionNavigators.length; section++) {
      if (section != keepSection) _backToSectionRoot(section);
    }
    setState(() => _homeEpoch += 1);
    unawaited(
      OfflineDraftService.instance.bindLedger(
        ApiClient.instance.activeLedgerId,
      ),
    );
  }

  void _updateLedgerPermissions() {
    if (mounted) setState(() {});
  }

  void _refreshTransactionViews() {
    if (mounted) setState(() => _transactionsRevision++);
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardScreen(
        key: ValueKey('dashboard-$_homeEpoch'),
        transactionsRevision: _transactionsRevision,
        onTransactionsChanged: _refreshTransactionViews,
        onShowTransactions: () {
          _backToSectionRoot(1);
          setState(() => _index = 1);
        },
      ),
      TransactionsScreen(
        key: ValueKey('transactions-$_homeEpoch'),
        transactionsRevision: _transactionsRevision,
        onTransactionsChanged: _refreshTransactionViews,
        onLedgerChanged: () => _reloadAll(keepSection: 1),
      ),
      StocksScreen(key: ValueKey('stocks-$_homeEpoch')),
      MoreScreen(
        key: ValueKey('more-$_homeEpoch'),
        onLoggedOut: widget.onLoggedOut,
        onLedgerChanged: () => _reloadAll(keepSection: 3),
      ),
    ];
    final labels = [
      trKey('mobileLegacyHome'),
      trKey('uxBookkeeping'),
      trKey('featuresCommonStock'),
      trKey('mobileLegacyMore'),
    ];
    final icons = [
      (Icons.space_dashboard_outlined, Icons.space_dashboard),
      (Icons.receipt_long_outlined, Icons.receipt_long),
      (Icons.trending_up_outlined, Icons.trending_up),
      (Icons.folder_open_outlined, Icons.folder_open),
    ];
    final size = MediaQuery.sizeOf(context);
    final phonePlatform =
        !kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.iOS ||
            defaultTargetPlatform == TargetPlatform.android);
    final compact =
        size.width < 600 || (phonePlatform && size.shortestSide < 600);
    final extended = size.width >= 840;
    final content = Expanded(
      child: IndexedStack(
        index: _index,
        children: [
          for (var section = 0; section < pages.length; section++)
            NavigatorPopHandler<Object?>(
              enabled: section == _index,
              onPopWithResult: (_) {
                if (section == _index) {
                  _sectionNavigators[section].currentState?.maybePop();
                }
              },
              child: HeroControllerScope.none(
                child: Navigator(
                  key: _sectionNavigators[section],
                  pages: [MaterialPage<void>(child: pages[section])],
                  onDidRemovePage: (_) {},
                ),
              ),
            ),
        ],
      ),
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

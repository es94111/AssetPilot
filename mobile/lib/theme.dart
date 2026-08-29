import 'package:flutter/material.dart';

// ── Design scales (theme-independent) ──────────────────────────

/// 4/8 點距系統。所有版面間距請由此取值，不要散落 magic number。
abstract final class ApSpace {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
}

/// 圓角尺度（金融控制台：中等偏大的柔和圓角）。
abstract final class ApRadius {
  static const double sm = 10;
  static const double md = 14;
  static const double lg = 18;
  static const double xl = 24;
  static const double pill = 999;

  static const BorderRadius rSm = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius rMd = BorderRadius.all(Radius.circular(md));
  static const BorderRadius rLg = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius rXl = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius circle = BorderRadius.all(Radius.circular(pill));
}

/// 動態時長與曲線。所有動畫一律由此取值，並尊重系統「減少動態」設定。
abstract final class ApMotion {
  static const Duration fast = Duration(milliseconds: 120);
  static const Duration base = Duration(milliseconds: 200);
  static const Duration slow = Duration(milliseconds: 320);
  static const Duration stagger = Duration(milliseconds: 40);

  static const Curve easeOut = Curves.easeOutCubic;
  static const Curve easeIn = Curves.easeInCubic;
  static const Curve emphasized = Curves.easeInOutCubicEmphasized;
}

/// 尊重系統「減少動態效果」（無障礙）設定。
bool apReduceMotion(BuildContext context) =>
    MediaQuery.disableAnimationsOf(context);

// ── Semantic token extension ──────────────────────────────────

/// 語義色 token：收支、淨額、損益、提示與玻璃質感表面。
///
/// 補充 [ColorScheme] 讓 income / expense / net / success / warning 等語義色
/// 在淺色與深色主題各自使用對比度足夠的色階（深色模式為去飽和的 tonal 色，
/// 不是反色）。金額一律使用語義色，不可任意替換（品牌規範）。
@immutable
class AssetPilotTheme extends ThemeExtension<AssetPilotTheme> {
  /// 收入金額、正向現金流。
  final Color income;

  /// 支出金額、負向現金流。
  final Color expense;

  /// 股票未實現／已實現損益 — 正（刻意用中性 teal，非危險語義）。
  final Color profit;

  /// 股票損益 — 負（中性 orange，非危險語義）。
  final Color loss;

  /// 警告、接近上限的預算。
  final Color warning;

  /// 弱化／過期資料。
  final Color stale;

  /// 淨額、總覽統計。
  final Color net;

  /// 成功狀態（toast、完成）。
  final Color success;

  /// 資訊提示。
  final Color info;

  /// 玻璃卡片邊框（淺色＝實色灰線、深色＝ white/10）。
  final Color glassBorder;

  /// 玻璃卡片上的淡淡品牌染色（低透明度 primary）。
  final Color glassTint;

  /// 卡片陰影基色（搭配 LedgerCard 的兩層陰影使用）。
  final Color shadow;

  /// 主視覺漸層（Dashboard hero、登入卡）。
  final List<Color> heroGradient;

  /// App 外層柔和漸層（登入、引導頁背景）。
  final List<Color> pageGradient;

  const AssetPilotTheme({
    required this.income,
    required this.expense,
    required this.profit,
    required this.loss,
    required this.warning,
    required this.stale,
    required this.net,
    required this.success,
    required this.info,
    required this.glassBorder,
    required this.glassTint,
    required this.shadow,
    required this.heroGradient,
    required this.pageGradient,
  });

  static AssetPilotTheme forBrightness(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    return isDark
        // 深色模式：去飽和的 tonal 亮色，避免純飽和色在暗底上刺眼。
        ? const AssetPilotTheme(
            income: Color(0xFF34D399),
            expense: Color(0xFFFB7185),
            // 股票 P/L 刻意使用中性 teal/orange，不採用危險語義。
            profit: Color(0xFF5EEAD4),
            loss: Color(0xFFFDBA74),
            warning: Color(0xFFFBBF24),
            stale: Color(0xFF8B94A3),
            net: Color(0xFF60A5FA),
            success: Color(0xFF34D399),
            info: Color(0xFF7DD3FC),
            glassBorder: Color(0x1AFFFFFF), // white/10
            glassTint: Color(0x147B93FA),
            shadow: Color(0x66000000),
            heroGradient: [Color(0xFF1C2742), Color(0xFF151F35)],
            pageGradient: [Color(0xFF0C0F16), Color(0xFF111827), Color(0xFF0C1A2E)],
          )
        : const AssetPilotTheme(
            income: Color(0xFF047857),
            expense: Color(0xFFBE123C),
            profit: Color(0xFF0F766E),
            loss: Color(0xFFC2410C),
            warning: Color(0xFFB45309),
            stale: Color(0xFF94A3B8),
            net: Color(0xFF1D4ED8),
            success: Color(0xFF047857),
            info: Color(0xFF0369A1),
            glassBorder: Color(0xFFE4E7EC),
            glassTint: Color(0x0A4F6EF7),
            shadow: Color(0x144F6EF7),
            heroGradient: [Color(0xFFE4EAFF), Color(0xFFDCEBFF), Color(0xFFDFF3EA)],
            pageGradient: [
              Color(0xFFDDE5FF),
              Color(0xFFEEF2FF),
              Color(0xFFE0F2FE),
              Color(0xFFDCFCE7),
            ],
          );
  }

  @override
  AssetPilotTheme copyWith({
    Color? income,
    Color? expense,
    Color? profit,
    Color? loss,
    Color? warning,
    Color? stale,
    Color? net,
    Color? success,
    Color? info,
    Color? glassBorder,
    Color? glassTint,
    Color? shadow,
    List<Color>? heroGradient,
    List<Color>? pageGradient,
  }) {
    return AssetPilotTheme(
      income: income ?? this.income,
      expense: expense ?? this.expense,
      profit: profit ?? this.profit,
      loss: loss ?? this.loss,
      warning: warning ?? this.warning,
      stale: stale ?? this.stale,
      net: net ?? this.net,
      success: success ?? this.success,
      info: info ?? this.info,
      glassBorder: glassBorder ?? this.glassBorder,
      glassTint: glassTint ?? this.glassTint,
      shadow: shadow ?? this.shadow,
      heroGradient: heroGradient ?? this.heroGradient,
      pageGradient: pageGradient ?? this.pageGradient,
    );
  }

  @override
  AssetPilotTheme lerp(covariant AssetPilotTheme? other, double t) {
    if (other == null) return this;
    List<Color> lerpList(List<Color> a, List<Color> b) => List.generate(
      a.length,
      (i) => Color.lerp(a[i], b[i % b.length], t) ?? a[i],
      growable: false,
    );
    return AssetPilotTheme(
      income: Color.lerp(income, other.income, t) ?? income,
      expense: Color.lerp(expense, other.expense, t) ?? expense,
      profit: Color.lerp(profit, other.profit, t) ?? profit,
      loss: Color.lerp(loss, other.loss, t) ?? loss,
      warning: Color.lerp(warning, other.warning, t) ?? warning,
      stale: Color.lerp(stale, other.stale, t) ?? stale,
      net: Color.lerp(net, other.net, t) ?? net,
      success: Color.lerp(success, other.success, t) ?? success,
      info: Color.lerp(info, other.info, t) ?? info,
      glassBorder: Color.lerp(glassBorder, other.glassBorder, t) ?? glassBorder,
      glassTint: Color.lerp(glassTint, other.glassTint, t) ?? glassTint,
      shadow: Color.lerp(shadow, other.shadow, t) ?? shadow,
      heroGradient: lerpList(heroGradient, other.heroGradient),
      pageGradient: lerpList(pageGradient, other.pageGradient),
    );
  }
}

/// 取得目前主題的語義 token。
AssetPilotTheme apTokens(BuildContext context) =>
    Theme.of(context).extension<AssetPilotTheme>() ??
    AssetPilotTheme.forBrightness(Theme.of(context).brightness);

/// 依亮度取得語義 token（無 context 時，例如主題建構中）。
AssetPilotTheme apTokensFor(Brightness brightness) =>
    AssetPilotTheme.forBrightness(brightness);

/// 舊版 API 保留（測試與既有程式碼使用）：直接取得該亮度的語義 token。
@Deprecated('Use apTokensFor instead')
AssetPilotTheme assetPilotThemeFor(Brightness brightness) =>
    AssetPilotTheme.forBrightness(brightness);

// ── Theme builder ─────────────────────────────────────────────

/// 品牌色板（網站配色風格.md）：Primary #4F6EF7 / PrimaryDark #3B55D9 /
/// 深色模式 PrimaryLight #7B93FA。
ThemeData buildAssetPilotTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final tokens = apTokensFor(brightness);
  final scheme = ColorScheme(
    brightness: brightness,
    primary: isDark ? const Color(0xFF7B93FA) : const Color(0xFF4F6EF7),
    onPrimary: isDark ? const Color(0xFF0C1226) : Colors.white,
    primaryContainer: isDark
        ? const Color(0xFF253158)
        : const Color(0xFFE4EAFF),
    onPrimaryContainer: isDark
        ? const Color(0xFFDCE3FF)
        : const Color(0xFF1E2A6E),
    secondary: isDark ? const Color(0xFF8FA6FB) : const Color(0xFF3B55D9),
    onSecondary: isDark ? const Color(0xFF0C1226) : Colors.white,
    secondaryContainer: isDark
        ? const Color(0xFF1E2A4D)
        : const Color(0xFFE8EDFF),
    onSecondaryContainer: isDark
        ? const Color(0xFFD5DEFF)
        : const Color(0xFF24307A),
    tertiary: isDark ? const Color(0xFF5EEAD4) : const Color(0xFF0F766E),
    onTertiary: isDark ? const Color(0xFF0B3B33) : Colors.white,
    tertiaryContainer: isDark
        ? const Color(0xFF134E4A)
        : const Color(0xFFCCFBF1),
    onTertiaryContainer: isDark
        ? const Color(0xFFCCFBF1)
        : const Color(0xFF134E4A),
    error: isDark ? const Color(0xFFFCA5A5) : const Color(0xFFDC2626),
    onError: isDark ? const Color(0xFF4C0505) : Colors.white,
    errorContainer: isDark
        ? const Color(0xFF450A0A)
        : const Color(0xFFFEF2F2),
    onErrorContainer: isDark
        ? const Color(0xFFFEE2E2)
        : const Color(0xFF991B1B),
    surface: isDark ? const Color(0xFF151922) : Colors.white,
    onSurface: isDark ? const Color(0xFFE8EAEF) : const Color(0xFF1A1D26),
    surfaceContainerLowest: isDark
        ? const Color(0xFF10141C)
        : Colors.white,
    surfaceContainerLow: isDark ? const Color(0xFF12161F) : const Color(0xFFF8FAFC),
    surfaceContainer: isDark ? const Color(0xFF171C27) : const Color(0xFFF1F4F9),
    surfaceContainerHigh: isDark ? const Color(0xFF1B2230) : const Color(0xFFEAEFF5),
    surfaceContainerHighest: isDark
        ? const Color(0xFF202839)
        : const Color(0xFFE4EAF1),
    onSurfaceVariant: isDark ? const Color(0xFF9CA3B4) : const Color(0xFF5C6370),
    outline: isDark ? const Color(0xFF303B4D) : const Color(0xFFD8DEE9),
    outlineVariant: isDark ? const Color(0xFF262F3E) : const Color(0xFFE4E7EC),
    inverseSurface: isDark ? const Color(0xFFE8EAEF) : const Color(0xFF2A2F3A),
    onInverseSurface: isDark ? const Color(0xFF1A1D26) : const Color(0xFFF1F5F9),
    inversePrimary: isDark ? const Color(0xFF3B55D9) : const Color(0xFFAABFFF),
    shadow: Colors.black,
    scrim: Colors.black,
    surfaceTint: isDark ? const Color(0xFF7B93FA) : const Color(0xFF4F6EF7),
  );

  final radiusMd = ApRadius.rMd;
  final radiusLg = ApRadius.rLg;
  final shapeMd = RoundedRectangleBorder(borderRadius: radiusMd);

  TextStyle titleStyle({double? size, FontWeight? weight}) => TextStyle(
    fontSize: size,
    fontWeight: weight ?? FontWeight.w700,
    color: scheme.onSurface,
    height: 1.25,
  );

  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: isDark
        ? const Color(0xFF0C0F16)
        : const Color(0xFFF4F6FA),
    useMaterial3: true,
    extensions: [tokens],
    visualDensity: VisualDensity.standard,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    splashFactory: InkRipple.splashFactory,
    textTheme: TextTheme(
      displaySmall: titleStyle(size: 34),
      headlineMedium: titleStyle(size: 26),
      headlineSmall: titleStyle(size: 22),
      titleLarge: titleStyle(size: 19),
      titleMedium: titleStyle(size: 16),
      titleSmall: titleStyle(size: 14, weight: FontWeight.w600),
      bodyLarge: TextStyle(color: scheme.onSurface, height: 1.45),
      bodyMedium: TextStyle(color: scheme.onSurface, height: 1.4),
      bodySmall: TextStyle(color: scheme.onSurfaceVariant, height: 1.35),
      labelLarge: TextStyle(
        color: scheme.onSurface,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.1,
      ),
      labelMedium: TextStyle(
        color: scheme.onSurfaceVariant,
        fontWeight: FontWeight.w500,
      ),
      labelSmall: TextStyle(
        color: scheme.onSurfaceVariant,
        fontWeight: FontWeight.w500,
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: scheme.onSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: scheme.onSurface,
        fontSize: 21,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surface,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: ApSpace.lg,
        vertical: ApSpace.lg,
      ),
      border: OutlineInputBorder(borderRadius: radiusMd),
      enabledBorder: OutlineInputBorder(
        borderRadius: radiusMd,
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: radiusMd,
        borderSide: BorderSide(color: scheme.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: radiusMd,
        borderSide: BorderSide(color: scheme.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: radiusMd,
        borderSide: BorderSide(color: scheme.error, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.padded,
        shape: shapeMd,
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.padded,
        shape: shapeMd,
        side: BorderSide(color: scheme.outline),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.padded,
        shape: shapeMd,
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        minimumSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.padded,
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: scheme.surfaceContainerHigh,
      selectedColor: scheme.primaryContainer,
      labelStyle: TextStyle(color: scheme.onSurface, fontSize: 12),
      secondaryLabelStyle: TextStyle(color: scheme.onPrimaryContainer),
      side: BorderSide(color: scheme.outlineVariant),
      shape: RoundedRectangleBorder(borderRadius: ApRadius.rSm),
      padding: const EdgeInsets.symmetric(
        horizontal: ApSpace.md,
        vertical: ApSpace.xs,
      ),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: scheme.onSurfaceVariant,
      titleTextStyle: TextStyle(
        color: scheme.onSurface,
        fontSize: 15,
        fontWeight: FontWeight.w500,
      ),
      subtitleTextStyle: TextStyle(
        color: scheme.onSurfaceVariant,
        fontSize: 13,
        height: 1.35,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: ApSpace.lg),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? scheme.onPrimary
            : scheme.outline,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? scheme.primary
            : scheme.surfaceContainerHighest,
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      modalBackgroundColor: scheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(ApRadius.xl)),
      ),
      showDragHandle: true,
      dragHandleColor: scheme.outline,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: ApRadius.rMd),
      elevation: 2,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      indicatorColor: scheme.primaryContainer,
      height: 72,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 11.5,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected)
              ? scheme.onPrimaryContainer
              : scheme.onSurfaceVariant,
        ),
      ),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: scheme.surface,
      elevation: 0,
      indicatorColor: scheme.primaryContainer,
      useIndicator: true,
      selectedIconTheme: IconThemeData(color: scheme.onPrimaryContainer),
      unselectedIconTheme: IconThemeData(color: scheme.onSurfaceVariant),
      selectedLabelTextStyle: TextStyle(
        color: scheme.onPrimaryContainer,
        fontWeight: FontWeight.w700,
      ),
      unselectedLabelTextStyle: TextStyle(color: scheme.onSurfaceVariant),
    ),
    dividerTheme: DividerThemeData(
      color: scheme.outlineVariant,
      space: 1,
      thickness: 1,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: scheme.primary,
      linearTrackColor: scheme.surfaceContainerHighest,
      circularTrackColor: scheme.surfaceContainerHighest,
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: scheme.primary,
      foregroundColor: scheme.onPrimary,
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: ApRadius.rMd),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        shape: RoundedRectangleBorder(borderRadius: radiusMd),
        side: BorderSide(color: scheme.outlineVariant),
        selectedForegroundColor: scheme.onPrimaryContainer,
        selectedBackgroundColor: scheme.primaryContainer,
      ),
    ),
  );
}
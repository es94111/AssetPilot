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

/// 圓角尺度（Warm Console：10 → 12 → 16 → 20px 柔和圓角階梯，
/// 與 Web `--radius-sm/md/lg` 一致）。
abstract final class ApRadius {
  static const double sm = 10;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
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
/// 不是反色）。金額一律使用語義色，不可任意替換（品牌規範：
/// 收入松綠、支出磚紅、淨值赭金 —— 見「網站配色風格.md」）。
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

  /// 玻璃卡片邊框（淺色＝實色暖灰線、深色＝暖白/10）。
  final Color glassBorder;

  /// 輸入框、表頭等需要更明顯分隔的邊框。
  final Color borderStrong;

  /// 玻璃卡片上的淡淡品牌染色（低透明度 primary）。
  final Color glassTint;

  /// 卡片陰影基色（搭配 LedgerCard 的兩層陰影使用；暖中性，非藍）。
  final Color shadow;

  /// 主視覺漸層（Dashboard hero、登入卡）：暖赭 135°。
  final List<Color> heroGradient;

  /// App 外層柔和漸層（登入、引導頁背景）：暖棉紙／暖夜。
  final List<Color> pageGradient;

  /// 圖表類別色盤（暖赭為首、接語意色、之後暖色階輪替；
  /// 與 Web ReportsClient 同組）。
  final List<Color> chartPalette;

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
    required this.borderStrong,
    required this.glassTint,
    required this.shadow,
    required this.heroGradient,
    required this.pageGradient,
    required this.chartPalette,
  });

  static AssetPilotTheme forBrightness(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    return isDark
        // 暖夜：暖黑底 + 去飽和的 tonal 亮色，避免純飽和色在暗底上刺眼。
        ? const AssetPilotTheme(
            income: Color(0xFF6CC29B),
            expense: Color(0xFFE08279),
            // 股票 P/L 刻意使用中性 teal/orange，不採用危險語義。
            profit: Color(0xFF5EEAD4),
            loss: Color(0xFFFDBA74),
            warning: Color(0xFFE5B567),
            stale: Color(0xFF8F857A),
            net: Color(0xFFD3A35C),
            success: Color(0xFF6CC29B),
            info: Color(0xFFD3B083),
            glassBorder: Color(0x1AECE7DE), // 暖白/10
            borderStrong: Color(0x29ECE7DE), // 暖白/16
            glassTint: Color(0x1AE2A377),
            shadow: Color(0x66000000),
            heroGradient: [Color(0xFF2A1810), Color(0xFF241712)],
            pageGradient: [Color(0xFF141210), Color(0xFF1D1A16)],
            chartPalette: [
              Color(0xFFE09A5F),
              Color(0xFF6CC29B),
              Color(0xFFD3A35C),
              Color(0xFFE08279),
              Color(0xFFD98A4A),
              Color(0xFF7FA893),
              Color(0xFFC98A3D),
              Color(0xFFB96A5C),
              Color(0xFF97A87B),
              Color(0xFFBC8455),
            ],
          )
        : const AssetPilotTheme(
            income: Color(0xFF1E6B52),
            expense: Color(0xFFB3372F),
            profit: Color(0xFF0F766E),
            loss: Color(0xFFC2410C),
            warning: Color(0xFFB45309),
            stale: Color(0xFFA79C8D),
            net: Color(0xFF8A5A1F),
            success: Color(0xFF1E6B52),
            info: Color(0xFF9A6A2F),
            glassBorder: Color(0xFFE6DFD3),
            borderStrong: Color(0xFFD3C9B8),
            glassTint: Color(0x0FB0521C),
            shadow: Color(0x0F3C2D1E),
            heroGradient: [Color(0xFF994215), Color(0xFFB0521C), Color(0xFFD98A4A)],
            pageGradient: [Color(0xFFF8F5EF), Color(0xFFF4F0E8)],
            chartPalette: [
              Color(0xFFB0521C),
              Color(0xFF1E6B52),
              Color(0xFF8A5A1F),
              Color(0xFFB3372F),
              Color(0xFFD98A4A),
              Color(0xFF5F8D7A),
              Color(0xFFC98A3D),
              Color(0xFF9C4A3A),
              Color(0xFF7D9464),
              Color(0xFFA8683A),
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
    Color? borderStrong,
    Color? glassTint,
    Color? shadow,
    List<Color>? heroGradient,
    List<Color>? pageGradient,
    List<Color>? chartPalette,
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
      borderStrong: borderStrong ?? this.borderStrong,
      glassTint: glassTint ?? this.glassTint,
      shadow: shadow ?? this.shadow,
      heroGradient: heroGradient ?? this.heroGradient,
      pageGradient: pageGradient ?? this.pageGradient,
      chartPalette: chartPalette ?? this.chartPalette,
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
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)
          ?? borderStrong,
      glassTint: Color.lerp(glassTint, other.glassTint, t) ?? glassTint,
      shadow: Color.lerp(shadow, other.shadow, t) ?? shadow,
      heroGradient: lerpList(heroGradient, other.heroGradient),
      pageGradient: lerpList(pageGradient, other.pageGradient),
      chartPalette: lerpList(chartPalette, other.chartPalette),
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

// ── Typography helpers ────────────────────────────────────────

/// 標題襯線字體（與 Web display 同款）。內含拉丁字形；中文字符自動
/// fallback 到系統字體，不影響中文排版。
const String apDisplayFontFamily = 'Fraunces';

/// 金額／數字樣式：tabular figures 使多位數金額直向對齊、跳動最小。
/// 規範要求金額與表格數字一律等寬。
TextStyle apMoneyStyle(
  BuildContext context, {
  double? fontSize,
  FontWeight? fontWeight,
  Color? color,
  double? height,
}) {
  return TextStyle(
    fontSize: fontSize,
    fontWeight: fontWeight ?? FontWeight.w600,
    color: color,
    height: height,
    fontFeatures: const [FontFeature.tabularFigures()],
  );
}

// ── Theme builder ─────────────────────────────────────────────

/// 品牌色板（網站配色風格.md「Warm Console」）：暖赭 Primary #B0521C /
/// PrimarySolid #A8481A / PrimaryDark #994215；深色模式（暖夜）主色為
/// 亮赭 #E2A377，實心按鈕維持深赭 #A8481A 配白字。
ThemeData buildAssetPilotTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final tokens = apTokensFor(brightness);

  // 實心主按鈕底色：雙主題皆為深赭（暗底白字對比 5.16:1）。
  const primarySolid = Color(0xFFA8481A);
  final scheme = ColorScheme(
    brightness: brightness,
    // 暗色模式 primary 用亮赭（文字、連結、圖示），實心按鈕由下方
    // FilledButtonTheme 覆寫為 primarySolid。
    primary: isDark ? const Color(0xFFE2A377) : const Color(0xFFB0521C),
    onPrimary: isDark ? const Color(0xFF2A1810) : Colors.white,
    primaryContainer: isDark
        ? const Color(0xFF3A2417)
        : const Color(0xFFF6E3D3),
    onPrimaryContainer: isDark
        ? const Color(0xFFF1D4B8)
        : const Color(0xFF6E320E),
    secondary: isDark ? const Color(0xFFD3A35C) : const Color(0xFF8A5A1F),
    onSecondary: isDark ? const Color(0xFF241712) : Colors.white,
    secondaryContainer: isDark
        ? const Color(0xFF2E2312)
        : const Color(0xFFF1E6CF),
    onSecondaryContainer: isDark
        ? const Color(0xFFE7D6B2)
        : const Color(0xFF59390F),
    tertiary: isDark ? const Color(0xFF6CC29B) : const Color(0xFF1E6B52),
    onTertiary: isDark ? const Color(0xFF0D241B) : Colors.white,
    tertiaryContainer: isDark
        ? const Color(0xFF1C3A2D)
        : const Color(0xFFD9EDE4),
    onTertiaryContainer: isDark
        ? const Color(0xFFC4E8D6)
        : const Color(0xFF14503D),
    error: isDark ? const Color(0xFFE08279) : const Color(0xFFB3372F),
    onError: isDark ? const Color(0xFF3B120E) : Colors.white,
    errorContainer: isDark
        ? const Color(0xFF3B1D19)
        : const Color(0xFFF9E4E1),
    onErrorContainer: isDark
        ? const Color(0xFFF3C1BB)
        : const Color(0xFF8A2B24),
    // 暖棉紙（亮）：卡片近白 #FFFDF9；暖夜（暗）：暖黑卡片 #1D1A16。
    surface: isDark ? const Color(0xFF1D1A16) : const Color(0xFFFFFDF9),
    onSurface: isDark ? const Color(0xFFECE7DE) : const Color(0xFF26221C),
    surfaceContainerLowest: isDark
        ? const Color(0xFF181512)
        : const Color(0xFFFFFDF9),
    surfaceContainerLow: isDark
        ? const Color(0xFF191612)
        : const Color(0xFFF8F5EF),
    surfaceContainer: isDark
        ? const Color(0xFF1E1A15)
        : const Color(0xFFF4F0E8),
    surfaceContainerHigh: isDark
        ? const Color(0xFF242019)
        : const Color(0xFFEFE9DF),
    surfaceContainerHighest: isDark
        ? const Color(0xFF2A251E)
        : const Color(0xFFEAE3D6),
    onSurfaceVariant: isDark ? const Color(0xFFB3A99C) : const Color(0xFF6B6157),
    outline: isDark ? const Color(0xFF4A433A) : const Color(0xFFD3C9B8),
    outlineVariant: isDark
        ? const Color(0x1AECE7DE)
        : const Color(0xFFE6DFD3),
    inverseSurface: isDark
        ? const Color(0xFFECE7DE)
        : const Color(0xFF2C2822),
    onInverseSurface: isDark
        ? const Color(0xFF26221C)
        : const Color(0xFFF7F4EE),
    inversePrimary: isDark ? const Color(0xFFB0521C) : const Color(0xFFE2A377),
    shadow: Colors.black,
    scrim: Colors.black,
    surfaceTint: isDark ? const Color(0xFFE2A377) : const Color(0xFFB0521C),
  );

  final radiusMd = ApRadius.rMd;
  final shapeMd = RoundedRectangleBorder(borderRadius: radiusMd);

  TextStyle titleStyle({double? size, FontWeight? weight}) => TextStyle(
    fontSize: size,
    fontWeight: weight ?? FontWeight.w700,
    color: scheme.onSurface,
    height: 1.25,
    // 標題套襯線 display 字體；中文字符自動 fallback 系統字。
    fontFamily: apDisplayFontFamily,
  );

  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: isDark
        ? const Color(0xFF141210)
        : const Color(0xFFF7F4EE),
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
      titleSmall: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: scheme.onSurface,
        height: 1.25,
      ),
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
        fontWeight: FontWeight.w700,
        fontFamily: apDisplayFontFamily,
        // 中文不套負字距（品牌規範）；負字距只限拉丁 display 標題。
        height: 1.25,
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
        borderSide: BorderSide(color: tokens.borderStrong),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: radiusMd,
        borderSide: const BorderSide(color: primarySolid, width: 2),
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
        // 實心主按鈕：深赭底白字（雙主題一致；暗色模式 primary 文字色
        // 為亮赭，但實心按鈕依規範維持深赭）。
        backgroundColor: primarySolid,
        foregroundColor: Colors.white,
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
        side: BorderSide(
          color: isDark
              ? const Color(0x26ECE7DE) // 暖白/15
              : scheme.outline,
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.padded,
        shape: shapeMd,
        foregroundColor: scheme.primary,
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
      side: BorderSide(color: tokens.glassBorder),
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
            ? (isDark ? const Color(0xFFB0521C) : scheme.primary)
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
      color: tokens.glassBorder,
      space: 1,
      thickness: 1,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: scheme.primary,
      linearTrackColor: scheme.surfaceContainerHighest,
      circularTrackColor: scheme.surfaceContainerHighest,
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: primarySolid,
      foregroundColor: Colors.white,
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: ApRadius.rMd),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        shape: RoundedRectangleBorder(borderRadius: radiusMd),
        side: BorderSide(color: tokens.glassBorder),
        selectedForegroundColor: scheme.onPrimaryContainer,
        selectedBackgroundColor: scheme.primaryContainer,
      ),
    ),
  );
}
import 'package:flutter/material.dart';

/// Semantic colors shared by financial UI surfaces and indicators.
///
/// These values complement [ColorScheme] so income, expense, profit/loss and
/// stale-data states remain distinguishable in both light and dark themes.
@immutable
class AssetPilotTheme extends ThemeExtension<AssetPilotTheme> {
  final Color income;
  final Color expense;
  final Color profit;
  final Color loss;
  final Color warning;
  final Color stale;

  const AssetPilotTheme({
    required this.income,
    required this.expense,
    required this.profit,
    required this.loss,
    required this.warning,
    required this.stale,
  });

  @override
  AssetPilotTheme copyWith({
    Color? income,
    Color? expense,
    Color? profit,
    Color? loss,
    Color? warning,
    Color? stale,
  }) {
    return AssetPilotTheme(
      income: income ?? this.income,
      expense: expense ?? this.expense,
      profit: profit ?? this.profit,
      loss: loss ?? this.loss,
      warning: warning ?? this.warning,
      stale: stale ?? this.stale,
    );
  }

  @override
  AssetPilotTheme lerp(covariant AssetPilotTheme? other, double t) {
    if (other == null) return this;
    return AssetPilotTheme(
      income: Color.lerp(income, other.income, t) ?? income,
      expense: Color.lerp(expense, other.expense, t) ?? expense,
      profit: Color.lerp(profit, other.profit, t) ?? profit,
      loss: Color.lerp(loss, other.loss, t) ?? loss,
      warning: Color.lerp(warning, other.warning, t) ?? warning,
      stale: Color.lerp(stale, other.stale, t) ?? stale,
    );
  }
}

AssetPilotTheme assetPilotThemeFor(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  return AssetPilotTheme(
    income: isDark ? const Color(0xFF6EE7B7) : const Color(0xFF047857),
    expense: isDark ? const Color(0xFFFDA4AF) : const Color(0xFFBE123C),
    // Stock P/L deliberately uses neutral teal/orange, not danger semantics.
    profit: isDark ? const Color(0xFF5EEAD4) : const Color(0xFF0F766E),
    loss: isDark ? const Color(0xFFFDBA74) : const Color(0xFFC2410C),
    warning: isDark ? const Color(0xFFFCD34D) : const Color(0xFF92400E),
    stale: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF475569),
  );
}

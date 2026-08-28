import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'l10n.dart';
import 'theme.dart';

/// 金額與顏色格式化工具。

/// 格式化為 TWD 整數金額：NT$ 1,234
String twd(num v) => NumberFormat.currency(
  locale: appIntlLocaleTag(),
  symbol: 'NT\$ ',
  decimalDigits: 0,
).format(v);

/// 千分位整數
String intFmt(num v) =>
    NumberFormat.decimalPattern(appIntlLocaleTag()).format(v);

/// 依貨幣格式化（小數兩位，TWD 不顯示小數）
String money(num v, String currency) {
  final normalized = currency.trim().toUpperCase();
  final digits = normalized == 'TWD' ? 0 : 2;
  return NumberFormat.currency(
    locale: appIntlLocaleTag(),
    name: normalized,
    decimalDigits: digits,
  ).format(v);
}

/// 帶正負號的金額（用於損益）：+1,234 / -567
String signed(num v) {
  final formatted = NumberFormat.decimalPattern(
    appIntlLocaleTag(),
  ).format(v.abs());
  if (v > 0) return '+$formatted';
  if (v < 0) return '−$formatted';
  return formatted;
}

/// 解析 `#RRGGBB` 顏色字串，失敗回傳灰色。
Color parseColor(String hex) {
  var h = hex.replaceAll('#', '').trim();
  if (h.length == 6) h = 'FF$h';
  final value = int.tryParse(h, radix: 16);
  return value == null ? const Color(0xFF888888) : Color(value);
}

/// 損益正負對應中性的 teal/orange 語義色；不把損益誤表達為危險狀態。
Color plColor(num v, BuildContext context) {
  final semantic = apTokens(context);
  if (v > 0) return semantic.profit;
  if (v < 0) return semantic.loss;
  return Theme.of(context).colorScheme.onSurfaceVariant;
}

/// 收入／支出使用的語義顏色，避免畫面散落 raw colors。
Color flowColor({required bool income, required BuildContext context}) {
  final semantic = apTokens(context);
  if (income) return semantic.income;
  return semantic.expense;
}

/// 淨額／總覽統計語義色。
Color netColor(BuildContext context) => apTokens(context).net;

/// 計算帶方向符號的 accessible label，供金額與圖表旁的 Semantics 使用。
String signedLabel(num v, String label) {
  if (v > 0) return '$label, positive';
  if (v < 0) return '$label, negative';
  return '$label, zero';
}

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// 金額與顏色格式化工具。

final _twd = NumberFormat.currency(
  locale: 'zh_TW',
  symbol: 'NT\$ ',
  decimalDigits: 0,
);
final _int = NumberFormat.decimalPattern('zh_TW');

/// 格式化為 TWD 整數金額：NT$ 1,234
String twd(num v) => _twd.format(v);

/// 千分位整數
String intFmt(num v) => _int.format(v);

/// 依貨幣格式化（小數兩位，TWD 不顯示小數）
String money(num v, String currency) {
  final digits = currency == 'TWD' ? 0 : 2;
  return NumberFormat.currency(
    locale: 'zh_TW',
    symbol: '$currency ',
    decimalDigits: digits,
  ).format(v);
}

/// 帶正負號的金額（用於損益）：+1,234 / -567
String signed(num v) => (v >= 0 ? '+' : '') + _int.format(v);

/// 解析 `#RRGGBB` 顏色字串，失敗回傳灰色。
Color parseColor(String hex) {
  var h = hex.replaceAll('#', '').trim();
  if (h.length == 6) h = 'FF$h';
  final value = int.tryParse(h, radix: 16);
  return value == null ? const Color(0xFF888888) : Color(value);
}

/// 損益正負對應的顏色（漲紅跌綠，符合台股慣例）。
Color plColor(num v, BuildContext context) {
  if (v > 0) return const Color(0xFFD32F2F);
  if (v < 0) return const Color(0xFF2E7D32);
  return Theme.of(context).colorScheme.onSurfaceVariant;
}

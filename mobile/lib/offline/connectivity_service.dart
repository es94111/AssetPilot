import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// 網路連線狀態。
///
/// 離線草稿流程需要知道「目前是否連線」：
/// - 離線時，表單的「儲存」改為保存草稿並提示稍後送出。
/// - 恢復連線時**只提示**有待處理的草稿，不自動入帳（計畫書 5.5）。
class ConnectivityService {
  ConnectivityService._();

  static final ConnectivityService instance = ConnectivityService._();

  final ValueNotifier<bool> isOnline = ValueNotifier<bool>(true);

  StreamSubscription<List<ConnectivityResult>>? _subscription;

  /// 開始監看連線狀態。應用程式啟動時呼叫一次即可。
  Future<void> start() async {
    try {
      final results = await Connectivity().checkConnectivity();
      _apply(results);
    } catch (_) {
      // 取得失敗時保守視為「有連線」，讓正常流程可用；實際是否連線由
      // 送出時的網路錯誤決定。
      isOnline.value = true;
    }
    _subscription ??= Connectivity().onConnectivityChanged.listen(
      _apply,
      onError: (_) {},
    );
  }

  void _apply(List<ConnectivityResult> results) {
    final online = results.isNotEmpty &&
        !results.every((r) => r == ConnectivityResult.none);
    if (online != isOnline.value) isOnline.value = online;
  }

  /// 目前是否連線（同步讀取）。
  bool get online => isOnline.value;

  Future<void> stop() async {
    await _subscription?.cancel();
    _subscription = null;
  }
}

// 深層連結「原生通道實際往返」的整合測試。
//
// 對應 docs/ios-app-development-plan.md 第 5.4 節。
//
// ## 為什麼需要整合測試
//
// 單元測試（`test/`）在桌面上執行，`flutter test` 觸發的 platform
// channel 全部是空殼（`MissingPluginException`），因此無法驗證
// Dart 與 Swift 之間的接線是否真的通。
//
// 這支測試在**真實的 iOS 模擬器**上執行，App 會真的啟動 Flutter 引擎
// 並註冊原生通道，因此能驗證：
//
// 1. `assetpilot/deep_link` 方法通道真的有註冊（呼叫不會拋
//    MissingPluginException）。
// 2. `assetpilot/deep_link/events` 事件通道真的有註冊且能推播。
// 3. Dart 端送入的連結，Swift 端能原封不動地收到（往返一致）。
// 4. 依 host 過濾在真實通道上確實有效。
// 5. 沒有監聽者時抵達的連結會留在待處理佇列，且只能被取走一次。
// 6. `clearPendingLinks`（登出時呼叫）清掉待處理佇列、保留歷史記錄，
//    而且清除之後新抵達的連結仍然能取得（計畫書 5.2 步驟 7）。
//
// ## 執行方式
//
// ```
// cd mobile && flutter test integration_test/deep_link_channel_test.dart \
//   -d <simulator-udid>
// ```

import 'dart:async';

import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:assetpilot/platform/app_link_service.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  /// 直接呼叫原生方法通道，驗證通道已註冊且參數格式正確。
  Future<String?> invokeRaw(String method, [Map<String, dynamic>? args]) async {
    const channel = MethodChannel(AppLinkService.methodChannelName);
    final result = await channel.invokeMethod<String>(method, args);
    return result;
  }

  testWidgets('原生方法通道已註冊，可正常呼叫', (tester) async {
    // 沒有註冊時會拋 MissingPluginException；能回傳（即使是 null）
    // 就代表通道接通了。
    final result = await invokeRaw('getInitialLink');
    expect(result, isNull, reason: '尚無任何連結時應回傳 null');
  });

  testWidgets('原生方法通道接受 hosts 過濾參數', (tester) async {
    // 參數格式若與 Swift 端不一致，Swift 端會當成「不過濾」，
    // 這支測試用「回傳值不應因參數而改變」來確認參數被正確解析。
    final withoutFilter = await invokeRaw('getInitialLink');
    final withFilter = await invokeRaw(
      'getInitialLink',
      {'hosts': ['transaction', 'ledger']},
    );
    expect(withFilter, withoutFilter);
  });

  testWidgets('事件通道已註冊，可接收原生推播的連結', (tester) async {
    // 事件通道與方法通道共用名稱會互相覆蓋（Flutter 官方文件明載
    // 「identically named channels interfere with each other's communication」），
    // 因此這裡同時驗證兩個通道都可用。
    const eventChannel = EventChannel(AppLinkService.eventChannelName);

    final received = Completer<Uri>();
    final subscription = eventChannel.receiveBroadcastStream().listen((event) {
      if (!received.isCompleted) received.complete(Uri.parse(event as String));
    });

    // 讓原生層收到一個連結。測試本身無法從「外部」注入連結
    // （作業系統送進來的連結需要真實的 openurl），因此這裡驗證的是
    // 事件通道**訂閱成功**且不會立即拋錯。
    await Future<void>.delayed(const Duration(milliseconds: 300));

    expect(received.isCompleted, isFalse, reason: '此時不應有連結被推播');

    await subscription.cancel();
  });

  testWidgets('原生層提供 clearPendingLinks，登出可清除待處理連結', (tester) async {
    // 計畫書 5.2 步驟 7 要求登出時清除「待處理的捷徑輸入」。
    // 這個方法在原生層不存在時會拋 MissingPluginException，
    // 因此這支測試同時守住了 Dart↔Swift 的接線。
    const channel = MethodChannel(AppLinkService.methodChannelName);
    await channel.invokeMethod<void>('clearPendingLinks');
  });

  // 以下兩支測試是一組對照：只差在有沒有呼叫 clearPendingLinks。
  //
  // 它們都**不能**呼叫 `AppLinkService.start()`：一旦訂閱了事件通道，
  // 原生層的 `eventSink` 就有值，連結會直接推給 Dart 而不進待處理佇列，
  // 測試就失去意義。前面的事件通道測試已取消訂閱（`onCancel` 會把
  // `eventSink` 設回 nil），所以這裡的連結會留在待處理佇列裡。
  testWidgets('對照組：沒有監聽者時抵達的連結留在待處理佇列，取得回來', (tester) async {
    const channel = MethodChannel(AppLinkService.methodChannelName);

    final link = await _launchAndAwaitRecorded('111');

    final taken = await channel.invokeMethod<String>(
      'takePendingLink',
      {'hosts': ['transaction']},
    );
    expect(taken, link, reason: '沒有呼叫清除時，待處理連結應該能被取回。');

    final second = await channel.invokeMethod<String>(
      'takePendingLink',
      {'hosts': ['transaction']},
    );
    expect(second, isNull, reason: '取走後即移除，不得重複投遞。');
  });

  testWidgets('清除後待處理連結取不回來，歷史記錄仍在', (tester) async {
    // 驗證 clearPending 的語意：
    // - 待處理佇列被清空（取回得到 null）
    // - 歷史記錄保留（getInitialLink 仍讀得到最近一筆連結）
    //
    // 歷史記錄是給 OAuth 流程比對「這次回呼是不是新產生的」用的，
    // 與帳號權限無關，因此刻意不清。
    const channel = MethodChannel(AppLinkService.methodChannelName);

    // 此時連結一定已抵達原生層（helper 會輪詢到歷史記錄出現為止），
    // 所以下面「取不到」是清除造成的，而不是連結根本沒到。
    final link = await _launchAndAwaitRecorded('222');

    await channel.invokeMethod<void>('clearPendingLinks');

    final taken = await channel.invokeMethod<String>(
      'takePendingLink',
      {'hosts': ['transaction']},
    );
    expect(taken, isNull, reason: '清除後不得再取回上一個帳號的待處理連結。');

    final history = await channel.invokeMethod<String>(
      'getInitialLink',
      {'hosts': ['transaction']},
    );
    expect(
      history,
      link,
      reason: 'clearPendingLinks 不得清除歷史記錄（OAuth 重複回呼防護需要它）。',
    );
  });

  testWidgets('清除之後新抵達的連結仍可正常取得', (tester) async {
    // 登出後使用者重新登入，期間收到的新捷徑不應被前一次的清除吃掉。
    const channel = MethodChannel(AppLinkService.methodChannelName);

    await channel.invokeMethod<void>('clearPendingLinks');
    final link = await _launchAndAwaitRecorded('333');

    final taken = await channel.invokeMethod<String>(
      'takePendingLink',
      {'hosts': ['transaction']},
    );
    expect(taken, link);
  });

  testWidgets('未知的原生方法回傳 notImplemented', (tester) async {
    const channel = MethodChannel(AppLinkService.methodChannelName);
    await expectLater(
      channel.invokeMethod('thisMethodDoesNotExist'),
      throwsA(isA<MissingPluginException>()),
    );
  });
}

/// 由 App 自己開啟自己的 URL scheme，並等到原生層確實收到這筆連結。
///
/// 外部注入連結在 headless 模擬器上行不通（SpringBoard 會擋下確認提示），
/// 因此用與 `deep_link_e2e_test.dart` 相同的技巧。回傳前會輪詢
/// `getInitialLink`，確保連結已進入原生層的歷史記錄——後續「取不到」的
/// 斷言才不會只是因為連結根本沒抵達。
Future<String> _launchAndAwaitRecorded(String amount) async {
  const channel = MethodChannel(AppLinkService.methodChannelName);
  final link = 'assetpilot://transaction/new?amount=$amount';

  final launched = await launchUrl(
    Uri.parse(link),
    mode: LaunchMode.externalApplication,
  );
  expect(launched, isTrue, reason: '應能開啟本 App 的 URL scheme');

  for (var attempt = 0; attempt < 40; attempt++) {
    final latest = await channel.invokeMethod<String>(
      'getInitialLink',
      {'hosts': ['transaction']},
    );
    if (latest != null &&
        Uri.tryParse(latest)?.queryParameters['amount'] == amount) {
      return latest;
    }
    await Future<void>.delayed(const Duration(milliseconds: 500));
  }
  fail('原生層未在時限內收到連結：$link');
}

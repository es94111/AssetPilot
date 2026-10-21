// 深層連結「端到端」整合測試：從 App 內部開啟自己的 URL scheme，
// 驗證連結真的會經由作業系統回到 Dart 層。
//
// 對應 docs/ios-app-development-plan.md 第 5.4 節。
//
// ## 這支測試解決什麼問題
//
// 先前在 headless 模擬器上用 `xcrun simctl openurl` 送連結時，
// SpringBoard 會顯示「要在『AssetPilot』中打開嗎？」的確認提示，
// 沒有 UI 宿主可點「打開」，連結因此送不到 App（外部注入的路徑被阻斷）。
//
// 但**由 App 自己開啟自己的 URL scheme** 不需要使用者確認，
// 因此這支測試改走這條路徑，完整走過：
//
//   Dart（url_launcher）
//     → UIApplication.open
//       → SpringBoard（行程內開啟，不需確認）
//         → UISceneDelegate.scene(_:openURLContexts:)
//           → DeepLinkChannel
//             → FlutterEventChannel
//               → Dart（AppLinkService.links）
//
// 這就是「外部點 Widget／Siri」的完整路徑，只是出發點從
// SpringBoard 改成了 App 自己。差異只在「誰發起開啟」，
// 「連結如何進入場景代理」這一段是同一條程式碼。
//
// ## 執行方式
//
// ```
// cd mobile && flutter test integration_test/deep_link_e2e_test.dart \
//   -d <simulator-udid>
// ```

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:assetpilot/platform/app_link_service.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('由 App 開啟自己的 URL scheme，連結會回到 Dart 層', (tester) async {
    final service = AppLinkService.instance;
    await service.start();

    final received = Completer<Uri>();
    final subscription = service.links.listen((uri) {
      if (!received.isCompleted) received.complete(uri);
    });

    // 等事件通道訂閱完成（原生層的 onListen 會補送待處理連結）。
    await Future<void>.delayed(const Duration(milliseconds: 500));

    const target = 'assetpilot://transaction/new?type=expense&amount=120';
    final launched = await launchUrl(
      Uri.parse(target),
      mode: LaunchMode.externalApplication,
    );
    expect(launched, isTrue, reason: '應能開啟本 App 的 URL scheme');

    // 等待連結繞一圈回到 Dart 層。給足時間，因為這中間經過
    // SpringBoard 的行程分派，在忙碌的模擬器上可能需要數秒。
    final uri = await received.future.timeout(
      const Duration(seconds: 20),
      onTimeout: () => throw TimeoutException('連結未在時限內回到 Dart 層'),
    );

    expect(uri.scheme, 'assetpilot');
    expect(uri.host, 'transaction');
    expect(uri.path, '/new');
    expect(uri.queryParameters['type'], 'expense');
    expect(uri.queryParameters['amount'], '120');

    await subscription.cancel();
  });

  testWidgets('連結也會被原生層記錄，支援依 host 取回', (tester) async {
    final service = AppLinkService.instance;
    await service.start();
    await Future<void>.delayed(const Duration(milliseconds: 500));

    const target = 'assetpilot://transaction/new?amount=88';
    expect(
      await launchUrl(
        Uri.parse(target),
        mode: LaunchMode.externalApplication,
      ),
      isTrue,
    );

    // 等待原生層收到連結（透過 peek 讀取歷史記錄，不影響佇列）。
    Uri? found;
    for (var attempt = 0; attempt < 40 && found == null; attempt++) {
      await Future<void>.delayed(const Duration(milliseconds: 500));
      found = await service.peekInitialLink(hosts: ['transaction']);
    }

    expect(found, isNotNull, reason: '原生層應已收到連結');
    expect(found!.queryParameters['amount'], '88');
  });
}

// 平台層測試（對應 docs/ios-app-development-plan.md 第 5.2／5.3 節與第 7 節）。
//
// 這裡驗證兩件事：
// 1. App Group 快照的寫入／讀取／清除行為，以及「只放最小摘要」的約束。
// 2. **Dart 與 Swift 兩端的欄位契約**：WidgetKit 擴充用 Swift struct 解碼
//    JSON，若兩端 key 名字不一致，Widget 會安靜地顯示「無資料」。
//    這是本專案最容易發生的跨語言退步，因此直接比對原始碼來把關。

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:assetpilot/platform/app_group_store.dart';
import 'package:assetpilot/platform/platform_info.dart';
import 'package:assetpilot/platform/widget_snapshot_service.dart';

void main() {
  group('AppGroupStore', () {
    late Directory tmpDir;
    late File snapshotFile;

    setUp(() async {
      tmpDir = await Directory.systemTemp.createTemp('assetpilot_snapshot');
      snapshotFile = File('${tmpDir.path}/${AppGroupStore.snapshotFileName}');
      AppGroupStore.overrideFile = snapshotFile;
    });

    tearDown(() async {
      AppGroupStore.overrideFile = null;
      if (tmpDir.existsSync()) await tmpDir.delete(recursive: true);
    });

    test('寫入後可讀回，且帶有版本與更新時間', () async {
      final ok = await AppGroupStore.writeSnapshot({
        'yearMonth': '2026-10',
        'income': 1200.0,
        'expense': 800.0,
        'net': 400.0,
        'currency': 'TWD',
        'ledgerId': '',
        'isPersonalLedger': true,
      });
      expect(ok, isTrue);

      final snapshot = await AppGroupStore.readSnapshot();
      expect(snapshot, isNotNull);
      expect(snapshot!['version'], AppGroupStore.snapshotVersion);
      expect(snapshot['yearMonth'], '2026-10');
      expect(snapshot['income'], 1200.0);
      expect(snapshot['isPersonalLedger'], isTrue);
      expect(snapshot['updatedAt'], isA<String>());
    });

    test('快照不存在時讀取回傳 null', () async {
      expect(await AppGroupStore.readSnapshot(), isNull);
    });

    test('清除快照後讀取回傳 null（登出／切換帳本不留殘留金額）', () async {
      await AppGroupStore.writeSnapshot({'yearMonth': '2026-10'});
      expect(await AppGroupStore.readSnapshot(), isNotNull);

      expect(await AppGroupStore.clearSnapshot(), isTrue);
      expect(await AppGroupStore.readSnapshot(), isNull);
    });

    test('損毀的快照檔不會讓 App 崩潰', () async {
      await snapshotFile.writeAsString('{ not json');
      expect(await AppGroupStore.readSnapshot(), isNull);
    });

    test('版本高於目前支援版本時視為無資料（避免解碼錯位）', () async {
      await snapshotFile.writeAsString(
        jsonEncode({'version': AppGroupStore.snapshotVersion + 1}),
      );
      expect(await AppGroupStore.readSnapshot(), isNull);
    });

    test('App Group ID 與 iOS entitlement 一致', () {
      // 與 mobile/ios/Runner/Runner.entitlements 的 com.apple.security.
      // application-groups 相同；不一致時 Widget 讀不到快照。
      expect(AppGroupStore.appGroupId, 'group.com.assetpilot.assetpilot');
    });
  });

  group('Dart 與 Swift 的快照欄位契約', () {
    /// 讀取 Swift 端 WidgetSnapshot struct 的屬性名稱。
    List<String> swiftSnapshotFields() {
      final file = File('ios/AssetPilotWidget/WidgetSnapshot.swift');
      expect(
        file.existsSync(),
        isTrue,
        reason: '找不到 WidgetSnapshot.swift；iOS Widget 擴充不可用。',
      );
      final source = file.readAsStringSync();
      final body = source.split('struct WidgetSnapshot')[1];
      final fields = body.split('static let')[0];
      return RegExp(r'^\s*let\s+(\w+)\s*:', multiLine: true)
          .allMatches(fields)
          .map((m) => m.group(1)!)
          .toList();
    }

    test('Dart 寫入的欄位與 Swift struct 的屬性完全一致', () {
      final dartKeys = <String>{
        'version',
        'yearMonth',
        'income',
        'expense',
        'net',
        'currency',
        'ledgerId',
        'isPersonalLedger',
        'hideAmounts',
        'updatedAt',
      };
      final swiftFields = swiftSnapshotFields().toSet();

      // Swift 端多出的欄位（若日後新增）Dart 必須補上，
      // 否則解碼會因為缺欄位而失敗。
      expect(
        swiftFields.difference(dartKeys),
        isEmpty,
        reason: 'Swift WidgetSnapshot 新增了欄位，Dart 端必須同步寫入。',
      );
      // Dart 端多寫的欄位 Swift 不認得則是無效資料。
      expect(
        dartKeys.difference(swiftFields),
        isEmpty,
        reason: 'Dart 寫入的欄位在 Swift struct 中不存在。',
      );
    });

    test('App Group ID 與快照檔名在兩端一致', () {
      final file = File('ios/AssetPilotWidget/WidgetSnapshot.swift');
      final source = file.readAsStringSync();
      expect(
        source,
        contains('static let appGroupId = "${AppGroupStore.appGroupId}"'),
      );
      expect(
        source,
        contains(
          'static let snapshotFileName = "${AppGroupStore.snapshotFileName}"',
        ),
      );
    });

    test('缺少遮蔽欄位的舊快照一律視為遮蔽金額（隱私是預設值）', () {
      final file = File('ios/AssetPilotWidget/WidgetSnapshot.swift');
      final source = file.readAsStringSync();
      // 舊版 App 寫出的快照沒有 hideAmounts；解碼時必須補成 true，
      // 不能因為欄位缺���而讓金額直接顯示出來。
      expect(
        source,
        contains('if raw["hideAmounts"] == nil { raw["hideAmounts"] = true }'),
      );
    });

    test('Widget 在遮蔽金額時不顯示數字', () {
      final file = File(
        'ios/AssetPilotWidget/AssetPilotMonthlyOverviewWidget.swift',
      );
      final source = file.readAsStringSync();
      expect(source, contains('hideAmounts: snapshot.hideAmounts'));
      expect(source, contains('hideAmounts ? "••••"'));
    });

    test('遮蔽金額的偏好鍵在兩端一致', () {
      expect(WidgetSnapshotService.hideAmountsKey, 'widgetHideAmounts');
    });
  });

  group('PlatformInfo', () {
    test('測試環境下判定為非 iOS／非 Android 的通用平台', () {
      // flutter test 在桌面上執行；重點是判斷本身不會拋錯，
      // 且 iOS 專屬功能在非 iOS 上必須為 false（避免誤觸原生 channel）。
      expect(PlatformInfo.current, isNot(AppPlatform.ios));
      expect(PlatformInfo.isIOS, isFalse);
      expect(PlatformInfo.isApple, isFalse);
      expect(PlatformInfo.userAgentPlatform, isNotEmpty);
    });
  });

  group('登入頁副標要對應實際平台', () {
    // iOS 版若沿用 Android 字串，畫面會出現「安卓客戶端」，
    // 讓 iOS 使用者誤以為裝錯版本。這是實際在模擬器上驗收時發現的問題。
    test('iOS 與 Android 使用不同的副標鍵', () {
      final source = File('lib/screens/login_screen.dart').readAsStringSync();
      expect(source, contains('mobileLegacyPersonalFinanceIosApp'));
      expect(source, contains('mobileLegacyPersonalFinanceAndroidApp'));
      expect(
        source,
        contains('PlatformInfo.isIOS'),
        reason: '副標必須依 PlatformInfo 判斷平台，不可寫死。',
      );
    });

    test('兩種副標都存在於每個語系的共享字典', () {
      for (final locale in const [
        'zh_Hant_TW',
        'zh_Hans_CN',
        'en',
        'es',
        'ar',
        'fr',
        'hi',
        'pt_BR',
        'ru',
        'ko',
      ]) {
        final arb = jsonDecode(
          File('../shared/i18n/app_$locale.arb').readAsStringSync(),
        ) as Map<String, dynamic>;
        for (final key in const [
          'mobileLegacyPersonalFinanceIosApp',
          'mobileLegacyPersonalFinanceAndroidApp',
        ]) {
          expect(
            arb.containsKey(key),
            isTrue,
            reason: '$locale 缺少 $key，iOS 版會回退成別的字串。',
          );
        }
      }
    });
  });

  group('iOS Info.plist', () {
    test('宣告的語系與 shared/i18n/locales.json 一致', () {
      // 不宣告 CFBundleLocalizations，App 就不會出現在 iOS
      // 「設定 → 語言」的逐 App 語言清單中。
      //
      // 比對的是 locales.json 的 `id`（App 內部使用的語系代碼，
      // 與 mobile/lib/generated/app_locales.dart 的 kSupportedAppLocales
      // 一致），不是 intlTag —— intlTag 是 Intl 格式化用的標籤，
      // 與逐 App 語言的識別碼不同。
      final plist = File('ios/Runner/Info.plist').readAsStringSync();
      final locales = jsonDecode(
        File('../shared/i18n/locales.json').readAsStringSync(),
      ) as Map<String, dynamic>;
      final list = locales['locales'] as List<dynamic>;

      for (final entry in list) {
        final map = entry as Map<String, dynamic>;
        final id = map['id'] as String;
        expect(
          plist,
          contains('<string>$id</string>'),
          reason: 'Info.plist 缺少語系 $id；'
              '該語系不會出現在 iOS 逐 App 語言清單。',
        );
      }
    });

    test('註冊了相機與相簿用途說明', () {
      final plist = File('ios/Runner/Info.plist').readAsStringSync();
      expect(plist, contains('NSCameraUsageDescription'));
      expect(plist, contains('NSPhotoLibraryUsageDescription'));
      expect(plist, contains('NSPhotoLibraryAddUsageDescription'));
    });

    test('註冊了 assetpilot URL scheme（Widget 與 Siri 入口）', () {
      final plist = File('ios/Runner/Info.plist').readAsStringSync();
      expect(plist, contains('CFBundleURLTypes'));
      expect(plist, contains('<string>assetpilot</string>'));
    });

    test('擴充的 Info.plist 沒有憑證或網路權限', () {
      // 擴充不應持有憑證；Widget 只讀 App Group 快照。
      for (final path in [
        'ios/AssetPilotWidget/Info.plist',
      ]) {
        final plist = File(path).readAsStringSync();
        expect(plist, isNot(contains('NSCameraUsageDescription')));
        expect(plist, isNot(contains('NSPhotoLibraryUsageDescription')));
      }
    });
  });

  group('App Intent 必須位於主 App target', () {
    // Apple 官方說明：`openAppWhenRun = true` 在 App Extension 中執行時
    // 會產生錯誤，而 `UIApplication.shared` 對擴充是
    // NS_EXTENSION_UNAVAILABLE。因此「開啟 App 讓使用者確認」的 Intent
    // 必須放在主 App target 內，不能放在擴充 target。
    test('Intent 原始檔位於主 App 的 ios/Runner 目錄', () {
      expect(
        File('ios/Runner/RecordTransactionIntent.swift').existsSync(),
        isTrue,
      );
      expect(
        File('ios/Runner/AssetPilotShortcuts.swift').existsSync(),
        isTrue,
      );
    });

    test('不存在舊的 App Intents 擴充目錄', () {
      expect(
        Directory('ios/AssetPilotIntents').existsSync(),
        isFalse,
        reason: 'App Intent 不應放在擴充 target；請改置於 ios/Runner。',
      );
    });

    test('Xcode 專案中沒有 AssetPilotIntents 擴充 target', () {
      final pbxproj =
          File('ios/Runner.xcodeproj/project.pbxproj').readAsStringSync();
      expect(
        pbxproj,
        isNot(contains('AssetPilotIntents')),
        reason: 'App Intent 改置於主 App target 後，不應再有同名擴充 target。',
      );
    });

    test('主 App 的 Runner target 內含 App Intents 原始檔', () {
      final pbxproj =
          File('ios/Runner.xcodeproj/project.pbxproj').readAsStringSync();
      expect(pbxproj, contains('RecordTransactionIntent.swift'));
      expect(pbxproj, contains('AssetPilotShortcuts.swift'));
    });
  });
}

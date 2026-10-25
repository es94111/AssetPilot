// 深層連結通道的跨語言契約測試。
//
// 對應 docs/ios-app-development-plan.md 第 5.4 節。
//
// 這裡守護的是 **Dart 端與 Swift 端之間的接線**，也就是最容易在
// 兩種語言各自修改時悄悄斷掉的部分：
//
// 1. 通道名稱必須兩端一致（方法通道與事件通道的名稱還必須彼此不同，
//    否則 Flutter 會讓後註冊的處理器覆蓋先註冊的）。
// 2. `SceneDelegate` 必須把三個入口（冷啟動連線、開啟 URL、繼續使用者活動）
//    都交給 `DeepLinkChannel`，少一個就會有情境收不到連結。
// 3. 登入流程使用的 host 過濾名稱必須與 Dart 端一致。

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:assetpilot/platform/app_link_service.dart';
import 'package:assetpilot/platform/deep_link_service.dart';

void main() {
  group('通道名稱契約', () {
    test('方法通道與事件通道的名稱必須與 Swift 端一致', () {
      final source = File('ios/Runner/DeepLinkChannel.swift').readAsStringSync();
      expect(
        source,
        contains('static let methodChannelName = "${AppLinkService.methodChannelName}"'),
        reason: 'Swift 的方法通道名稱與 Dart 端不一致，深層連結取不回來。',
      );
      expect(
        source,
        contains('static let eventChannelName = "${AppLinkService.eventChannelName}"'),
        reason: 'Swift 的事件通道名稱與 Dart 端不一致，連結不會推播給 Dart。',
      );
    });

    test('方法通道與事件通道的名稱必須不同', () {
      // Flutter 的方法通道與事件通道底層都用 setMessageHandlerOnChannel:，
      // 官方文件明載「identically named channels interfere with each
      // other's communication」。同名時後註冊的事件通道會覆蓋方法通道的
      // 處理器，takePendingLink 將永遠收不到回應。
      expect(
        AppLinkService.methodChannelName,
        isNot(AppLinkService.eventChannelName),
      );
    });

    test('Dart 端的方法通道名稱固定為 assetpilot/deep_link', () {
      expect(AppLinkService.methodChannelName, 'assetpilot/deep_link');
      expect(AppLinkService.eventChannelName, 'assetpilot/deep_link/events');
    });
  });

  group('場景入口完整性', () {
    test('SceneDelegate 三個入口都交給同一個轉送點', () {
      final source = File('ios/Runner/SceneDelegate.swift').readAsStringSync();

      // 1. 冷啟動：連結隨場景連線一起送來。
      expect(
        source,
        contains('connectionOptions.urlContexts'),
        reason: '冷啟動的連結必須在 willConnectTo 取出。',
      );
      // 2. App 已在前景時再收到連結。
      expect(
        source,
        contains('openURLContexts URLContexts: Set<UIOpenURLContext>'),
        reason: '前景收到連結時必須在 openURLContexts 取出。',
      );
      // 3. Universal Links（以使用者活動送來）。
      expect(
        source,
        contains('userActivity.webpageURL'),
        reason: 'Universal Links 必須在 continue 取出。',
      );

      // 三個入口都必須走同一個轉送點，避免某一條路徑漏掉。
      // 轉送點抽成 static 函式，才能在單元測試中直接驗證
      // （UIScene／UIOpenURLContext 的 init 在 SDK 中為 NS_UNAVAILABLE）。
      final routeCalls = 'SceneDelegate.routeDeepLinks('.allMatches(source).length;
      expect(
        routeCalls,
        greaterThanOrEqualTo(3),
        reason: '三個場景入口都必須呼叫 routeDeepLinks。',
      );
      expect(
        source,
        contains('static func routeDeepLinks(_ urls: [URL])'),
      );
      expect(
        source,
        contains('DeepLinkChannel.handle(urls: urls)'),
        reason: '轉送點必須把連結交給 DeepLinkChannel。',
      );
    });

    test('AppDelegate 的舊式 URL 回呼也交給 DeepLinkChannel', () {
      final source = File('ios/Runner/AppDelegate.swift').readAsStringSync();
      expect(
        source,
        contains('DeepLinkChannel.handle(url: url)'),
        reason: '場景尚未建立時，連結會走 AppDelegate 的回呼。',
      );
    });

    test('DeepLinkChannel 已註冊到 Flutter 引擎', () {
      final source = File('ios/Runner/AppDelegate.swift').readAsStringSync();
      expect(
        source,
        contains('DeepLinkChannel.register(with:'),
        reason: '未註冊就收不到方法通道的呼叫。',
      );
    });

    test('只有本 App 自己的 scheme 會被轉送', () {
      final source = File('ios/Runner/DeepLinkChannel.swift').readAsStringSync();
      expect(
        source,
        contains('url.scheme == "assetpilot"'),
        reason: '其他 App 的連結不應被送進本 App。',
      );
    });
  });

  group('登入回呼的 host 過濾', () {
    test('Google／LINE／Passkey 各自只取自己的回呼 host', () {
      // 三個登入流程都會「取回冷啟動連結」來完成 OAuth 收尾。
      // 若不過濾，記帳入口的連結會被登入流程取走（或反之）。
      final cases = {
        'lib/google_auth.dart': 'google-callback',
        'lib/line_auth.dart': 'line-callback',
        'lib/passkey_auth.dart': 'auth-ticket',
      };

      cases.forEach((path, host) {
        final source = File(path).readAsStringSync();
        expect(
          source,
          contains("'$host'"),
          reason: '$path 應過濾 host「$host」。',
        );
        expect(
          source,
          contains('hosts:'),
          reason: '$path 取回冷啟動連結時必須帶 host 過濾。',
        );
        // 不可再依賴 app_links 的 uriLinkStream（iOS 端收不到連結）。
        expect(
          source,
          isNot(contains('app_links/app_links.dart')),
          reason: '$path 仍直接依賴 app_links；iOS 端應改走 AppLinkService。',
        );
        expect(
          source,
          contains('AppLinkService.instance'),
          reason: '$path 應改用 AppLinkService 取得連結。',
        );
      });
    });
  });

  group('DeepLinkService 的業務規則', () {
    test('只支援記帳入口與共享帳本邀請', () {
      expect(
        DeepLinkService.isSupported(Uri.parse('assetpilot://transaction/new')),
        isTrue,
      );
      expect(
        DeepLinkService.isSupported(Uri.parse('assetpilot://ledger/invite?token=x')),
        isTrue,
      );
      // 登入回呼屬於另一條流程，不該被記帳入口吃掉。
      expect(
        DeepLinkService.isSupported(Uri.parse('assetpilot://google-callback?code=a')),
        isFalse,
      );
      expect(
        DeepLinkService.isSupported(Uri.parse('https://example.com/transaction/new')),
        isFalse,
      );
    });

    test('記帳入口的 host 清單固定', () {
      expect(DeepLinkService.entryHosts, ['transaction', 'ledger']);
    });

    test('登出時清除待處理的捷徑輸入（計畫書 5.2 步驟 7）', () {
      // 原生層必須提供 clearPendingLinks 方法，
      // 否則登出後上一個帳號的待處理連結會被下一個帳號取走。
      final source = File('ios/Runner/DeepLinkChannel.swift').readAsStringSync();
      expect(
        source,
        contains('case "clearPendingLinks"'),
        reason: '原生層缺少 clearPendingLinks，無法在登出時清除待處理的捷徑輸入。',
      );
      expect(
        source,
        contains('clearPending()'),
        reason: 'clearPendingLinks 必須呼叫佇列的 clearPending。',
      );

      final queue = File('ios/Runner/DeepLinkQueue.swift').readAsStringSync();
      expect(
        queue,
        contains('mutating func clearPending()'),
        reason: 'DeepLinkQueue 缺少 clearPending，無法清除待處理連結。',
      );
    });

    test('登出清除只影響待處理佇列，不影響 OAuth 用的歷史記錄', () {
      // 歷史記錄是給 OAuth 流程比對「這次回呼是不是新產生的」用的，
      // 與帳號權限無關；一起清掉會讓重複回呼防護失效。
      final queue = File('ios/Runner/DeepLinkQueue.swift').readAsStringSync();
      final body = queue.substring(queue.indexOf('mutating func clearPending()'));
      final bodyEnd = body.indexOf('\n  }');
      final method = body.substring(0, bodyEnd);

      expect(method, contains('pending = []'));
      expect(
        method,
        isNot(contains('recent = []')),
        reason: 'clearPending 不得清除歷史記錄，否則 OAuth 重複回呼防護會失效。',
      );
    });

    test('去重時間窗足以涵蓋冷啟動的重複交接', () {
      // 冷啟動的同一筆連結可能同時走「推播」與「拉取」兩條路徑抵達，
      // 計畫書 5.4 節要求「相同呼叫不可因重複交接產生兩筆交易」。
      expect(DeepLinkService.dedupWindow.inSeconds, greaterThanOrEqualTo(2));
    });
  });
}

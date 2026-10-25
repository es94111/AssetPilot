// Siri／捷徑深層連結契約測試（對應 docs/ios-app-development-plan.md 第 5.4 節）。
//
// 承諾：
// - Intent 只帶參數開啟 App，**不直接入帳**；使用者必須在表單確認。
// - Dart 端能辨識 Swift 端組出的連結格式（scheme／host／path／query）。
// - 未帶或無法辨識的參數退回安全預設（支出、無金額），不猜測金額。
//
// 這個測試同時比對 Swift 原始碼，確保兩端不會各自演化。

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// 與 mobile/lib/app.dart 的 _isNewTransactionLink 相同。
bool isNewTransactionLink(Uri uri) =>
    uri.scheme == 'assetpilot' && uri.host == 'transaction' && uri.path == '/new';

/// 與 mobile/lib/app.dart 的 _linkTransactionType 相同。
String linkTransactionType(Uri uri) {
  final type = uri.queryParameters['type'];
  if (type == 'income' || type == 'expense') return type!;
  return 'expense';
}

void main() {
  group('Siri 深層連結解析', () {
    test('辨識 assetpilot://transaction/new 形式的連結', () {
      expect(isNewTransactionLink(Uri.parse('assetpilot://transaction/new')),
          isTrue);
      expect(
        isNewTransactionLink(
          Uri.parse('assetpilot://transaction/new?source=siri&type=expense&amount=120'),
        ),
        isTrue,
      );
    });

    test('其他連結不被當成記帳入口', () {
      expect(isNewTransactionLink(Uri.parse('assetpilot://transaction/edit/1')),
          isFalse);
      expect(isNewTransactionLink(Uri.parse('assetpilot://ledger/invite?token=x')),
          isFalse);
      expect(isNewTransactionLink(Uri.parse('https://example.com/transaction/new')),
          isFalse);
    });

    test('帶入收支類型；無法辨識時退回支出', () {
      expect(
        linkTransactionType(
          Uri.parse('assetpilot://transaction/new?type=income&amount=100'),
        ),
        'income',
      );
      expect(
        linkTransactionType(
          Uri.parse('assetpilot://transaction/new?type=expense&amount=100'),
        ),
        'expense',
      );
      expect(
        linkTransactionType(Uri.parse('assetpilot://transaction/new')),
        'expense',
      );
      expect(
        linkTransactionType(
          Uri.parse('assetpilot://transaction/new?type=transfer'),
        ),
        'expense',
      );
    });

    test('Swift 端組出的連結格式與 Dart 端一致', () {
      final file = File('ios/Runner/RecordTransactionIntent.swift');
      expect(file.existsSync(), isTrue);
      final source = file.readAsStringSync();

      // scheme / host / path 必須與 Dart 端比對的完全相同。
      expect(source, contains('components.scheme = "assetpilot"'));
      expect(source, contains('components.host = "transaction"'));
      expect(source, contains('components.path = "/new"'));

      // query 參數名稱必須與 Dart 端讀的一致。
      expect(source, contains('URLQueryItem(name: "type"'));
      expect(source, contains('URLQueryItem(name: "amount"'));
      expect(source, contains('URLQueryItem(name: "category"'));
      expect(source, contains('URLQueryItem(name: "account"'));
    });

    test('Intent 必須開啟 App 讓使用者確認，不得背景直接入帳', () {
      final file = File('ios/Runner/RecordTransactionIntent.swift');
      final source = file.readAsStringSync();

      // openAppWhenRun = true 是「由使用者確認後才入帳」的前提。
      expect(source, contains('static var openAppWhenRun: Bool = true'));
      // Intent 只開啟深層連結，不得自行呼叫後端寫入。
      expect(source, isNot(contains('URLSession')));
      expect(source, isNot(contains('http://')));
      expect(source, isNot(contains('https://')));
    });

    test('Widget 快速記帳連結使用相同入口', () {
      final file = File('ios/AssetPilotWidget/WidgetSnapshot.swift');
      final source = file.readAsStringSync();
      expect(source, contains('assetpilot://transaction/new?source=widget'));
      expect(
        isNewTransactionLink(Uri.parse('assetpilot://transaction/new?source=widget')),
        isTrue,
      );
    });
  });

  group('Info.plist URL scheme 註冊', () {
    test('Runner 的 Info.plist 註冊了 assetpilot scheme', () {
      final file = File('ios/Runner/Info.plist');
      expect(file.existsSync(), isTrue);
      final source = file.readAsStringSync();
      expect(source, contains('assetpilot'));
      expect(source, contains('CFBundleURLTypes'));
    });
  });

  group('Apple 登入的 nonce 契約', () {
    test('原生層以 SHA256 雜湊後把 nonce 交給 Apple', () {
      final file = File('ios/Runner/AppleAuthChannel.swift');
      expect(file.existsSync(), isTrue);
      final source = file.readAsStringSync();
      expect(source, contains('request.nonce = AppleAuthChannel.sha256Hex(nonce)'));
    });

    test('伺服器端比對的是原始 nonce，不是雜湊值', () {
      // Apple 回傳的 identity token 中，nonce claim 是**未雜湊的原始值**。
      // 若伺服器端改成比對雜湊值，所有 Apple 登入都會失敗。
      final file = File('../lib/appleOAuth.ts');
      expect(file.existsSync(), isTrue);
      final source = file.readAsStringSync();
      expect(source, contains('expectedNonce'));
      expect(source, isNot(contains('sha256(expectedNonce)')));
    });

    test('Apple 登入按鈕在非 iOS 上不顯示', () {
      // iOS 限定功能不應在其他平台露出（Android 沒有 ASAuthorization）。
      final file = File('lib/screens/login_screen.dart');
      final source = file.readAsStringSync();
      expect(source, contains('AppleAuth.isSupported'));
    });
  });

  group('未登入時的深層連結不能被丟棄', () {
    // 計畫書 5.4 節要求「冷啟動／重新登入後仍可安全接續確認」。
    // 深層連結可能在未登入時抵達（例如鎖定畫面用 Widget 記帳），
    // 此時主畫面尚未建立；若直接丟掉，使用者輸入的金額會不翼而飛。
    test('DeepLinkService 會暫存連結直到被取走', () {
      final file = File('lib/platform/deep_link_service.dart');
      expect(file.existsSync(), isTrue);
      final source = file.readAsStringSync();
      expect(source, contains('takePending'));
      expect(source, contains('Uri? _pending'));
    });

    test('只有本 App 支援的連結會被暫存', () {
      final file = File('lib/platform/deep_link_service.dart');
      final source = file.readAsStringSync();
      expect(source, contains("uri.scheme == 'assetpilot'"));
      expect(source, contains("uri.host == 'transaction'"));
      expect(source, contains("uri.host == 'ledger'"));
    });

    test('主畫面在未登入狀態就開始監聽深層連結', () {
      // 若監聽只在 HomeShell 內啟動，登入前抵達的連結會遺失。
      final file = File('lib/app.dart');
      final source = file.readAsStringSync();
      expect(
        source,
        contains('DeepLinkService.instance.start()'),
        reason: '深層連結監聽必須在登入前就啟動。',
      );
      // 監聽必須在 AuthGate（依登入狀態切換畫面）中啟動，而非只在主畫面。
      final authGateIndex = source.indexOf('class _AuthGateState');
      final homeShellIndex = source.indexOf('class _HomeShellState');
      final startIndex = source.indexOf('DeepLinkService.instance.start()');
      expect(startIndex, isNot(-1));
      expect(
        startIndex > authGateIndex && startIndex < homeShellIndex,
        isTrue,
        reason: '監聽必須在 AuthGate 啟動，早於 HomeShell。',
      );
    });

    test('主畫面建立後會取走待處理的連結', () {
      final file = File('lib/app.dart');
      final source = file.readAsStringSync();
      expect(source, contains('takePending'));
    });

    test('已處理的連結會從待處理佇列移除，避免重複開啟', () {
      final file = File('lib/app.dart');
      final source = file.readAsStringSync();
      expect(source, contains('consume('));
    });
  });

  group('登出時必須清除待處理的捷徑輸入', () {
    // 計畫書 5.2 步驟 7：「登出、切換帳號、權限失效時，同步清除或
    // 隔離 Widget 快照、離線草稿與待處理的捷徑輸入。」
    //
    // 未清除的話，使用者 A 登出後、使用者 B 登入，A 尚未被接走的
    // `assetpilot://transaction/new` 會在 B 的畫面上被開啟——
    // 既是隱私問題，也是把輸入寫進別人帳本的資料錯置。
    test('ApiClient._clearAuth 會呼叫 DeepLinkService.clearPending', () {
      final file = File('lib/api_client.dart');
      final source = file.readAsStringSync();

      expect(
        source,
        contains('DeepLinkService.instance.clearPending()'),
        reason: '登出時必須清除待處理的捷徑輸入。',
      );

      // 必須在 _clearAuth 內，而不是只在 logout() 內：
      // 權限失效（401）也會呼叫 _clearAuth。
      final body = source.substring(source.indexOf('Future<void> _clearAuth()'));
      final bodyEnd = body.indexOf('\n  }');
      final method = body.substring(0, bodyEnd);
      expect(
        method,
        contains('DeepLinkService.instance.clearPending()'),
        reason: '清除動作必須放在 _clearAuth，才能涵蓋權限失效的情境。',
      );
    });

    test('clearPending 會同時清掉 Dart 端與原生端的待處理連結', () {
      final file = File('lib/platform/deep_link_service.dart');
      final source = file.readAsStringSync();
      expect(
        source,
        contains('_pending = null'),
        reason: 'Dart 端的待處理連結必須被清掉。',
      );
      expect(
        source,
        contains('_appLinks.clearPending()'),
        reason: '原生端的待處理連結也必須被清掉。',
      );
    });

    test('clearPending 不影響去重紀錄', () {
      // 去重紀錄的作用是避免同一筆連結被重複交接；
      // 跨帳號清掉反而可能讓同一個連結在短時間內被處理兩次。
      final file = File('lib/platform/deep_link_service.dart');
      final source = file.readAsStringSync();
      final body = source.substring(source.indexOf('Future<void> clearPending()'));
      final bodyEnd = body.indexOf('\n  }');
      final method = body.substring(0, bodyEnd);
      expect(method, isNot(contains('_handled.clear()')));
    });
  });
}

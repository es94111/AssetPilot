// AssetPilot 安卓客戶端的基本 widget 測試。

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:sentry_flutter/sentry_flutter.dart';

import 'package:assetpilot/api_client.dart';
import 'package:assetpilot/screens/login_screen.dart';
import 'package:assetpilot/l10n.dart';
import 'package:assetpilot/sentry_config.dart';
import 'package:assetpilot/format.dart';
import 'package:assetpilot/theme.dart';

void main() {
  test('Sentry 保留 HTTP 診斷但不重複建立已處理的失敗事件', () {
    final options = SentryFlutterOptions();

    configureSentry(options);

    expect(options.captureFailedRequests, isFalse);
    expect(options.recordHttpBreadcrumbs, isTrue);
    expect(options.tracesSampleRate, 0.2);
  });

  test('只有首次可安全重放的 GET 暫時性狀態碼會重試', () {
    for (final statusCode in [502, 503, 504, 521]) {
      expect(
        ApiClient.shouldRetryTransientGetStatus(
          'GET',
          '/api/config',
          statusCode,
          0,
        ),
        isTrue,
      );
    }

    expect(
      ApiClient.shouldRetryTransientGetStatus('GET', '/api/config', 500, 0),
      isFalse,
    );
    expect(
      ApiClient.shouldRetryTransientGetStatus('GET', '/api/config', 400, 0),
      isFalse,
    );
    expect(
      ApiClient.shouldRetryTransientGetStatus('POST', '/api/config', 503, 0),
      isFalse,
    );
    expect(
      ApiClient.shouldRetryTransientGetStatus('GET', '/api/config', 503, 1),
      isFalse,
    );
    expect(
      ApiClient.shouldRetryTransientGetStatus(
        'GET',
        '/api/auth/google/state',
        503,
        0,
      ),
      isFalse,
    );
  });

  test('GET 重試暫時性傳輸例外，但排除寫入與一次性 challenge', () {
    final clientException = http.ClientException('connection aborted');

    expect(
      ApiClient.shouldRetryTransientGetException(
        'GET',
        '/api/config',
        clientException,
        0,
      ),
      isTrue,
    );
    expect(
      ApiClient.shouldRetryTransientGetException(
        'GET',
        '/api/config',
        TimeoutException('timed out'),
        0,
      ),
      isTrue,
    );
    expect(
      ApiClient.shouldRetryTransientGetException(
        'POST',
        '/api/config',
        clientException,
        0,
      ),
      isFalse,
    );
    expect(
      ApiClient.shouldRetryTransientGetException(
        'GET',
        '/api/config',
        clientException,
        1,
      ),
      isFalse,
    );
    expect(
      ApiClient.shouldRetryTransientGetException(
        'GET',
        '/api/app/integrity/nonce',
        clientException,
        0,
      ),
      isFalse,
    );
    expect(
      ApiClient.shouldRetryTransientGetException(
        'GET',
        '/api/auth/line/state?flow=login',
        clientException,
        0,
      ),
      isFalse,
    );
  });

  test('英文語系可透過穩定 key 翻譯 APP 字串與動態訊息', () {
    appLocale.value = 'en';
    expect(trKey('authLoginButton'), 'Sign in');
    expect(
      trKey('mobileDynamicLanguageUpdated', {'value': 'English'}),
      'Language updated: English',
    );
    expect(
      translateLegacyServerMessage('目前版本 v1.2.3'),
      'Current version v1.2.3',
    );
    appLocale.value = 'zh-TW';
  });

  test('金融格式保留正負方向且主題提供語義顏色', () {
    appLocale.value = 'en';
    expect(signed(1234), '+1,234');
    expect(signed(-1234), '−1,234');
    expect(signed(0), '0');

    final light = assetPilotThemeFor(Brightness.light);
    final dark = assetPilotThemeFor(Brightness.dark);
    expect(light.income, isNot(dark.income));
    expect(light.profit, isNot(light.loss));
    appLocale.value = 'zh-TW';
  });
  testWidgets('未登入時顯示登入頁', (WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(home: LoginScreen(onLoggedIn: () {})));

    // 標題與登入按鈕應存在。
    expect(find.text('AssetPilot'), findsOneWidget);
    expect(find.text('登入'), findsWidgets);
    expect(find.text('電子郵件'), findsOneWidget);
    expect(find.text('密碼'), findsOneWidget);
  });
}

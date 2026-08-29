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

    // Warm Console 規範（網站配色風格.md）：語意色固定、
    // 圓角階梯 10/12/16/20、圖表色盤暖赭為首。
    expect(light.income, const Color(0xFF1E6B52)); // 松綠
    expect(light.expense, const Color(0xFFB3372F)); // 磚紅
    expect(light.net, const Color(0xFF8A5A1F)); // 赭金
    expect(dark.income, const Color(0xFF6CC29B));
    expect(dark.expense, const Color(0xFFE08279));
    expect(dark.net, const Color(0xFFD3A35C));
    expect(light.chartPalette.first, const Color(0xFFB0521C));
    expect(light.chartPalette.length, dark.chartPalette.length);
    expect(ApRadius.sm, 10);
    expect(ApRadius.md, 12);
    expect(ApRadius.lg, 16);
    expect(ApRadius.xl, 20);
    appLocale.value = 'zh-TW';
  });
  testWidgets('未登入時顯示登入頁', (WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(home: LoginScreen(onLoggedIn: () {})));
    await tester.pump();

    // 標題與 Passkey 登入按鈕應存在（現行登入頁以 passkey 為主，
    // 不再有內建帳號密碼表單）。
    expect(find.text('AssetPilot'), findsOneWidget);
    expect(find.text('使用 Passkey 登入'), findsOneWidget);
  });
}

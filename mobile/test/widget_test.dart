// AssetPilot 安卓客戶端的基本 widget 測試。

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:assetpilot/screens/login_screen.dart';
import 'package:assetpilot/l10n.dart';

void main() {
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

  testWidgets('未登入時顯示登入頁', (WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(home: LoginScreen(onLoggedIn: () {})));

    // 標題與登入按鈕應存在。
    expect(find.text('AssetPilot'), findsOneWidget);
    expect(find.text('登入'), findsWidgets);
    expect(find.text('電子郵件'), findsOneWidget);
    expect(find.text('密碼'), findsOneWidget);
  });
}

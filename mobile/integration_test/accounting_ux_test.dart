import 'dart:convert';

import 'package:assetpilot/api_client.dart';
import 'package:assetpilot/app.dart';
import 'package:assetpilot/l10n.dart';
import 'package:assetpilot/offline/connectivity_service.dart';
import 'package:assetpilot/screens/dashboard_screen.dart';
import 'package:assetpilot/screens/transaction_form_screen.dart';
import 'package:assetpilot/screens/transactions_screen.dart';
import 'package:assetpilot/theme.dart';
import 'package:assetpilot/widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('phone navigation, quick accounting and month-specific reports', (
    tester,
  ) async {
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    addTearDown(() => ApiClient.testClientFactory = null);
    final writes = <Map<String, dynamic>>[];
    Uri? report;
    ApiClient.testClientFactory = () => MockClient((request) async {
      Object result = {};
      final path = request.url.path;
      if (request.method == 'POST' && path == '/api/transactions') {
        writes.add(jsonDecode(request.body) as Map<String, dynamic>);
        result = {'id': 'test-transaction'};
      } else if (path == '/api/accounts') {
        result = [
          {'id': 'cash', 'name': '現金', 'currency': 'TWD', 'category': 'cash'},
        ];
      } else if (path == '/api/categories') {
        result = [
          {'id': 'food', 'name': '餐飲', 'type': 'expense', 'isParent': true},
          {'id': 'lunch', 'name': '午餐', 'type': 'expense', 'parentId': 'food'},
        ];
      } else if (path == '/api/transactions') {
        result = {'data': []};
      } else if (path == '/api/reports') {
        report = request.url;
        result = {'total': 120, 'categoryBreakdown': []};
      } else if (path == '/api/auth/me') {
        result = {
          'user': {'id': 'test-user'},
        };
      } else if (path == '/api/dashboard') {
        result = {
          'yearMonth': request.url.queryParameters['yearMonth'],
          'recent': [],
        };
      } else if (path == '/api/recurring' ||
          path == '/api/budgets' ||
          path == '/api/ledgers') {
        result = [];
      }
      return http.Response(
        jsonEncode(result),
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const [Locale('zh', 'TW')],
          locale: const Locale('zh', 'TW'),
          theme: buildAssetPilotTheme(Brightness.light),
          darkTheme: buildAssetPilotTheme(Brightness.dark),
          home: HomeShell(onLoggedOut: () {}),
        ),
      );
      await tester.pumpAndSettle();
      ConnectivityService.instance.isOnline.value = true;

      final navigation = tester.widget<NavigationBar>(
        find.byType(NavigationBar),
      );
      expect(
        navigation.destinations.cast<NavigationDestination>().map(
          (d) => d.label,
        ),
        [
          trKey('mobileLegacyHome'),
          trKey('uxBookkeeping'),
          trKey('featuresCommonStock'),
          trKey('mobileLegacyMore'),
        ],
      );
      final dashboard = find.byType(DashboardScreen);
      final quickAdd = find.descendant(
        of: dashboard,
        matching: find.byType(RecordButton),
      );
      expect(quickAdd, findsOneWidget);
      expect(
        tester.getSemantics(quickAdd).label,
        contains(trKey('mobileLegacyAddTransaction')),
      );
      await tester.tap(quickAdd);
      await tester.pumpAndSettle();

      final form = find.byType(TransactionFormScreen);
      expect(form, findsOneWidget);
      final fields = find.descendant(of: form, matching: find.byType(Text));
      expect(
        find.text(trKey('uxAdvancedOptions')),
        findsOneWidget,
        reason: tester
            .widgetList<Text>(fields)
            .map((text) => text.data)
            .join(' | '),
      );
      expect(find.text(trKey('mobileLegacyNoteOptional')), findsNothing);
      final amount = find.widgetWithText(
        TextFormField,
        trKey('dashboardTableAmount'),
      );
      await tester.enterText(amount, '120');
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.tap(find.byType(DropdownButtonFormField<String>).first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('餐飲 › 午餐').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text(trKey('commonSave')));
      await tester.pumpAndSettle();
      expect(form, findsNothing);
      expect(writes.single, containsPair('amount', 120));
      expect(writes.single, containsPair('type', 'expense'));

      await tester.tap(find.byTooltip(trKey('dashboardFiltersPreviousMonth')));
      await tester.pumpAndSettle();
      final reports = find.text(trKey('uxViewReports'));
      await tester.ensureVisible(reports);
      await tester.tap(reports);
      await tester.pumpAndSettle();
      final now = DateTime.now();
      final previous = DateTime(now.year, now.month - 1, 1);
      final expectedMonth =
          '${previous.year}-${previous.month.toString().padLeft(2, '0')}';
      expect(report?.queryParameters['from'], '$expectedMonth-01');
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      tester.platformDispatcher.textScaleFactorTestValue = 1.5;
      await tester.tap(find.text(trKey('uxBookkeeping')));
      await tester.pumpAndSettle();
      expect(
        Theme.of(tester.element(find.byType(TransactionsScreen))).brightness,
        Brightness.dark,
      );
      expect(find.text(trKey('uxDrafts')), findsOneWidget);
      await tester.tap(find.text(trKey('mobileLegacyFilter')));
      await tester.pumpAndSettle();
      expect(find.text(trKey('mobileLegacyApply')), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();

      await tester.tap(find.text(trKey('mobileLegacyMore')));
      await tester.pumpAndSettle();
      expect(find.text(trKey('uxLedgerTools')), findsOneWidget);
      expect(find.text(trKey('navAccounts')), findsNothing);
      await tester.tap(find.text(trKey('uxLedgerTools')));
      await tester.pumpAndSettle();
      expect(find.text(trKey('navAccounts')), findsOneWidget);
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
  });
}

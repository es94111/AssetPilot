import 'package:assetpilot/app.dart';
import 'package:assetpilot/l10n.dart';
import 'package:assetpilot/screens/transaction_form_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  testWidgets('iOS 點擊記帳表單留白時收起鍵盤', (tester) async {
    await http.runWithClient(
      () async {
        await tester.pumpWidget(const AssetPilotApp());
        tester
            .state<NavigatorState>(find.byType(Navigator))
            .push<void>(
              MaterialPageRoute(builder: (_) => const TransactionFormScreen()),
            );
        await tester.pumpAndSettle();

        final amount = find.widgetWithText(
          TextFormField,
          trKey('dashboardTableAmount'),
        );
        await tester.tap(amount);
        await tester.pump();
        expect(tester.testTextInput.isVisible, isTrue);
        await tester.enterText(amount, '123');
        await tester.pump();

        final form = tester.getRect(find.byType(ListView));
        final blank = Offset(form.left + 8, tester.getCenter(amount).dy);
        await tester.timedDragFrom(
          blank,
          const Offset(0, -64),
          const Duration(milliseconds: 320),
        );
        await tester.pumpAndSettle();
        expect(tester.getCenter(amount).dy, lessThan(blank.dy));
        expect(tester.testTextInput.isVisible, isTrue);

        await tester.tapAt(blank);
        await tester.pump();
        expect(tester.testTextInput.isVisible, isFalse);

        await tester.ensureVisible(amount);
        await tester.pumpAndSettle();
        expect(find.text('123'), findsOneWidget);
        await tester.tap(amount);
        await tester.pump();
        expect(tester.testTextInput.isVisible, isTrue);
      },
      () => MockClient((request) async {
        expect(request.method, 'GET');
        expect(request.url.path, anyOf('/api/accounts', '/api/categories'));
        return http.Response('[]', 200);
      }),
    );
  }, variant: const TargetPlatformVariant({TargetPlatform.iOS}));
}

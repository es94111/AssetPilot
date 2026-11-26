import 'package:assetpilot/l10n.dart';
import 'package:assetpilot/platform/notification_capture.dart';
import 'package:assetpilot/screens/notification_capture_screens.dart';
import 'package:assetpilot/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  const channel = MethodChannel('assetpilot/notification_capture');

  testWidgets('can stop capture when configuration is unavailable', (
    tester,
  ) async {
    final messenger = tester.binding.defaultBinaryMessenger;
    NotificationCapturePlatform.supported.value = true;
    addTearDown(() {
      NotificationCapturePlatform.supported.value = false;
      NotificationCapturePlatform.snapshot.value =
          const NotificationCaptureSnapshot();
      messenger.setMockMethodCallHandler(channel, null);
    });
    var active = true;
    messenger.setMockMethodCallHandler(channel, (method) async {
      switch (method.method) {
        case 'snapshot':
          return {
            'ownerId': 'fixture-owner',
            if (active) 'revision': 'consented',
          };
        case 'disable':
          expect(method.arguments, {'ownerId': 'fixture-owner'});
          active = false;
          return null;
        default:
          fail('Unexpected native call ${method.method}');
      }
    });
    await http.runWithClient(() async {
      await tester.pumpWidget(
        const MaterialApp(
          home: NotificationCaptureSettingsScreen(ownerId: 'fixture-owner'),
        ),
      );
      await tester.pumpAndSettle();
      final toggle = find.byType(SwitchListTile);
      expect(tester.widget<SwitchListTile>(toggle).value, isTrue);
      await tester.tap(toggle);
      await tester.pumpAndSettle();
      expect(tester.widget<SwitchListTile>(toggle).value, isFalse);
      expect(active, isFalse);
    }, () => MockClient((_) async => http.Response('{}', 500)));
  });

  for (final brightness in Brightness.values) {
    testWidgets(
      'reviews and discards local notification drafts in $brightness',
      (tester) async {
        tester.view.physicalSize = const Size(320, 720);
        tester.view.devicePixelRatio = 1;
        final messenger = tester.binding.defaultBinaryMessenger;
        NotificationCapturePlatform.supported.value = true;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
          NotificationCapturePlatform.supported.value = false;
          NotificationCapturePlatform.snapshot.value =
              const NotificationCaptureSnapshot();
          messenger.setMockMethodCallHandler(channel, null);
        });

        final drafts = <Map<String, Object?>>[
          {
            'id': 'a' * 32,
            'sourceName': 'LINE Pay',
            'merchant': 'Cedar Shop',
            'status': 'ready',
            'amount': '12.34',
            'currency': 'USD',
            'possibleDuplicate': true,
            'receivedAt': '2026-11-26T04:18:00Z',
          },
        ];
        NotificationCapturePlatform.snapshot.value =
            NotificationCaptureSnapshot.fromMap({
              'ownerId': 'fixture-owner',
              'drafts': drafts,
            });
        var discards = 0;
        messenger.setMockMethodCallHandler(channel, (method) async {
          switch (method.method) {
            case 'snapshot':
              return {'ownerId': 'fixture-owner', 'drafts': drafts};
            case 'discard':
              expect(method.arguments, {
                'ownerId': 'fixture-owner',
                'draftId': 'a' * 32,
              });
              discards++;
              drafts.clear();
              return null;
            default:
              fail('Unexpected native call ${method.method}');
          }
        });

        await tester.pumpWidget(
          MaterialApp(
            theme: buildAssetPilotTheme(brightness),
            home: NotificationDraftsScreen(
              onPosted: () => fail('Discarding a draft must not post'),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Cedar Shop'), findsOneWidget);
        expect(find.textContaining('USD 12.34'), findsOneWidget);
        expect(
          find.textContaining(trKey('notificationCaptureCompare')),
          findsOneWidget,
        );
        await tester.tap(find.byTooltip(trKey('notificationCaptureDiscard')));
        await tester.pumpAndSettle();
        expect(discards, 0);
        await tester.tap(find.text(trKey('commonDelete')));
        await tester.pumpAndSettle();
        expect(discards, 1);
        expect(
          find.text(trKey('notificationCaptureEmptyDrafts')),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );
  }
}

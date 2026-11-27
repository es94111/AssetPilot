import 'dart:async';

import 'package:assetpilot/l10n.dart';
import 'package:assetpilot/platform/notification_capture.dart';
import 'package:assetpilot/platform/notification_capture_shortcut.dart';
import 'package:assetpilot/screens/notification_capture_screens.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _launcher = MethodChannel('plugins.flutter.io/url_launcher');
const _nativeCapture = MethodChannel('assetpilot/notification_capture');
const _fixtureLink = 'https://www.icloud.com/shortcuts/TemplateTestFixture';
const _updatedLink = 'https://www.icloud.com/shortcuts/UpdatedTestFixture';
const _fixture = NotificationCaptureShortcutTemplate(
  appleShareUrl: _fixtureLink,
  version: 3,
  includesNotificationTrigger: true,
);
const _actionOnlyFixture = NotificationCaptureShortcutTemplate(
  appleShareUrl: _fixtureLink,
  version: 3,
  includesNotificationTrigger: false,
);
const _updatedFixture = NotificationCaptureShortcutTemplate(
  appleShareUrl: _updatedLink,
  version: 4,
  includesNotificationTrigger: true,
  verifiedLockedExecution: true,
);

Future<void> _showSettings(
  WidgetTester tester,
  NotificationCaptureShortcutTemplate? template,
) => http.runWithClient(() async {
  await tester.pumpWidget(
    MaterialApp(
      home: NotificationCaptureSettingsScreen(
        ownerId: 'fixture-owner',
        shortcutTemplate: template,
      ),
    ),
  );
  await tester.pumpAndSettle();
}, () => MockClient((_) async => http.Response('{"available":false}', 200)));

void main() {
  test('only versioned Apple iCloud shortcut share links are launchable', () {
    expect(_fixture.shareUri.toString(), _fixtureLink);
    expect(_actionOnlyFixture.shareUri, isNull);
    const urls = [
      'http://www.icloud.com/shortcuts/code',
      'https://www.icloud.com.example.test/shortcuts/code',
      'https://example@www.icloud.com/shortcuts/code',
      'https://www.icloud.com:8443/shortcuts/code',
      'https://www.icloud.com/shortcuts/code?source=any',
      'https://www.icloud.com/shortcuts/code#label',
      'https://www.icloud.com/shortcuts/',
      'https://www.icloud.com/shortcuts/a%2Fb',
    ];
    for (final url in urls) {
      expect(
        NotificationCaptureShortcutTemplate(
          appleShareUrl: url,
          version: 1,
          includesNotificationTrigger: true,
        ).shareUri,
        isNull,
        reason: url,
      );
    }
    expect(
      const NotificationCaptureShortcutTemplate(
        appleShareUrl: _fixtureLink,
        version: 0,
        includesNotificationTrigger: true,
      ).shareUri,
      isNull,
    );
  });

  testWidgets('an action-only template leaves only manual setup', (
    tester,
  ) async {
    await _showSettings(tester, _actionOnlyFixture);
    expect(find.text(trKey('notificationCaptureImportShortcut')), findsNothing);
    expect(find.text(trKey('notificationCaptureStepTrigger')), findsOneWidget);
    expect(find.text(trKey('notificationCaptureStepInput')), findsOneWidget);
  });

  testWidgets('keeps manual Shortcuts setup available without a release link', (
    tester,
  ) async {
    final messenger = tester.binding.defaultBinaryMessenger;
    var opened = false;
    messenger.setMockMethodCallHandler(_nativeCapture, (call) async {
      expect(call.method, 'openShortcuts');
      opened = true;
      return true;
    });
    addTearDown(() => messenger.setMockMethodCallHandler(_nativeCapture, null));

    await _showSettings(tester, null);
    expect(find.text(trKey('notificationCaptureImportShortcut')), findsNothing);
    expect(find.text(trKey('notificationCaptureStepInput')), findsOneWidget);
    expect(find.text(trKey('notificationCaptureTemplateLocked')), findsNothing);
    await tester.tap(find.text(trKey('notificationCaptureOpenShortcuts')));
    expect(opened, isTrue);
  });

  testWidgets(
    'handoff opens the official link once and leaves receipt status alone',
    (tester) async {
      final messenger = tester.binding.defaultBinaryMessenger;
      final externalHandoff = Completer<bool>();
      var launches = 0;
      messenger.setMockMethodCallHandler(_launcher, (call) async {
        expect(call.method, 'launch');
        expect(call.arguments['url'], _fixtureLink);
        expect(call.arguments['useSafariVC'], isFalse);
        expect(call.arguments['useWebView'], isFalse);
        launches++;
        return externalHandoff.future;
      });
      addTearDown(() => messenger.setMockMethodCallHandler(_launcher, null));

      await _showSettings(tester, _fixture);
      final action = find.widgetWithText(
        FilledButton,
        trKey('notificationCaptureImportShortcut'),
      );
      expect(
        find.text(trKey('notificationCaptureTemplateVersion', {'version': 3})),
        findsOneWidget,
      );
      expect(
        find.text(trKey('notificationCaptureTemplateChooseSource')),
        findsOneWidget,
      );
      expect(
        find.text(trKey('notificationCaptureTemplateReplace')),
        findsOneWidget,
      );
      expect(
        find.text(trKey('notificationCaptureTemplateLocked')),
        findsNothing,
      );
      expect(find.text(trKey('notificationCaptureStepInput')), findsNothing);
      await tester.tap(action);
      await tester.pump();
      expect(tester.widget<FilledButton>(action).onPressed, isNull);
      await tester.tap(action);
      expect(launches, 1);
      externalHandoff.complete(true);
      await tester.pumpAndSettle();

      expect(find.text(trKey('notificationCaptureNoRecent')), findsOneWidget);
      expect(NotificationCapturePlatform.snapshot.value.lastReceivedAt, isNull);
      await tester.tap(find.text(trKey('notificationCaptureManualSetup')));
      await tester.pumpAndSettle();
      expect(find.text(trKey('notificationCaptureStepInput')), findsOneWidget);
    },
  );

  testWidgets(
    'opens the updated link and reveals manual setup on handoff error',
    (tester) async {
      final messenger = tester.binding.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(_launcher, (call) async {
        expect(call.arguments['url'], _updatedLink);
        throw PlatformException(code: 'unavailable');
      });
      addTearDown(() => messenger.setMockMethodCallHandler(_launcher, null));

      await _showSettings(tester, _updatedFixture);
      expect(
        find.text(trKey('notificationCaptureTemplateVersion', {'version': 4})),
        findsOneWidget,
      );
      expect(
        find.text(trKey('notificationCaptureTemplateLocked')),
        findsOneWidget,
      );
      await tester.tap(find.text(trKey('notificationCaptureImportShortcut')));
      await tester.pumpAndSettle();
      expect(
        find.text(trKey('notificationCaptureTemplateUnavailable')),
        findsOneWidget,
      );
      expect(
        find.text(trKey('notificationCaptureStepTrigger')),
        findsOneWidget,
      );
      expect(find.text(trKey('notificationCaptureNoRecent')), findsOneWidget);
    },
  );

  testWidgets('keeps an in-progress handoff when the service status loads', (
    tester,
  ) async {
    final serviceStatus = Completer<http.Response>();
    final handoff = Completer<bool>();
    final messenger = tester.binding.defaultBinaryMessenger;
    var launches = 0;
    messenger.setMockMethodCallHandler(_launcher, (_) {
      launches++;
      return handoff.future;
    });
    addTearDown(() => messenger.setMockMethodCallHandler(_launcher, null));

    await http.runWithClient(() async {
      await tester.pumpWidget(
        const MaterialApp(
          home: NotificationCaptureSettingsScreen(
            ownerId: 'fixture-owner',
            shortcutTemplate: _fixture,
          ),
        ),
      );
      await tester.pump();
    }, () => MockClient((_) => serviceStatus.future));

    final action = find.widgetWithText(
      FilledButton,
      trKey('notificationCaptureImportShortcut'),
    );
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    await tester.tap(action);
    await tester.pump();
    expect(tester.widget<FilledButton>(action).onPressed, isNull);

    serviceStatus.complete(http.Response('{"available":false}', 200));
    await tester.pump();
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(tester.widget<FilledButton>(action).onPressed, isNull);
    await tester.tap(action);
    expect(launches, 1);

    handoff.complete(false);
    await tester.pumpAndSettle();
    expect(find.text(trKey('notificationCaptureStepInput')), findsOneWidget);
  });

  testWidgets('reveals manual setup when iOS reports no handler', (
    tester,
  ) async {
    final messenger = tester.binding.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(_launcher, (_) async => false);
    addTearDown(() => messenger.setMockMethodCallHandler(_launcher, null));

    await _showSettings(tester, _fixture);
    await tester.tap(find.text(trKey('notificationCaptureImportShortcut')));
    await tester.pumpAndSettle();

    expect(
      find.text(trKey('notificationCaptureTemplateUnavailable')),
      findsOneWidget,
    );
    expect(
      find.text(trKey('notificationCaptureOpenShortcuts')),
      findsOneWidget,
    );
    expect(find.text(trKey('notificationCaptureNoRecent')), findsOneWidget);
  });
}

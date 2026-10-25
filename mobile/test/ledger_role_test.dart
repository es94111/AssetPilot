// 帳本唯讀權限與離線草稿送出測試（對應 docs/ios-app-development-plan.md 第 4.1、5.4、5.5 節）。
//
// 驗證記帳 API 的帳本範圍、viewer 唯讀狀態與所有寫入入口；並驗證草稿在未登入、
// 帳本不符或唯讀時不會送出，避免捷徑、離線流程或帳本切換繞過權限檢查。

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:assetpilot/api_client.dart';
import 'package:assetpilot/offline/offline_draft_core.dart';
import 'package:assetpilot/offline/offline_draft_service.dart';
import 'package:assetpilot/offline/offline_draft_store.dart';

OfflineDraft _makeDraft(
  String clientRef, {
  String ledgerId = '',
  OfflineDraftStatus status = OfflineDraftStatus.pending,
}) => OfflineDraft(
  clientRef: clientRef,
  kind: OfflineDraftKind.transaction,
  ledgerId: ledgerId,
  payload: const {'amount': 100, 'currency': 'TWD'},
  status: status,
  createdAt: DateTime(2026, 10, 21, 9),
  updatedAt: DateTime(2026, 10, 21, 9),
);

class _FakeSendContext implements DraftSendContext {
  _FakeSendContext({
    this.loggedIn = true,
    this.activeLedgerId = '',
    this.readOnly = false,
    this.onRefresh,
  });

  bool loggedIn;
  @override
  String activeLedgerId;
  bool readOnly;
  void Function()? onRefresh;
  int refreshCalls = 0;

  @override
  bool get isLoggedIn => loggedIn;

  @override
  Future<bool> refreshLedgerReadOnly() async {
    refreshCalls++;
    onRefresh?.call();
    return readOnly;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    await ApiClient.instance.clearActiveLedger();
    OfflineDraftStore.overrideBackend = <String, String>{};
    OfflineDraftService.overrideSendContext = null;
  });

  tearDown(() async {
    await ApiClient.instance.clearActiveLedger();
    OfflineDraftStore.overrideBackend = null;
    OfflineDraftService.overrideSendContext = null;
  });

  group('isLedgerDataPath', () {
    test('帳本資料路徑包含查詢字串與子路徑', () {
      for (final path in [
        '/api/transactions',
        '/api/transactions/abc',
        '/api/transactions?month=2026-10',
        '/api/accounts/1/x',
        '/api/dashboard?month=2026-10',
      ]) {
        expect(ApiClient.isLedgerDataPath(path), isTrue, reason: path);
      }
    });

    test('非帳本資料或僅前綴相似的路徑不納入帳本範圍', () {
      for (final path in [
        '/api/ledgers',
        '/api/auth/google',
        '/api/account/settings',
        '/api/transactionsX',
      ]) {
        expect(ApiClient.isLedgerDataPath(path), isFalse, reason: path);
      }
    });
  });

  group('updateLedgerRoleState', () {
    test('目前帳本角色為 viewer 時標記唯讀', () async {
      await ApiClient.instance.setActiveLedgerId('L1');
      ApiClient.instance.updateLedgerRoleState([
        {'id': 'L1', 'role': 'viewer'},
      ]);
      expect(ApiClient.instance.activeLedgerReadOnly, isTrue);
    });

    test('owner 與 editor 可寫入', () async {
      await ApiClient.instance.setActiveLedgerId('L1');
      for (final role in ['owner', 'editor']) {
        ApiClient.instance.updateLedgerRoleState([
          {'id': 'L1', 'role': role},
        ]);
        expect(ApiClient.instance.activeLedgerReadOnly, isFalse);
      }
    });

    test('目前帳本未出現在清單、角色屬於其他帳本或清單資料異常時維持可寫', () async {
      await ApiClient.instance.setActiveLedgerId('L1');
      ApiClient.instance.updateLedgerRoleState([
        {'id': 'L2', 'role': 'viewer'},
      ]);
      expect(ApiClient.instance.activeLedgerReadOnly, isFalse);

      ApiClient.instance.updateLedgerRoleState(const []);
      expect(ApiClient.instance.activeLedgerReadOnly, isFalse);

      ApiClient.instance.updateLedgerRoleState(['junk', 3, null]);
      expect(ApiClient.instance.activeLedgerReadOnly, isFalse);
    });

    test('個人帳本不會因共享帳本 viewer 角色而變成唯讀', () {
      ApiClient.instance.updateLedgerRoleState([
        {'id': 'L1', 'role': 'viewer'},
      ]);
      expect(ApiClient.instance.activeLedgerReadOnly, isFalse);
    });
  });

  group('帳本切換與角色重新整理', () {
    test('設定與清除目前帳本時同步更新 ID 和唯讀狀態', () async {
      await ApiClient.instance.setActiveLedgerId('L1', readOnly: true);
      expect(ApiClient.instance.activeLedgerId, 'L1');
      expect(ApiClient.instance.activeLedgerReadOnly, isTrue);

      await ApiClient.instance.clearActiveLedger();
      expect(ApiClient.instance.activeLedgerId, isEmpty);
      expect(ApiClient.instance.activeLedgerReadOnly, isFalse);
    });

    test('切換帳本時使用新帳本的角色狀態', () async {
      await ApiClient.instance.setActiveLedgerId('L1', readOnly: true);
      await ApiClient.instance.setActiveLedgerId('L2');
      expect(ApiClient.instance.activeLedgerId, 'L2');
      expect(ApiClient.instance.activeLedgerReadOnly, isFalse);
    });

    test('沒有選取共享帳本時角色重新整理不發出網路請求', () async {
      expect(await ApiClient.instance.refreshLedgerRole(), isFalse);
      expect(ApiClient.instance.activeLedgerReadOnly, isFalse);
    });
  });

  group('唯讀帳本的 API 寫入保護', () {
    setUp(() async {
      await ApiClient.instance.setActiveLedgerId('L1', readOnly: true);
    });

    test('建立、修改、刪除與還原交易都在發出請求前以 403 拒絕', () async {
      final operations = <Future<void> Function()>[
        () async => ApiClient.instance.createTransaction({'amount': 1}),
        () => ApiClient.instance.updateTransaction('tx-1', {'amount': 2}),
        () => ApiClient.instance.deleteTransaction('tx-1'),
        () async => ApiClient.instance.restoreAiCreatedTransaction('tx-1'),
      ];

      for (final operation in operations) {
        await expectLater(
          operation(),
          throwsA(
            isA<ApiException>()
                .having((error) => error.statusCode, 'statusCode', 403)
                .having((error) => error.message, 'message', isNotEmpty),
          ),
        );
      }
    });
  });

  group('OfflineDraftService 帳本綁定', () {
    test('尚未綁定使用者時 bindLedger 不會改變綁定', () async {
      final service = OfflineDraftService.instance;
      await service.bind(userId: '', ledgerId: 'first');
      await service.bindLedger('second');
      expect(service.ledgerId, 'first');
      expect(service.userId, isEmpty);
    });

    test('已綁定使用者時 bindLedger 只切換帳本', () async {
      final service = OfflineDraftService.instance;
      await service.bind(userId: 'bind-user', ledgerId: 'first');
      await service.bindLedger('second');
      expect(service.userId, 'bind-user');
      expect(service.ledgerId, 'second');
    });
  });

  group('離線草稿送出前權限檢查', () {
    const userId = 'submit-user';

    Future<OfflineDraft> seedDraft({String storedLedgerId = 'L1'}) async {
      final draft = _makeDraft('a' * 32, ledgerId: storedLedgerId);
      await OfflineDraftStore.save(userId, 'L1', [draft]);
      await OfflineDraftService.instance.bind(userId: userId, ledgerId: 'L1');
      return draft;
    }

    test('未登入時回報失敗但不改動草稿', () async {
      final draft = await seedDraft();
      OfflineDraftService.overrideSendContext = _FakeSendContext(
        loggedIn: false,
        activeLedgerId: 'L1',
      );

      final result = await OfflineDraftService.instance.submit(draft);
      final stored = (await OfflineDraftService.instance.list()).single;

      expect(result.outcome, DraftSubmitOutcome.failed);
      expect(result.message, isNotEmpty);
      expect(stored.status, OfflineDraftStatus.pending);
      expect(stored.attempts, 0);
      expect(stored.lastError, isNull);
    });

    test('草稿所屬帳本與目前帳本不同時拒絕且不改動草稿', () async {
      final draft = await seedDraft();
      OfflineDraftService.overrideSendContext = _FakeSendContext(
        activeLedgerId: 'L2',
      );

      final result = await OfflineDraftService.instance.submit(draft);
      final stored = (await OfflineDraftService.instance.list()).single;

      expect(result.outcome, DraftSubmitOutcome.failed);
      expect(result.message, isNotEmpty);
      expect(stored.status, OfflineDraftStatus.pending);
      expect(stored.attempts, 0);
      expect(stored.lastError, isNull);
    });

    test('唯讀帳本拒絕送出並將原因保存在草稿', () async {
      final draft = await seedDraft();
      OfflineDraftService.overrideSendContext = _FakeSendContext(
        activeLedgerId: 'L1',
        readOnly: true,
      );

      final result = await OfflineDraftService.instance.submit(draft);
      final stored = (await OfflineDraftService.instance.list()).single;

      expect(result.outcome, DraftSubmitOutcome.failed);
      expect(stored.status, OfflineDraftStatus.failed);
      expect(stored.attempts, 1);
      expect(stored.lastError, isNotEmpty);
    });

    test('角色查詢期間登出時不會將草稿留在 sending', () async {
      final draft = await seedDraft();
      final context = _FakeSendContext(
        activeLedgerId: 'L1',
        readOnly: true,
        onRefresh: () {},
      );
      context.onRefresh = () => context.loggedIn = false;
      OfflineDraftService.overrideSendContext = context;

      final result = await OfflineDraftService.instance.submit(draft);
      final stored = (await OfflineDraftService.instance.list()).single;

      expect(result.outcome, DraftSubmitOutcome.failed);
      expect(stored.status, OfflineDraftStatus.pending);
      expect(stored.attempts, 0);
      expect(stored.lastError, isNull);
    });
  });
}

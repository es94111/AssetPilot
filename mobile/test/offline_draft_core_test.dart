// 離線記帳草稿純邏輯測試（對應 docs/ios-app-development-plan.md 第 5.5 節）。
//
// 不需要 Flutter binding 與網路：只驗證資料形狀、狀態分流與冪等識別，
// 確保「草稿不入帳」「逾時不重複」「跨帳號隔離」等承諾有程式把關。

import 'dart:math';

import 'package:flutter_test/flutter_test.dart';

import 'package:assetpilot/offline/offline_draft_core.dart';

void main() {
  group('newClientRef', () {
    test('產生 32 碼十六進位，符合後端 CLIENT_REF_REGEX', () {
      final random = Random(42);
      final refs = <String>{};
      for (var i = 0; i < 50; i++) {
        final ref = newClientRef(random);
        expect(ref, matches(RegExp(r'^[a-f0-9]{32}$')));
        refs.add(ref);
      }
      expect(refs.length, greaterThan(1));
    });

    test('不同的亂數來源產生不同的識別', () {
      final a = newClientRef(Random(1));
      final b = newClientRef(Random(2));
      expect(a, isNot(b));
    });
  });

  group('buildSubmitBody', () {
    test('送出時帶上 clientRef，後端以此冪等去重', () {
      final draft = OfflineDraft(
        clientRef: 'a' * 32,
        kind: OfflineDraftKind.transaction,
        ledgerId: '',
        payload: const {'amount': 100, 'currency': 'TWD'},
        status: OfflineDraftStatus.pending,
        createdAt: DateTime(2026, 10, 21),
        updatedAt: DateTime(2026, 10, 21),
      );
      final body = buildSubmitBody(draft);
      expect(body['clientRef'], 'a' * 32);
      expect(body['amount'], 100);
      expect(body['currency'], 'TWD');
    });

    test('同一草稿重複送出時 clientRef 不變（不會重複入帳）', () {
      final draft = OfflineDraft(
        clientRef: 'b' * 32,
        kind: OfflineDraftKind.transaction,
        ledgerId: '',
        payload: const {'amount': 50},
        status: OfflineDraftStatus.pending,
        createdAt: DateTime(2026, 10, 21),
        updatedAt: DateTime(2026, 10, 21),
      );
      final first = buildSubmitBody(draft);
      final second = buildSubmitBody(
        draft.copyWith(status: OfflineDraftStatus.pending),
      );
      expect(first['clientRef'], second['clientRef']);
    });
  });

  group('isRetryableStatus', () {
    test('連線錯誤與逾時可重試', () {
      expect(isRetryableStatus(0), isTrue);
      expect(isRetryableStatus(408), isTrue);
      expect(isRetryableStatus(429), isTrue);
      expect(isRetryableStatus(500), isTrue);
      expect(isRetryableStatus(503), isTrue);
    });

    test('驗證／權限類 4xx 不可自動重試，須由使用者決定', () {
      expect(isRetryableStatus(400), isFalse);
      expect(isRetryableStatus(401), isFalse);
      expect(isRetryableStatus(403), isFalse);
      expect(isRetryableStatus(404), isFalse);
      expect(isRetryableStatus(422), isFalse);
    });
  });

  group('retryDelayMs', () {
    test('指數退避並設上限', () {
      expect(retryDelayMs(0), 0);
      expect(retryDelayMs(1), retryBaseDelayMs);
      expect(retryDelayMs(2), retryBaseDelayMs * 2);
      expect(retryDelayMs(3), retryBaseDelayMs * 4);
      expect(retryDelayMs(20), retryMaxDelayMs);
    });
  });

  group('草稿狀態判定', () {
    OfflineDraft build(OfflineDraftStatus status) => OfflineDraft(
      clientRef: 'c' * 32,
      kind: OfflineDraftKind.transaction,
      ledgerId: '',
      payload: const {},
      status: status,
      createdAt: DateTime(2026, 10, 21),
      updatedAt: DateTime(2026, 10, 21),
    );

    test('只有 pending 視為等待使用者確認', () {
      expect(isAwaitingConfirmation(build(OfflineDraftStatus.pending)), isTrue);
      expect(isAwaitingConfirmation(build(OfflineDraftStatus.failed)), isFalse);
      expect(
        isAwaitingConfirmation(build(OfflineDraftStatus.sending)),
        isFalse,
      );
      expect(isAwaitingConfirmation(build(OfflineDraftStatus.synced)), isFalse);
    });

    test('待處理計數包含 pending、sending 與 failed', () {
      expect(isOutstanding(build(OfflineDraftStatus.pending)), isTrue);
      expect(isOutstanding(build(OfflineDraftStatus.sending)), isTrue);
      expect(isOutstanding(build(OfflineDraftStatus.failed)), isTrue);
      expect(isOutstanding(build(OfflineDraftStatus.editing)), isFalse);
      expect(isOutstanding(build(OfflineDraftStatus.synced)), isFalse);
    });
  });

  group('序列化', () {
    test('toJson／fromJson 往返保留所有欄位', () {
      final draft = OfflineDraft(
        clientRef: 'd' * 32,
        kind: OfflineDraftKind.transfer,
        ledgerId: 'ledger-1',
        payload: const {'amount': 200, 'fromAccountId': 'acc-1'},
        status: OfflineDraftStatus.failed,
        createdAt: DateTime(2026, 10, 21, 10, 30),
        updatedAt: DateTime(2026, 10, 21, 11, 0),
        attempts: 3,
        lastError: '連線失敗',
        postedTransactionId: 'transaction-1',
        photoPaths: const ['/tmp/a.jpg'],
      );
      final restored = OfflineDraft.fromJson(draft.toJson());
      expect(restored, isNotNull);
      expect(restored!.clientRef, draft.clientRef);
      expect(restored.kind, OfflineDraftKind.transfer);
      expect(restored.ledgerId, 'ledger-1');
      expect(restored.status, OfflineDraftStatus.failed);
      expect(restored.attempts, 3);
      expect(restored.lastError, '連線失敗');
      expect(restored.postedTransactionId, 'transaction-1');
      expect(restored.photoPaths, ['/tmp/a.jpg']);
      expect(restored.payload['amount'], 200);
    });

    test('形狀不合法回傳 null（不讓壞資料擋住 App）', () {
      expect(OfflineDraft.fromJson(null), isNull);
      expect(OfflineDraft.fromJson('not-a-draft'), isNull);
      expect(OfflineDraft.fromJson(<String, dynamic>{}), isNull);
      expect(OfflineDraft.fromJson({'clientRef': ''}), isNull);
      expect(
        OfflineDraft.fromJson({'clientRef': 'x', 'payload': 'not-a-map'}),
        isNull,
      );
    });
  });

  group('checkDraftSendGate（草稿送出前驗證，計畫書 5.5）', () {
    test('未登入時拒絕送出且不查詢帳本角色', () async {
      final context = _FakeSendContext(loggedIn: false);

      expect(
        await checkDraftSendGate('ledger-1', context),
        DraftSendGate.notLoggedIn,
      );
      expect(context.refreshCalls, 0);
    });

    test('登入檢查優先於帳本不符', () async {
      final context = _FakeSendContext(loggedIn: false, active: 'ledger-2');

      expect(
        await checkDraftSendGate('ledger-1', context),
        DraftSendGate.notLoggedIn,
      );
      expect(context.refreshCalls, 0);
    });

    test('帳本不符時拒絕送出且不查詢帳本角色', () async {
      final context = _FakeSendContext(active: 'ledger-2');

      expect(
        await checkDraftSendGate('ledger-1', context),
        DraftSendGate.otherLedger,
      );
      expect(context.refreshCalls, 0);
    });

    test('同帳本且可寫時通過驗證', () async {
      final context = _FakeSendContext(active: 'ledger-1');

      expect(await checkDraftSendGate('ledger-1', context), DraftSendGate.ok);
      expect(context.refreshCalls, 1);
    });

    test('唯讀帳本拒絕送出', () async {
      final context = _FakeSendContext(active: 'ledger-1', readOnly: true);

      expect(
        await checkDraftSendGate('ledger-1', context),
        DraftSendGate.readOnly,
      );
    });

    test('重新查詢角色期間登出時仍拒絕送出', () async {
      final context = _FakeSendContext(active: 'ledger-1', readOnly: true);
      context.onRefresh = () => context.loggedIn = false;

      expect(
        await checkDraftSendGate('ledger-1', context),
        DraftSendGate.notLoggedIn,
      );
    });

    test('個人帳本草稿可在個人帳本通過驗證', () async {
      final context = _FakeSendContext(active: '');

      expect(await checkDraftSendGate('', context), DraftSendGate.ok);
    });
  });

  group('isDraftForLedger（草稿與目前帳本一致性，計畫書 5.5）', () {
    test('同一帳本可送出', () {
      expect(isDraftForLedger('ledger-1', 'ledger-1'), isTrue);
    });

    test('不同帳本一律拒絕，避免把 A 帳本草稿寫進 B 帳本', () {
      expect(isDraftForLedger('ledger-1', 'ledger-2'), isFalse);
    });

    test('空字串代表個人帳本：個人草稿不得送進共享帳本，反之亦然', () {
      expect(isDraftForLedger('', ''), isTrue);
      expect(isDraftForLedger('', 'ledger-1'), isFalse);
      expect(isDraftForLedger('ledger-1', ''), isFalse);
    });

    test('前後空白不影響判定', () {
      expect(isDraftForLedger(' ledger-1 ', 'ledger-1'), isTrue);
      expect(isDraftForLedger('  ', ''), isTrue);
    });

    test('大小寫視為不同帳本（帳本 ID 區分大小寫）', () {
      expect(isDraftForLedger('Ledger-1', 'ledger-1'), isFalse);
    });
  });
}

class _FakeSendContext implements DraftSendContext {
  _FakeSendContext({
    this.loggedIn = true,
    this.active = '',
    this.readOnly = false,
  });

  bool loggedIn;
  String active;
  bool readOnly;
  int refreshCalls = 0;
  void Function()? onRefresh;

  @override
  bool get isLoggedIn => loggedIn;

  @override
  String get activeLedgerId => active;

  @override
  Future<bool> refreshLedgerReadOnly() async {
    refreshCalls++;
    onRefresh?.call();
    return readOnly;
  }
}

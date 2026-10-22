// 離線草稿持久化層測試（對應 docs/ios-app-development-plan.md 第 5.5 節）。
//
// 驗證重點是計畫書承諾的「跨帳號隔離」與「重啟仍可找回」：
// - 草稿依「使用者 + 帳本」分檔，A 帳號看不到 B 帳號的草稿。
// - 清除某帳號的草稿不影響其他帳號。
// - 壞掉的單筆資料不會讓整個草稿清單讀不出來。
// - 中斷送出可恢復；刪除帳號會清除其照片副本。

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:assetpilot/offline/offline_draft_core.dart';
import 'package:assetpilot/offline/offline_draft_store.dart';

OfflineDraft makeDraft(
  String clientRef, {
  String ledgerId = '',
  OfflineDraftStatus status = OfflineDraftStatus.pending,
  Map<String, dynamic> payload = const {'amount': 100},
  String? postedTransactionId,
  List<String> photoPaths = const [],
}) {
  return OfflineDraft(
    clientRef: clientRef,
    kind: OfflineDraftKind.transaction,
    ledgerId: ledgerId,
    payload: payload,
    status: status,
    createdAt: DateTime(2026, 10, 21, 9, 0),
    updatedAt: DateTime(2026, 10, 21, 9, 0),
    postedTransactionId: postedTransactionId,
    photoPaths: photoPaths,
  );
}

void main() {
  setUp(() {
    OfflineDraftStore.overrideBackend = <String, String>{};
  });

  tearDown(() {
    OfflineDraftStore.overrideBackend = null;
  });

  group('跨帳號／跨帳本隔離', () {
    test('不同帳號讀不到彼此的草稿', () async {
      await OfflineDraftStore.save('user-a', 'ledger-1', [
        makeDraft('a' * 32, ledgerId: 'ledger-1'),
      ]);
      await OfflineDraftStore.save('user-b', 'ledger-1', [
        makeDraft('b' * 32, ledgerId: 'ledger-1'),
      ]);

      final forA = await OfflineDraftStore.load('user-a', 'ledger-1');
      final forB = await OfflineDraftStore.load('user-b', 'ledger-1');

      expect(forA.length, 1);
      expect(forB.length, 1);
      expect(forA.first.clientRef, 'a' * 32);
      expect(forB.first.clientRef, 'b' * 32);
    });

    test('同一帳號的不同帳本互相隔離', () async {
      await OfflineDraftStore.save('user-a', 'ledger-1', [
        makeDraft('a' * 32, ledgerId: 'ledger-1'),
      ]);
      await OfflineDraftStore.save('user-a', 'ledger-2', [
        makeDraft('b' * 32, ledgerId: 'ledger-2'),
      ]);

      expect((await OfflineDraftStore.load('user-a', 'ledger-1')).length, 1);
      expect((await OfflineDraftStore.load('user-a', 'ledger-2')).length, 1);
      expect((await OfflineDraftStore.load('user-a', '')).length, 0);
    });

    test('清除某帳號不影響其他帳號的草稿', () async {
      await OfflineDraftStore.save('user-a', '', [makeDraft('a' * 32)]);
      await OfflineDraftStore.save('user-b', '', [makeDraft('b' * 32)]);

      await OfflineDraftStore.clearUser('user-a');

      expect(await OfflineDraftStore.load('user-a', ''), isEmpty);
      expect((await OfflineDraftStore.load('user-b', '')).length, 1);
    });

    test('清除帳號也刪除照片副本與記住的使用者識別', () async {
      final directory = await Directory.systemTemp.createTemp('draft-photo-');
      final photo = File('${directory.path}/receipt.jpg');
      await photo.writeAsString('private receipt data');
      await OfflineDraftStore.save('user-a', '', [
        makeDraft('a' * 32, photoPaths: [photo.path]),
      ]);
      await OfflineDraftStore.rememberUserId('user-a');

      await OfflineDraftStore.clearUser('user-a');

      expect(await photo.exists(), isFalse);
      expect(await OfflineDraftStore.readRememberedUserId(), isNull);
      await directory.delete(recursive: true);
    });

    test('移除單筆草稿後清單為空', () async {
      await OfflineDraftStore.save('user-a', '', [
        makeDraft('a' * 32),
        makeDraft('b' * 32),
      ]);

      await OfflineDraftStore.remove('user-a', '', 'a' * 32);

      final remaining = await OfflineDraftStore.load('user-a', '');
      expect(remaining.length, 1);
      expect(remaining.first.clientRef, 'b' * 32);
    });
  });

  group('持久化與復原', () {
    test('中斷送出時，已建立交易的草稿只恢復為待補附件', () async {
      await OfflineDraftStore.save('user-a', 'ledger-1', [
        makeDraft(
          'a' * 32,
          ledgerId: 'ledger-1',
          status: OfflineDraftStatus.sending,
          postedTransactionId: 'transaction-1',
          photoPaths: const ['/tmp/receipt.jpg'],
        ),
        makeDraft(
          'b' * 32,
          ledgerId: 'ledger-1',
          status: OfflineDraftStatus.sending,
        ),
      ]);

      await OfflineDraftStore.recoverInterruptedSends('user-a', 'ledger-1');

      final recovered = await OfflineDraftStore.load('user-a', 'ledger-1');
      expect(recovered[0].status, OfflineDraftStatus.failed);
      expect(recovered[0].postedTransactionId, 'transaction-1');
      expect(recovered[1].status, OfflineDraftStatus.pending);
    });

    test('重新讀取後草稿內容不變（重啟仍可找回）', () async {
      final draft = makeDraft(
        'c' * 32,
        ledgerId: 'ledger-1',
        status: OfflineDraftStatus.failed,
        payload: const {'amount': 250, 'currency': 'TWD'},
      );
      await OfflineDraftStore.save('user-a', 'ledger-1', [draft]);

      final restored = await OfflineDraftStore.load('user-a', 'ledger-1');
      expect(restored.length, 1);
      expect(restored.first.clientRef, draft.clientRef);
      expect(restored.first.status, OfflineDraftStatus.failed);
      expect(restored.first.ledgerId, 'ledger-1');
      expect(restored.first.payload['amount'], 250);
    });

    test('草稿依建立時間排序（畫面顯示順序固定）', () async {
      final older = makeDraft('d' * 32).copyWith();
      final newer = OfflineDraft(
        clientRef: 'e' * 32,
        kind: OfflineDraftKind.transaction,
        ledgerId: '',
        payload: const {},
        status: OfflineDraftStatus.pending,
        createdAt: DateTime(2026, 10, 22),
        updatedAt: DateTime(2026, 10, 22),
      );
      await OfflineDraftStore.save('user-a', '', [newer, older]);

      final loaded = await OfflineDraftStore.load('user-a', '');
      expect(loaded.first.createdAt.isBefore(loaded.last.createdAt), isTrue);
    });

    test('清空後不再保留分檔', () async {
      await OfflineDraftStore.save('user-a', '', [makeDraft('a' * 32)]);
      await OfflineDraftStore.save('user-a', '', []);
      expect(await OfflineDraftStore.load('user-a', ''), isEmpty);
    });
  });

  group('壞資料容錯', () {
    test('單筆形狀不合法時略過該筆，其餘仍可讀出', () async {
      // 先寫入正常草稿，再手動塞入一筆壞資料。
      await OfflineDraftStore.save('user-a', '', [makeDraft('a' * 32)]);
      final key = OfflineDraftStore.overrideBackend!.keys.firstWhere(
        (k) => k.contains('user-a'),
      );
      final raw = OfflineDraftStore.overrideBackend![key]!;
      OfflineDraftStore.overrideBackend![key] =
          '[{"clientRef":"","payload":"broken"},${raw.substring(1)}';

      final loaded = await OfflineDraftStore.load('user-a', '');
      expect(loaded.length, 1);
      expect(loaded.first.clientRef, 'a' * 32);
    });

    test('整份資料不是合法 JSON 時回傳空清單', () async {
      final key = 'assetpilot.offlineDrafts.user-a.personal';
      OfflineDraftStore.overrideBackend![key] = 'not-json-at-all';
      expect(await OfflineDraftStore.load('user-a', ''), isEmpty);
    });
  });
}

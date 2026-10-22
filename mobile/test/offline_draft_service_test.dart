import 'package:flutter_test/flutter_test.dart';

import 'package:assetpilot/offline/offline_draft_core.dart';
import 'package:assetpilot/offline/offline_draft_service.dart';
import 'package:assetpilot/offline/offline_draft_store.dart';

class _FakeDraftApi implements OfflineDraftApi {
  int createCalls = 0;
  int uploadCalls = 0;
  bool failUpload = true;
  final uploadedTransactionIds = <String>[];

  @override
  Future<void> transfer(Map<String, dynamic> body) async {}

  @override
  Future<Map<String, dynamic>> createTransaction(
    Map<String, dynamic> body,
  ) async {
    createCalls++;
    return {'id': 'transaction-1'};
  }

  @override
  Future<void> uploadTransactionPhotos(
    String transactionId,
    List<String> paths,
  ) async {
    uploadCalls++;
    uploadedTransactionIds.add(transactionId);
    if (failUpload) throw StateError('photo upload failed');
  }
}

class _SendContext implements DraftSendContext {
  @override
  bool get isLoggedIn => true;

  @override
  String get activeLedgerId => 'ledger-1';

  @override
  Future<bool> refreshLedgerReadOnly() async => false;
}

void main() {
  final service = OfflineDraftService.instance;
  late _FakeDraftApi api;
  late String userId;

  setUp(() async {
    userId = 'service-test-${DateTime.now().microsecondsSinceEpoch}';
    OfflineDraftStore.overrideBackend = <String, String>{};
    OfflineDraftService.overrideSendContext = _SendContext();
    api = _FakeDraftApi();
    OfflineDraftService.overrideApi = api;
    await service.bind(userId: userId, ledgerId: 'ledger-1');
  });

  tearDown(() {
    service.pause();
    OfflineDraftService.overrideApi = null;
    OfflineDraftService.overrideSendContext = null;
    OfflineDraftStore.overrideBackend = null;
  });

  test('照片上傳失敗後保留已入帳草稿，重試不會重複建立交易', () async {
    final draft = OfflineDraft(
      clientRef: 'a' * 32,
      kind: OfflineDraftKind.transaction,
      ledgerId: 'ledger-1',
      payload: const {'amount': 100},
      status: OfflineDraftStatus.pending,
      createdAt: DateTime(2026, 10, 21),
      updatedAt: DateTime(2026, 10, 21),
      photoPaths: const ['/tmp/receipt.jpg'],
    );
    await OfflineDraftStore.save(userId, 'ledger-1', [draft]);

    final first = await service.submit(draft);

    expect(first.outcome, DraftSubmitOutcome.postedPhotoPending);
    expect(first.pendingPhotoCount, 1);
    var saved = (await service.list()).single;
    expect(saved.status, OfflineDraftStatus.failed);
    expect(saved.postedTransactionId, 'transaction-1');
    expect(saved.photoPaths, ['/tmp/receipt.jpg']);
    expect(api.createCalls, 1);
    expect(api.uploadCalls, 1);

    api.failUpload = false;
    final second = await service.submit(saved);

    expect(second.outcome, DraftSubmitOutcome.synced);
    expect(await service.list(), isEmpty);
    expect(api.createCalls, 1);
    expect(api.uploadCalls, 2);
    expect(api.uploadedTransactionIds, ['transaction-1', 'transaction-1']);
  });
}

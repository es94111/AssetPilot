import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:assetpilot/offline/offline_draft_core.dart';
import 'package:assetpilot/offline/offline_draft_service.dart';
import 'package:assetpilot/offline/offline_draft_store.dart';
import 'package:assetpilot/platform/offline_photo_vault.dart';

class _FakeDraftApi implements OfflineDraftApi {
  int createCalls = 0;
  int uploadCalls = 0;
  bool failUpload = true;
  final uploadedTransactionIds = <String>[];
  final uploadedPaths = <String>[];
  final uploadedContents = <String>[];

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
    for (final path in paths) {
      uploadedPaths.add(path);
      final file = File(path);
      uploadedContents.add(file.existsSync() ? file.readAsStringSync() : '');
    }
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

  group('iOS 加密照片', () {
    const channel = MethodChannel('assetpilot/file_crypto');
    late Directory root;
    var failDecrypt = false;

    setUp(() async {
      TestWidgetsFlutterBinding.ensureInitialized();
      root = await Directory.systemTemp.createTemp('offline-service-photo');
      failDecrypt = false;
      OfflinePhotoVault.overrideTempDirectory = Directory('${root.path}/tmp');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
            if (call.method != 'decryptFile') throw MissingPluginException();
            if (failDecrypt) throw PlatformException(code: 'keyUnavailable');
            final args = call.arguments as Map<Object?, Object?>;
            await File('${args['dest']}').writeAsString('decrypted-photo');
            return true;
          });
    });

    tearDown(() async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
      OfflinePhotoVault.overrideTempDirectory = null;
      await root.delete(recursive: true);
    });

    OfflineDraft draftWithPhoto(String path) => OfflineDraft(
      clientRef: 'b' * 32,
      kind: OfflineDraftKind.transaction,
      ledgerId: 'ledger-1',
      payload: const {'amount': 100},
      status: OfflineDraftStatus.pending,
      createdAt: DateTime(2026, 10, 21),
      updatedAt: DateTime(2026, 10, 21),
      photoPaths: [path],
    );

    test('上傳的是解密後的暫存檔，完成後暫存檔被刪除、加密檔一併清除', () async {
      final encrypted = File('${root.path}/1_receipt.jpg.enc');
      await encrypted.writeAsString('ciphertext');
      final draft = draftWithPhoto(encrypted.path);
      await OfflineDraftStore.save(userId, 'ledger-1', [draft]);
      api.failUpload = false;

      final result = await service.submit(draft);

      expect(result.outcome, DraftSubmitOutcome.synced);
      expect(api.uploadedPaths, hasLength(1));
      expect(api.uploadedPaths.single, isNot(encrypted.path));
      expect(api.uploadedPaths.single, endsWith('_receipt.jpg'));
      expect(api.uploadedContents.single, 'decrypted-photo');
      expect(File(api.uploadedPaths.single).existsSync(), isFalse);
      expect(encrypted.existsSync(), isFalse);
    });

    test('上傳失敗仍會刪除暫存檔，加密檔保留供重試', () async {
      final encrypted = File('${root.path}/1_receipt.jpg.enc');
      await encrypted.writeAsString('ciphertext');
      final draft = draftWithPhoto(encrypted.path);
      await OfflineDraftStore.save(userId, 'ledger-1', [draft]);

      final result = await service.submit(draft);

      expect(result.outcome, DraftSubmitOutcome.postedPhotoPending);
      expect(File(api.uploadedPaths.single).existsSync(), isFalse);
      expect(encrypted.existsSync(), isTrue);
    });

    test('解密失敗（金鑰遺失）走「照片待補上傳」流程，不會呼叫上傳', () async {
      failDecrypt = true;
      final encrypted = File('${root.path}/1_receipt.jpg.enc');
      await encrypted.writeAsString('ciphertext');
      final draft = draftWithPhoto(encrypted.path);
      await OfflineDraftStore.save(userId, 'ledger-1', [draft]);

      final result = await service.submit(draft);

      expect(result.outcome, DraftSubmitOutcome.postedPhotoPending);
      expect(api.uploadCalls, 0);
      final saved = (await service.list()).single;
      expect(saved.postedTransactionId, 'transaction-1');
      expect(saved.photoPaths, [encrypted.path]);
    });
  });
}

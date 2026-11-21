// 離線草稿照片加密保存測試（對應 iOS 原生 CryptoKit AES-256-GCM 通道）。
//
// 原生端的加解密由 XCTest（RunnerTests/OfflineFileCryptoTests.swift）驗證；
// 這裡以假的方法通道驗證 Dart 端的契約：
// - iOS 只保存 `.enc` 檔，不留下明文。
// - 上傳前解密到暫存檔，用完清除。
// - 舊版明文路徑原樣通過、不會被清理函式刪除。
// - 加密失敗不保存該張照片。

import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:assetpilot/offline/offline_draft_store.dart';
import 'package:assetpilot/platform/offline_photo_vault.dart';

const _channel = MethodChannel('assetpilot/file_crypto');
const _header = [0x41, 0x50, 0x45, 0x31];

List<int> _fakeEncrypt(List<int> plain) => [
  ..._header,
  ...plain.map((byte) => byte ^ 0x5A),
];

List<int> _fakeDecrypt(List<int> blob) {
  if (blob.length < _header.length ||
      !List.generate(
        _header.length,
        (i) => blob[i] == _header[i],
      ).every((same) => same)) {
    throw PlatformException(code: 'invalidFormat');
  }
  return blob.skip(_header.length).map((byte) => byte ^ 0x5A).toList();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory root;
  late Directory photosDir;
  late Directory tempDir;
  var failEncrypt = false;
  var failDecrypt = false;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('offline-vault-test');
    photosDir = Directory('${root.path}/photos');
    tempDir = Directory('${root.path}/tmp');
    failEncrypt = false;
    failDecrypt = false;
    OfflinePhotoVault.overrideIsIOS = true;
    OfflinePhotoVault.overrideTempDirectory = tempDir;
    OfflineDraftStore.overridePhotosDirectory = photosDir;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, (call) async {
          final args = call.arguments as Map<Object?, Object?>;
          if (call.method == 'encryptFile') {
            if (failEncrypt) throw PlatformException(code: 'keyUnavailable');
            final plain = await File('${args['src']}').readAsBytes();
            await File('${args['dest']}').writeAsBytes(_fakeEncrypt(plain));
            return true;
          }
          if (call.method == 'decryptFile') {
            if (failDecrypt) throw PlatformException(code: 'decryptionFailed');
            final blob = await File('${args['path']}').readAsBytes();
            await File('${args['dest']}').writeAsBytes(_fakeDecrypt(blob));
            return true;
          }
          throw MissingPluginException();
        });
  });

  tearDown(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, null);
    OfflinePhotoVault.overrideIsIOS = null;
    OfflinePhotoVault.overrideTempDirectory = null;
    OfflineDraftStore.overridePhotosDirectory = null;
    await root.delete(recursive: true);
  });

  Future<File> makePhoto(String name, String content) async {
    final file = File('${root.path}/$name');
    await file.writeAsString(content);
    return file;
  }

  test('iOS：persistPhotos 只保存 .enc 檔，內容不是明文', () async {
    final photo = await makePhoto('receipt.jpg', 'secret-receipt');

    final saved = await OfflineDraftStore.persistPhotos([photo.path]);

    expect(saved, hasLength(1));
    expect(saved.single, endsWith('_receipt.jpg.enc'));
    final onDisk = await File(saved.single).readAsBytes();
    expect(String.fromCharCodes(onDisk), isNot(contains('secret-receipt')));
    final files = photosDir.listSync().map((e) => e.path).toList();
    expect(files, [saved.single]);
  });

  test('非 iOS：維持原行為，直接複製明文', () async {
    OfflinePhotoVault.overrideIsIOS = false;
    final photo = await makePhoto('receipt.jpg', 'plain-copy');

    final saved = await OfflineDraftStore.persistPhotos([photo.path]);

    expect(saved, hasLength(1));
    expect(saved.single, isNot(endsWith('.enc')));
    expect(await File(saved.single).readAsString(), 'plain-copy');
  });

  test('加密失敗時不保存該張照片，也不留下檔案', () async {
    failEncrypt = true;
    final photo = await makePhoto('receipt.jpg', 'secret-receipt');

    final saved = await OfflineDraftStore.persistPhotos([photo.path]);

    expect(saved, isEmpty);
    expect(photosDir.listSync(), isEmpty);
  });

  test('來源檔不存在時略過，其他照片照常保存', () async {
    final photo = await makePhoto('ok.jpg', 'ok-photo');

    final saved = await OfflineDraftStore.persistPhotos([
      '${root.path}/missing.jpg',
      photo.path,
    ]);

    expect(saved, hasLength(1));
    expect(saved.single, endsWith('_ok.jpg.enc'));
  });

  test('decryptToTemp 解密成可上傳的暫存檔並保留副檔名，cleanup 後刪除', () async {
    final photo = await makePhoto('receipt.jpg', 'secret-receipt');
    final saved = await OfflineDraftStore.persistPhotos([photo.path]);

    final decrypted = await OfflinePhotoVault.decryptToTemp(saved);

    expect(decrypted.paths, hasLength(1));
    final tempPath = decrypted.paths.single;
    expect(tempPath, startsWith(tempDir.path));
    expect(tempPath, endsWith('_receipt.jpg'));
    expect(await File(tempPath).readAsString(), 'secret-receipt');

    await decrypted.cleanup();
    expect(File(tempPath).existsSync(), isFalse);
    expect(File(saved.single).existsSync(), isTrue);
  });

  test('舊版明文路徑原樣通過，cleanup 不會刪除它', () async {
    final legacy = await makePhoto('legacy.jpg', 'legacy-plain');

    final decrypted = await OfflinePhotoVault.decryptToTemp([legacy.path]);

    expect(decrypted.paths, [legacy.path]);
    await decrypted.cleanup();
    expect(legacy.existsSync(), isTrue);
  });

  test('混合清單保持順序，只有 .enc 會被解密', () async {
    final legacy = await makePhoto('legacy.jpg', 'legacy-plain');
    final photo = await makePhoto('new.jpg', 'new-secret');
    final saved = await OfflineDraftStore.persistPhotos([photo.path]);

    final decrypted = await OfflinePhotoVault.decryptToTemp([
      legacy.path,
      saved.single,
    ]);

    expect(decrypted.paths.first, legacy.path);
    expect(await File(decrypted.paths.last).readAsString(), 'new-secret');
    await decrypted.cleanup();
    expect(legacy.existsSync(), isTrue);
  });

  test('解密失敗會丟出例外，並清掉已產生的暫存檔', () async {
    final first = await makePhoto('a.jpg', 'first');
    final second = await makePhoto('b.jpg', 'second');
    final saved = await OfflineDraftStore.persistPhotos([
      first.path,
      second.path,
    ]);
    var calls = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, (call) async {
          final args = call.arguments as Map<Object?, Object?>;
          calls++;
          if (calls == 2) throw PlatformException(code: 'decryptionFailed');
          final blob = await File('${args['path']}').readAsBytes();
          await File('${args['dest']}').writeAsBytes(_fakeDecrypt(blob));
          return true;
        });

    await expectLater(
      OfflinePhotoVault.decryptToTemp(saved),
      throwsA(isA<PlatformException>()),
    );

    expect(tempDir.listSync(), isEmpty);
  });
}

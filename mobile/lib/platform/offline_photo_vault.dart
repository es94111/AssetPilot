import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import 'platform_info.dart';

/// 已解密成暫存檔的照片。用完務必呼叫 [cleanup] 刪除暫存檔。
class DecryptedPhotos {
  const DecryptedPhotos(this.paths, this._cleanup);

  /// 可直接上傳的檔案路徑（順序與輸入一致）。
  final List<String> paths;
  final Future<void> Function() _cleanup;

  /// 刪除本次解密產生的暫存檔；舊的明文檔不會被刪除。
  Future<void> cleanup() => _cleanup();
}

/// 離線草稿照片的加密保存。
///
/// - iOS：照片以 AES-256-GCM 加密後存成 `<微秒>_<原檔名>.enc`，
///   金鑰放在 Keychain，加解密由原生端（CryptoKit）執行。
/// - 其他平台：維持原行為，直接複製、不加密。
/// - 加密失敗時不保存該張照片，**絕不把明文落地到草稿資料夾**。
class OfflinePhotoVault {
  OfflinePhotoVault._();

  static const _channel = MethodChannel('assetpilot/file_crypto');

  /// 加密檔副檔名。解密時據此辨識；沒有這個副檔名的路徑視為舊版明文檔。
  static const encryptedSuffix = '.enc';

  static const _tempFolderName = 'apvault_tmp';

  /// 測試用：強制指定是否走 iOS 加密分支。
  @visibleForTesting
  static bool? overrideIsIOS;

  /// 測試用：覆寫暫存資料夾。
  @visibleForTesting
  static Directory? overrideTempDirectory;

  static bool get _encrypts => overrideIsIOS ?? PlatformInfo.isIOS;

  /// 把 [sourcePath] 保存到 [destinationDirectory]。
  ///
  /// 回傳保存後的路徑；來源不存在或加密／複製失敗時回傳 null，
  /// 且不會在目的資料夾留下任何檔案。
  static Future<String?> encryptCopy(
    String sourcePath,
    Directory destinationDirectory,
  ) async {
    final source = File(sourcePath);
    if (!source.existsSync()) return null;
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final baseName = _basename(sourcePath);
    final destinationPath = _encrypts
        ? '${destinationDirectory.path}/${stamp}_$baseName$encryptedSuffix'
        : '${destinationDirectory.path}/${stamp}_$baseName';
    try {
      if (!destinationDirectory.existsSync()) {
        await destinationDirectory.create(recursive: true);
      }
      if (_encrypts) {
        await _channel.invokeMethod<bool>('encryptFile', {
          'src': sourcePath,
          'dest': destinationPath,
        });
      } else {
        await source.copy(destinationPath);
      }
      return destinationPath;
    } catch (_) {
      await _deleteQuietly(destinationPath);
      return null;
    }
  }

  /// 把 [paths] 解密成可上傳的暫存檔。
  ///
  /// `.enc` 檔會解密到暫存資料夾並保留原副檔名；其他路徑（舊版明文檔）
  /// 原樣回傳。任何一張解密失敗就丟出例外，並先刪掉已產生的暫存檔。
  static Future<DecryptedPhotos> decryptToTemp(List<String> paths) async {
    final temps = <String>[];
    final resolved = <String>[];
    try {
      Directory? tempDirectory;
      for (final path in paths) {
        if (!path.endsWith(encryptedSuffix)) {
          resolved.add(path);
          continue;
        }
        tempDirectory ??= await _tempDirectory();
        final encryptedName = _basename(path);
        final plainName = encryptedName.substring(
          0,
          encryptedName.length - encryptedSuffix.length,
        );
        final destinationPath =
            '${tempDirectory.path}/${DateTime.now().microsecondsSinceEpoch}_$plainName';
        temps.add(destinationPath);
        await _channel.invokeMethod<bool>('decryptFile', {
          'path': path,
          'dest': destinationPath,
        });
        resolved.add(destinationPath);
      }
    } catch (_) {
      await _deleteAll(temps);
      rethrow;
    }
    return DecryptedPhotos(resolved, () => _deleteAll(temps));
  }

  static Future<Directory> _tempDirectory() async {
    final base =
        overrideTempDirectory ??
        Directory('${(await getTemporaryDirectory()).path}/$_tempFolderName');
    if (!base.existsSync()) await base.create(recursive: true);
    return base;
  }

  static String _basename(String path) => File(path).uri.pathSegments.last;

  static Future<void> _deleteAll(List<String> paths) async {
    for (final path in paths) {
      await _deleteQuietly(path);
    }
  }

  static Future<void> _deleteQuietly(String path) async {
    try {
      final file = File(path);
      if (file.existsSync()) await file.delete();
    } catch (_) {
      // 刪除失敗不影響主流程。
    }
  }
}

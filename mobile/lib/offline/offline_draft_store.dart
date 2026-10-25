import 'dart:convert';
import 'dart:io' show File;

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../platform/secure_store.dart';
import 'offline_draft_core.dart';

/// 離線草稿的持久化儲存。
///
/// 存放位置與保護方式：
/// - 草稿含金額、日期、分類、帳戶與備註等財務內容，因此**不**放在
///   SharedPreferences（明文）而放在 [SecureStore]：
///   Android 走 Keystore 加密的偏好儲存，iOS 走 Keychain。
/// - 草稿依「使用者 id + 帳本 id」分檔存放，切換帳號或帳本時不會互相看到
///   對方的草稿，也不會把前一帳號的草稿送出（計畫書 5.5）。
/// - 登出時保留草稿（讓同一帳號下次登入可恢復），但下一位使用者登入時
///   只會讀到自己的分檔；離開本機的最後一道防線是分檔本身。
class OfflineDraftStore {
  OfflineDraftStore._();

  static const _keyPrefix = 'assetpilot.offlineDrafts.';
  static const _indexKey = 'assetpilot.offlineDrafts.index';
  static const _lastUserIdKey = 'assetpilot.offlineDrafts.lastUserId';

  /// 測試用：覆寫儲存後端（[SecureStore] 的鍵值對）。
  @visibleForTesting
  static Map<String, String>? overrideBackend;

  static Future<Map<String, String>> _readAll() async {
    if (overrideBackend != null) return {...overrideBackend!};
    final index = await SecureStore.read(_indexKey);
    if (index == null || index.isEmpty) return {};
    final out = <String, String>{};
    for (final key in index.split('|')) {
      if (key.isEmpty) continue;
      final value = await SecureStore.read(key);
      if (value != null) out[key] = value;
    }
    return out;
  }

  static Future<void> _writeAll(Map<String, String> data) async {
    if (overrideBackend != null) {
      overrideBackend = {...data};
      return;
    }
    final previousKeys = (await SecureStore.read(_indexKey) ?? '')
        .split('|')
        .where((key) => key.isNotEmpty)
        .toSet();
    // 先寫各分檔，再更新索引；索引是最後一道保險，寫入中途中斷時
    // 舊索引仍指向可讀的舊資料。
    for (final entry in data.entries) {
      await SecureStore.write(entry.key, entry.value);
    }
    for (final key in previousKeys.difference(data.keys.toSet())) {
      await SecureStore.delete(key);
    }
    final index = data.keys.join('|');
    if (index.isEmpty) {
      await SecureStore.delete(_indexKey);
    } else {
      await SecureStore.write(_indexKey, index);
    }
  }

  /// 某位使用者在某個帳本下的分檔鍵。
  static String _bucketKey(String userId, String ledgerId) =>
      '$_keyPrefix${userId.isEmpty ? 'anon' : userId}.${ledgerId.isEmpty ? 'personal' : ledgerId}';

  /// 讀出某帳本底下的所有草稿；壞掉的項目一律略過，不讓單筆壞資料擋住整個 App。
  static Future<List<OfflineDraft>> load(String userId, String ledgerId) async {
    final all = await _readAll();
    final raw = all[_bucketKey(userId, ledgerId)];
    if (raw == null || raw.isEmpty) return [];
    List<Object?> decoded;
    try {
      decoded = jsonDecode(raw) as List<Object?>;
    } catch (_) {
      return [];
    }
    final drafts = <OfflineDraft>[];
    for (final item in decoded) {
      final draft = OfflineDraft.fromJson(item);
      if (draft != null) drafts.add(draft);
    }
    drafts.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return drafts;
  }

  /// 覆寫某帳本底下的草稿清單。
  static Future<void> save(
    String userId,
    String ledgerId,
    List<OfflineDraft> drafts,
  ) async {
    final all = await _readAll();
    final key = _bucketKey(userId, ledgerId);
    if (drafts.isEmpty) {
      all.remove(key);
    } else {
      all[key] = jsonEncode(drafts.map((d) => d.toJson()).toList());
    }
    await _writeAll(all);
  }

  /// 記住最近一次已驗證登入的使用者，供離線冷啟動還原正確分檔。
  static Future<void> rememberUserId(String userId) async {
    if (userId.isEmpty) return;
    final all = await _readAll();
    all[_lastUserIdKey] = userId;
    await _writeAll(all);
  }

  static Future<String?> readRememberedUserId() async {
    final userId = (await _readAll())[_lastUserIdKey];
    return userId == null || userId.isEmpty ? null : userId;
  }

  static Future<void> clearRememberedUserId() async {
    final all = await _readAll();
    all.remove(_lastUserIdKey);
    await _writeAll(all);
  }

  /// 將 App 被系統中止時留下的 sending 狀態恢復為可人工處理。
  /// 已建立交易的草稿標為 failed，避免啟動時再次建立交易；其餘可由使用者重試。
  static Future<void> recoverInterruptedSends(
    String userId,
    String ledgerId,
  ) async {
    final drafts = await load(userId, ledgerId);
    var changed = false;
    final recovered = drafts.map((draft) {
      if (draft.status != OfflineDraftStatus.sending) return draft;
      changed = true;
      return draft.copyWith(
        status: draft.postedTransactionId == null
            ? OfflineDraftStatus.pending
            : OfflineDraftStatus.failed,
      );
    }).toList();
    if (changed) await save(userId, ledgerId, recovered);
  }

  /// 移除單一草稿（入帳成功或使用者捨棄後呼叫）。
  static Future<void> remove(
    String userId,
    String ledgerId,
    String clientRef,
  ) async {
    final drafts = await load(userId, ledgerId);
    final next = drafts.where((d) => d.clientRef != clientRef).toList();
    await save(userId, ledgerId, next);
  }

  /// 清除某位使用者的所有草稿與照片副本（帳號刪除成功後呼叫）。
  static Future<void> clearUser(String userId) async {
    final all = await _readAll();
    final prefix = '$_keyPrefix${userId.isEmpty ? 'anon' : userId}.';
    final photoPaths = <String>[];
    for (final entry in all.entries.where(
      (entry) => entry.key.startsWith(prefix),
    )) {
      try {
        final decoded = jsonDecode(entry.value);
        if (decoded is! List) continue;
        for (final item in decoded) {
          final draft = OfflineDraft.fromJson(item);
          if (draft != null) photoPaths.addAll(draft.photoPaths);
        }
      } catch (_) {}
    }
    all.removeWhere((key, _) => key.startsWith(prefix));
    if (all[_lastUserIdKey] == userId) all.remove(_lastUserIdKey);
    await _writeAll(all);
    await deletePhotos(photoPaths);
  }

  /// 把草稿的照片附件複製到 App 私有目錄。
  ///
  /// 計畫書 5.5 決定離線草稿「僅文字」：照片不會被靜默丟失，但也不假裝已保存。
  /// 這裡把使用者已選的照片複製一份到 App 私有目錄，讓草稿在 App 關閉／重啟後
  /// 仍可看到「有 1 張照片待補上傳」，並在使用者確認送出後再上傳。
  static Future<List<String>> persistPhotos(List<String> sourcePaths) async {
    if (sourcePaths.isEmpty) return const [];
    try {
      final dir = await getApplicationSupportDirectory();
      final target = File('${dir.path}/offline_drafts_photos');
      if (!target.existsSync()) await target.create(recursive: true);
      final saved = <String>[];
      for (final src in sourcePaths) {
        final file = File(src);
        if (!file.existsSync()) continue;
        final dest = File(
          '${target.path}/${DateTime.now().microsecondsSinceEpoch}_${file.uri.pathSegments.last}',
        );
        await file.copy(dest.path);
        saved.add(dest.path);
      }
      return saved;
    } catch (_) {
      return const [];
    }
  }

  /// 刪除草稿的本地照片副本（入帳成功或捨棄後呼叫，避免累積無主檔案）。
  static Future<void> deletePhotos(List<String> paths) async {
    for (final path in paths) {
      try {
        final file = File(path);
        if (file.existsSync()) await file.delete();
      } catch (_) {
        // 刪除失敗不影響主流程。
      }
    }
  }
}

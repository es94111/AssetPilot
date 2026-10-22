import 'dart:convert';
import 'dart:io' show Directory, File, Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

/// App Group 共用儲存：供主 App 與 iOS WidgetKit 擴充讀寫小份摘要資料。
///
/// 主 App 寫入快照（帳本、月份、收支摘要），Widget 擴充以唯讀方式讀取。
/// **不放任何憑證、附件、交易備註或完整明細**，只放顯示所需的最小摘要，
/// 避免 Widget 快照變成新的資料外洩路徑。
class AppGroupStore {
  AppGroupStore._();

  /// 與 iOS 專案 entitlement 的 App Group ID 保持一致。
  static const appGroupId = 'group.com.assetpilot.assetpilot';

  /// 快照檔名。
  static const snapshotFileName = 'widget_snapshot.json';

  /// 快照結構版本；格式變更時遞增，讀取端可辨識並忽略舊格式。
  static const snapshotVersion = 1;

  static File? _overrideFile; // 測試用注入

  /// 覆寫快照存放位置（僅測試使用）。
  @visibleForTesting
  static set overrideFile(File? file) => _overrideFile = file;

  static Future<File> _resolveFile() async {
    if (_overrideFile != null) return _overrideFile!;
    if (Platform.isIOS) {
      final container = await _resolveAppGroupContainer();
      if (container != null) {
        return File('${container.path}/$snapshotFileName');
      }
    }
    // 非 iOS 或無法取得 App Group container：退回 App 私有目錄。
    final dir = await getApplicationSupportDirectory();
    return File('${dir.path}/$snapshotFileName');
  }

  /// 取得 App Group container 目錄。Flutter 套件未直接暴露此 API，
  /// 因此透過 platform channel 交由原生端解析 container URL。
  static Future<Directory?> _resolveAppGroupContainer() async {
    try {
      final path = await _appGroupContainerPath();
      if (path == null || path.isEmpty) return null;
      final dir = Directory(path);
      if (!dir.existsSync()) {
        await dir.create(recursive: true);
      }
      return dir;
    } catch (_) {
      return null;
    }
  }

  static Future<String?> _appGroupContainerPath() async {
    const channel = MethodChannel('assetpilot/app_group');
    try {
      return await channel.invokeMethod<String>('containerPath');
    } catch (_) {
      return null;
    }
  }

  /// 寫入快照。寫入失敗不應中斷主流程（例如 Widget 尚未加入桌面）。
  static Future<bool> writeSnapshot(Map<String, dynamic> snapshot) async {
    try {
      final file = await _resolveFile();
      final payload = <String, dynamic>{
        'version': snapshotVersion,
        ...snapshot,
        'updatedAt': DateTime.now().toUtc().toIso8601String(),
      };
      await file.writeAsString(jsonEncode(payload), flush: true);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// 讀取快照；不存在或格式過舊時回傳 null。
  static Future<Map<String, dynamic>?> readSnapshot() async {
    try {
      final file = await _resolveFile();
      if (!file.existsSync()) return null;
      final raw = await file.readAsString();
      if (raw.trim().isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final map = decoded.cast<String, dynamic>();
      final version = map['version'];
      if (version is! int || version > snapshotVersion) return null;
      return map;
    } catch (_) {
      return null;
    }
  }

  /// 清除快照（登出、帳號切換時呼叫，避免殘留其他帳號的金額）。
  static Future<bool> clearSnapshot() async {
    try {
      final file = await _resolveFile();
      if (file.existsSync()) {
        await file.delete();
      }
      return true;
    } catch (_) {
      return false;
    }
  }
}

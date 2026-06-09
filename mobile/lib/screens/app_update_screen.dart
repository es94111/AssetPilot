import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api_client.dart';
import '../widgets.dart';

const _currentVersion = '1.0.0';
const _currentBuildNumber = 1;

class AppUpdateScreen extends StatefulWidget {
  const AppUpdateScreen({super.key});

  @override
  State<AppUpdateScreen> createState() => _AppUpdateScreenState();
}

class _AppUpdateScreenState extends State<AppUpdateScreen> {
  late Future<_AppVersionInfo> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_AppVersionInfo> _load() async {
    final json = await ApiClient.instance.appVersion();
    return _AppVersionInfo.fromJson(json);
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _download(_AppVersionInfo info) async {
    final uri = Uri.tryParse(info.apkUrl);
    if (uri == null) {
      toast(context, '下載連結格式錯誤');
      return;
    }
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) toast(context, '無法開啟下載連結');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('App 更新')),
      body: AsyncView<_AppVersionInfo>(
        future: _future,
        onRetry: _reload,
        builder: (context, info) {
          final hasUpdate = info.isNewerThan(
            _currentVersion,
            _currentBuildNumber,
          );
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                elevation: 0,
                child: ListTile(
                  leading: Icon(
                    hasUpdate
                        ? Icons.system_update_alt
                        : Icons.verified_outlined,
                    color: hasUpdate ? Colors.orange : Colors.green,
                  ),
                  title: Text(hasUpdate ? '發現新版本' : '目前已是最新版本'),
                  subtitle: Text(
                    '目前版本：$_currentVersion ($_currentBuildNumber)\n'
                    '最新版本：${info.version} (${info.buildNumber})',
                  ),
                ),
              ),
              const SizedBox(height: 12),
              if (info.releasedAt.isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.event_available_outlined),
                  title: const Text('發布時間'),
                  subtitle: Text(info.releasedAt),
                ),
              if (info.apkFile.isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.android_outlined),
                  title: const Text('APK 檔案'),
                  subtitle: Text(info.apkFile),
                ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: hasUpdate && info.apkUrl.isNotEmpty
                    ? () => _download(info)
                    : null,
                icon: const Icon(Icons.download),
                label: const Text('下載更新'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _reload,
                icon: const Icon(Icons.refresh),
                label: const Text('重新檢查'),
              ),
              const SizedBox(height: 16),
              Text(
                '下載 APK 後，請依 Android 系統提示安裝。若系統阻擋，請允許瀏覽器或檔案管理器安裝未知來源 App。',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _AppVersionInfo {
  final String version;
  final String apkUrl;
  final String apkFile;
  final int buildNumber;
  final String releasedAt;

  const _AppVersionInfo({
    required this.version,
    required this.apkUrl,
    required this.apkFile,
    required this.buildNumber,
    required this.releasedAt,
  });

  factory _AppVersionInfo.fromJson(Map<String, dynamic> json) {
    return _AppVersionInfo(
      version: '${json['version'] ?? ''}',
      apkUrl: '${json['apkUrl'] ?? ''}',
      apkFile: '${json['apkFile'] ?? ''}',
      buildNumber: int.tryParse('${json['buildNumber'] ?? 0}') ?? 0,
      releasedAt: '${json['releasedAt'] ?? ''}',
    );
  }

  bool isNewerThan(String currentVersion, int currentBuildNumber) {
    final versionCompare = _compareVersions(version, currentVersion);
    if (versionCompare != 0) return versionCompare > 0;
    return buildNumber > currentBuildNumber;
  }
}

int _compareVersions(String a, String b) {
  final left = a.split('.').map((v) => int.tryParse(v) ?? 0).toList();
  final right = b.split('.').map((v) => int.tryParse(v) ?? 0).toList();
  final len = left.length > right.length ? left.length : right.length;
  for (var i = 0; i < len; i++) {
    final l = i < left.length ? left[i] : 0;
    final r = i < right.length ? right[i] : 0;
    if (l != r) return l.compareTo(r);
  }
  return 0;
}

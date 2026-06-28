import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../api_client.dart';
import '../widgets.dart';
import '../l10n.dart';

/// 版本資訊頁：顯示目前 App 版本、是否有可更新版本，以及各版本的更新內容。
class ChangelogScreen extends StatefulWidget {
  const ChangelogScreen({super.key});

  @override
  State<ChangelogScreen> createState() => _ChangelogScreenState();
}

class _ChangelogScreenState extends State<ChangelogScreen> {
  late Future<_VersionInfo> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_VersionInfo> _load({bool refresh = false}) async {
    final info = await PackageInfo.fromPlatform();
    final data = await ApiClient.instance.changelog(refresh: refresh);
    return _VersionInfo.from(appVersion: info.version, data: data);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load(refresh: true));
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(trKey('shellVersionInfo')),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            tooltip: trKey('mobileLegacyCheckAgain'),
            onPressed: _refresh,
          ),
        ],
      ),
      body: AsyncView<_VersionInfo>(
        future: _future,
        onRetry: () => setState(() => _future = _load()),
        builder: (context, info) => RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _header(context, info),
              SizedBox(height: 16),
              Text(
                info.updateAvailable
                    ? trKey('shellChangelogUpdatableContent')
                    : trKey('shellChangelogRecentContent'),
                style: Theme.of(context).textTheme.titleSmall,
              ),
              SizedBox(height: 8),
              if (info.releasesToShow.isEmpty)
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(trKey('mobileLegacyNoReleaseNotesAvailable')),
                  ),
                )
              else
                for (final r in info.releasesToShow) _releaseCard(context, r),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context, _VersionInfo info) {
    final scheme = Theme.of(context).colorScheme;
    final upToDate = !info.updateAvailable;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(
              upToDate ? Icons.check_circle : Icons.system_update,
              color: upToDate ? scheme.primary : scheme.tertiary,
              size: 36,
            ),
            SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    trKey('mobileDynamicCurrentVersion', {
                      'version': info.appVersion,
                    }),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  SizedBox(height: 4),
                  Text(
                    upToDate
                        ? trKey('shellChangelogUpToDate')
                        : trKey('mobileDynamicVersionAvailable', {
                            'version': info.latestVersion,
                          }),
                    style: TextStyle(
                      color: upToDate ? scheme.primary : scheme.tertiary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _releaseCard(BuildContext context, _Release r) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  'v${r.version}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(width: 8),
                Text(
                  r.date,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).hintColor,
                  ),
                ),
              ],
            ),
            if (r.title.isNotEmpty) ...[
              SizedBox(height: 4),
              Text(
                r.title,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
            ],
            SizedBox(height: 8),
            for (final c in r.changes) _changeRow(context, c),
          ],
        ),
      ),
    );
  }

  Widget _changeRow(BuildContext context, _Change c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _tagChip(context, c.tag),
          SizedBox(width: 8),
          Expanded(child: Text(c.text, style: TextStyle(height: 1.45))),
        ],
      ),
    );
  }

  Widget _tagChip(BuildContext context, String tag) {
    final (label, color) = switch (tag) {
      'new' => (trKey('commonAdd'), Colors.green),
      'improved' => (trKey('mobileLegacyImproved'), Colors.blue),
      'fixed' || 'fix' => (trKey('mobileLegacyFixed'), Colors.orange),
      'removed' => (trKey('featuresTransactionsRemove'), Colors.grey),
      'warning' => (trKey('mobileLegacyNotice'), Colors.red),
      _ => (
        tag.isEmpty ? trKey('mobileLegacyUpdatedd9db02d0') : tag,
        Colors.grey,
      ),
    };
    return Container(
      margin: const EdgeInsets.only(top: 2),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

/// 比較語意化版號（如 4.56.0），回傳 >0 / 0 / <0。
int compareVersions(String a, String b) {
  List<int> parse(String v) =>
      v.split('.').map((n) => int.tryParse(n) ?? 0).toList();
  final pa = parse(a), pb = parse(b);
  final len = pa.length > pb.length ? pa.length : pb.length;
  for (var i = 0; i < len; i++) {
    final diff = (i < pa.length ? pa[i] : 0) - (i < pb.length ? pb[i] : 0);
    if (diff != 0) return diff;
  }
  return 0;
}

class _VersionInfo {
  final String appVersion;
  final String latestVersion;
  final bool updateAvailable;
  final List<_Release> releasesToShow;

  _VersionInfo({
    required this.appVersion,
    required this.latestVersion,
    required this.updateAvailable,
    required this.releasesToShow,
  });

  factory _VersionInfo.from({
    required String appVersion,
    required Map<String, dynamic> data,
  }) {
    final releases =
        (data['releases'] as List? ?? [])
            .whereType<Map>()
            .map((m) => _Release.from(m.cast<String, dynamic>()))
            .toList()
          ..sort((a, b) => compareVersions(b.version, a.version));
    final latest =
        (data['latestVersion'] ?? data['currentVersion'] ?? appVersion)
            .toString();
    final updateAvailable = compareVersions(latest, appVersion) > 0;
    // 有新版時只列比目前 App 版本新的；否則列最近數筆已包含的更新內容。
    final toShow = updateAvailable
        ? releases
              .where((r) => compareVersions(r.version, appVersion) > 0)
              .toList()
        : releases.take(10).toList();
    return _VersionInfo(
      appVersion: appVersion,
      latestVersion: latest,
      updateAvailable: updateAvailable,
      releasesToShow: toShow,
    );
  }
}

class _Release {
  final String version;
  final String date;
  final String title;
  final List<_Change> changes;

  _Release({
    required this.version,
    required this.date,
    required this.title,
    required this.changes,
  });

  factory _Release.from(Map<String, dynamic> m) => _Release(
    version: '${m['version'] ?? ''}',
    date: '${m['date'] ?? ''}',
    title: '${m['title'] ?? ''}',
    changes: (m['changes'] as List? ?? [])
        .whereType<Map>()
        .map((c) => _Change.from(c.cast<String, dynamic>()))
        .toList(),
  );
}

class _Change {
  final String tag;
  final String text;
  _Change({required this.tag, required this.text});

  factory _Change.from(Map<String, dynamic> m) =>
      _Change(tag: '${m['tag'] ?? ''}', text: '${m['text'] ?? ''}');
}

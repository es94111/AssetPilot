import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app.dart';
import '../models.dart';
import '../widgets.dart';

class SettingsScreen extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const SettingsScreen({super.key, required this.onLoggedOut});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late Future<AppUser> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<AppUser> _load() async =>
      AppUser.fromJson(await ApiClient.instance.me());

  Future<void> _editName(AppUser user) async {
    final ctrl = TextEditingController(text: user.displayName);
    final newName = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('修改顯示名稱'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, ctrl.text.trim()),
            child: const Text('儲存'),
          ),
        ],
      ),
    );
    if (newName == null || newName.isEmpty) return;
    try {
      await ApiClient.instance.updateDisplayName(newName);
      if (mounted) {
        toast(context, '已更新');
        setState(() => _future = _load());
      }
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  Future<void> _logout() async {
    await ApiClient.instance.logout();
    if (mounted) widget.onLoggedOut();
  }

  String _themeLabel(ThemeMode m) => switch (m) {
    ThemeMode.light => '淺色',
    ThemeMode.dark => '深色',
    ThemeMode.system => '跟隨系統',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('設定')),
      body: AsyncView<AppUser>(
        future: _future,
        onRetry: () => setState(() => _future = _load()),
        builder: (context, user) => ListView(
          children: [
            ListTile(
              leading: CircleAvatar(
                child: Text(
                  user.displayName.isNotEmpty
                      ? user.displayName.characters.first.toUpperCase()
                      : '?',
                ),
              ),
              title: Text(user.displayName),
              subtitle: Text(user.email),
              trailing: user.isAdmin
                  ? const Chip(
                      label: Text('管理員'),
                      visualDensity: VisualDensity.compact,
                    )
                  : null,
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.badge_outlined),
              title: const Text('顯示名稱'),
              subtitle: Text(user.displayName),
              onTap: () => _editName(user),
            ),
            ValueListenableBuilder<ThemeMode>(
              valueListenable: themeMode,
              builder: (context, mode, _) => ListTile(
                leading: const Icon(Icons.brightness_6_outlined),
                title: const Text('主題'),
                subtitle: Text(_themeLabel(mode)),
                onTap: () async {
                  final picked = await showDialog<ThemeMode>(
                    context: context,
                    builder: (_) => SimpleDialog(
                      title: const Text('選擇主題'),
                      children: [
                        for (final m in ThemeMode.values)
                          ListTile(
                            title: Text(_themeLabel(m)),
                            trailing: mode == m
                                ? const Icon(Icons.check)
                                : null,
                            onTap: () => Navigator.pop(context, m),
                          ),
                      ],
                    ),
                  );
                  if (picked != null) await setThemeMode(picked);
                },
              ),
            ),
            const Divider(),
            ListTile(
              leading: Icon(
                Icons.logout,
                color: Theme.of(context).colorScheme.error,
              ),
              title: Text(
                '登出',
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              onTap: _logout,
            ),
          ],
        ),
      ),
    );
  }
}

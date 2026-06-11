import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app.dart';
import '../models.dart';
import '../widgets.dart';
import 'changelog_screen.dart';

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
    if (mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
      widget.onLoggedOut();
    }
  }

  Future<void> _deleteAccount(AppUser user) async {
    final ctrl = TextEditingController();
    final hasPw = user.hasPassword;
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        String? error;
        bool busy = false;
        return StatefulBuilder(
          builder: (dialogCtx, setLocal) => AlertDialog(
            title: const Text('刪除帳號'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('此操作將永久刪除您的帳號與所有資料（交易、帳戶、股票與設定），且無法復原。'),
                const SizedBox(height: 16),
                TextField(
                  controller: ctrl,
                  autofocus: true,
                  obscureText: hasPw,
                  enabled: !busy,
                  keyboardType: hasPw
                      ? TextInputType.text
                      : TextInputType.emailAddress,
                  decoration: InputDecoration(
                    border: const OutlineInputBorder(),
                    labelText: hasPw ? '請輸入密碼以確認' : '請輸入帳號電子信箱以確認',
                    hintText: hasPw ? null : user.email,
                    errorText: error,
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(dialogCtx, false),
                child: const Text('取消'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(dialogCtx).colorScheme.error,
                ),
                onPressed: busy
                    ? null
                    : () async {
                        final input = ctrl.text.trim();
                        if (hasPw && input.isEmpty) {
                          setLocal(() => error = '請輸入密碼以確認刪除');
                          return;
                        }
                        if (!hasPw &&
                            input.toLowerCase() != user.email.toLowerCase()) {
                          setLocal(() => error = '請輸入正確的帳號電子信箱以確認刪除');
                          return;
                        }
                        setLocal(() {
                          busy = true;
                          error = null;
                        });
                        final nav = Navigator.of(dialogCtx);
                        try {
                          await ApiClient.instance.deleteMyAccount(
                            password: hasPw ? input : null,
                            confirmEmail: hasPw ? null : input,
                          );
                          nav.pop(true);
                        } catch (e) {
                          setLocal(() {
                            busy = false;
                            error = '$e';
                          });
                        }
                      },
                child: busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('永久刪除'),
              ),
            ],
          ),
        );
      },
    );
    if (confirmed == true && mounted) {
      toast(context, '帳號已刪除');
      Navigator.of(context).popUntil((route) => route.isFirst);
      widget.onLoggedOut();
    }
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
              leading: const Icon(Icons.system_update_outlined),
              title: const Text('版本資訊'),
              subtitle: const Text('查看目前版本與更新內容'),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ChangelogScreen()),
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
            const Divider(),
            ListTile(
              leading: Icon(
                Icons.delete_forever_outlined,
                color: Theme.of(context).colorScheme.error,
              ),
              title: Text(
                '刪除帳號',
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              subtitle: const Text('永久刪除帳號與所有資料，無法復原'),
              onTap: () => _deleteAccount(user),
            ),
          ],
        ),
      ),
    );
  }
}

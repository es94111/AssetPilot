import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app.dart';
import '../models.dart';
import '../widgets.dart';
import 'changelog_screen.dart';
import 'report_schedule_screen.dart';
import 'security_screens.dart';

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

  Future<void> _pickLanguage() async {
    const langs = {'zh-TW': '繁體中文', 'en': 'English'};
    final picked = await showDialog<String>(
      context: context,
      builder: (_) => SimpleDialog(
        title: const Text('語言（影響通知與網頁版）'),
        children: [
          for (final e in langs.entries)
            ListTile(
              title: Text(e.value),
              onTap: () => Navigator.pop(context, e.key),
            ),
        ],
      ),
    );
    if (picked == null) return;
    try {
      await ApiClient.instance.setLanguage(picked);
      if (mounted) toast(context, '已更新語言：${langs[picked]}');
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  void _push(Widget page) => Navigator.of(
    context,
  ).push(MaterialPageRoute(builder: (_) => page));

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
            ListTile(
              leading: const Icon(Icons.payments_outlined),
              title: const Text('幣別設定'),
              subtitle: const Text('預設幣別與常用幣別'),
              onTap: () => _push(const CurrencySettingsScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.translate),
              title: const Text('語言'),
              subtitle: const Text('繁體中文 / English'),
              onTap: _pickLanguage,
            ),
            ListTile(
              leading: const Icon(Icons.notifications_outlined),
              title: const Text('報表通知'),
              subtitle: const Text('自訂定期收支報表寄送時間'),
              onTap: () => _push(const ReportScheduleScreen()),
            ),
            const Divider(),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(
                '帳號安全',
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.password_outlined),
              title: Text(user.hasPassword ? '修改密碼' : '設定密碼'),
              onTap: () =>
                  showChangePasswordSheet(context, hasPassword: user.hasPassword),
            ),
            ListTile(
              leading: const Icon(Icons.key_outlined),
              title: const Text('Passkey 管理'),
              onTap: () => _push(const PasskeysScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.link),
              title: const Text('帳號綁定'),
              subtitle: const Text('Google / LINE'),
              onTap: () => _push(const AccountBindingsScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.devices_outlined),
              title: const Text('登入裝置'),
              onTap: () => _push(const SessionsScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.history),
              title: const Text('登入紀錄'),
              onTap: () => _push(const LoginAuditScreen()),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.system_update_outlined),
              title: const Text('版本資訊'),
              subtitle: const Text('查看目前版本與更新內容'),
              onTap: () => _push(const ChangelogScreen()),
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

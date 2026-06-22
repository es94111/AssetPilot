import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app.dart';
import '../models.dart';
import '../widgets.dart';
import 'changelog_screen.dart';
import 'report_schedule_screen.dart';
import 'security_screens.dart';
import '../l10n.dart';

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
        title: Text(tr('修改顯示名稱')),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: InputDecoration(border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(tr('取消')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, ctrl.text.trim()),
            child: Text(tr('儲存')),
          ),
        ],
      ),
    );
    if (newName == null || newName.isEmpty) return;
    try {
      await ApiClient.instance.updateDisplayName(newName);
      if (mounted) {
        toast(context, tr('已更新'));
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
            title: Text(tr('刪除帳號')),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr('此操作將永久刪除您的帳號與所有資料（交易、帳戶、股票與設定），且無法復原。')),
                SizedBox(height: 16),
                TextField(
                  controller: ctrl,
                  autofocus: true,
                  obscureText: hasPw,
                  enabled: !busy,
                  keyboardType: hasPw
                      ? TextInputType.text
                      : TextInputType.emailAddress,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: hasPw ? tr('請輸入密碼以確認') : tr('請輸入帳號電子信箱以確認'),
                    hintText: hasPw ? null : user.email,
                    errorText: error,
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(dialogCtx, false),
                child: Text(tr('取消')),
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
                          setLocal(() => error = tr('請輸入密碼以確認刪除'));
                          return;
                        }
                        if (!hasPw &&
                            input.toLowerCase() != user.email.toLowerCase()) {
                          setLocal(() => error = tr('請輸入正確的帳號電子信箱以確認刪除'));
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
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(tr('永久刪除')),
              ),
            ],
          ),
        );
      },
    );
    if (confirmed == true && mounted) {
      toast(context, tr('帳號已刪除'));
      Navigator.of(context).popUntil((route) => route.isFirst);
      widget.onLoggedOut();
    }
  }

  String _themeLabel(ThemeMode m) => switch (m) {
    ThemeMode.light => tr('淺色'),
    ThemeMode.dark => tr('深色'),
    ThemeMode.system => tr('跟隨系統'),
  };

  Future<void> _pickLanguage() async {
    final langs = {'zh-TW': tr('繁體中文'), 'en': 'English'};
    final picked = await showDialog<String>(
      context: context,
      builder: (_) => SimpleDialog(
        title: Text(tr('語言（APP、通知與網頁版）')),
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
      await setAppLocale(picked);
      if (mounted) toast(context, tr('已更新語言：${langs[picked]}'));
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  void _push(Widget page) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('設定'))),
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
                  ? Chip(
                      label: Text(tr('管理員')),
                      visualDensity: VisualDensity.compact,
                    )
                  : null,
            ),
            Divider(),
            ListTile(
              leading: Icon(Icons.badge_outlined),
              title: Text(tr('顯示名稱')),
              subtitle: Text(user.displayName),
              onTap: () => _editName(user),
            ),
            ValueListenableBuilder<ThemeMode>(
              valueListenable: themeMode,
              builder: (context, mode, _) => ListTile(
                leading: Icon(Icons.brightness_6_outlined),
                title: Text(tr('主題')),
                subtitle: Text(_themeLabel(mode)),
                onTap: () async {
                  final picked = await showDialog<ThemeMode>(
                    context: context,
                    builder: (_) => SimpleDialog(
                      title: Text(tr('選擇主題')),
                      children: [
                        for (final m in ThemeMode.values)
                          ListTile(
                            title: Text(_themeLabel(m)),
                            trailing: mode == m ? Icon(Icons.check) : null,
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
              leading: Icon(Icons.payments_outlined),
              title: Text(tr('幣別設定')),
              subtitle: Text(tr('預設幣別與常用幣別')),
              onTap: () => _push(CurrencySettingsScreen()),
            ),
            ListTile(
              leading: Icon(Icons.translate),
              title: Text(tr('語言')),
              subtitle: Text(tr('繁體中文 / English')),
              onTap: _pickLanguage,
            ),
            ListTile(
              leading: Icon(Icons.notifications_outlined),
              title: Text(tr('報表通知')),
              subtitle: Text(tr('自訂定期收支報表寄送時間')),
              onTap: () => _push(ReportScheduleScreen()),
            ),
            Divider(),
            Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(
                tr('帳號安全'),
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
            ),
            ListTile(
              leading: Icon(Icons.password_outlined),
              title: Text(user.hasPassword ? tr('修改密碼') : tr('設定密碼')),
              onTap: () => showChangePasswordSheet(
                context,
                hasPassword: user.hasPassword,
              ),
            ),
            ListTile(
              leading: Icon(Icons.key_outlined),
              title: Text(tr('Passkey 管理')),
              onTap: () => _push(PasskeysScreen()),
            ),
            ListTile(
              leading: Icon(Icons.link),
              title: Text(tr('帳號綁定')),
              subtitle: Text('Google / LINE'),
              onTap: () => _push(AccountBindingsScreen()),
            ),
            ListTile(
              leading: Icon(Icons.devices_outlined),
              title: Text(tr('登入裝置')),
              onTap: () => _push(SessionsScreen()),
            ),
            ListTile(
              leading: Icon(Icons.history),
              title: Text(tr('登入紀錄')),
              onTap: () => _push(LoginAuditScreen()),
            ),
            Divider(),
            ListTile(
              leading: Icon(Icons.system_update_outlined),
              title: Text(tr('版本資訊')),
              subtitle: Text(tr('查看目前版本與更新內容')),
              onTap: () => _push(ChangelogScreen()),
            ),
            Divider(),
            ListTile(
              leading: Icon(
                Icons.logout,
                color: Theme.of(context).colorScheme.error,
              ),
              title: Text(
                tr('登出'),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              onTap: _logout,
            ),
            Divider(),
            ListTile(
              leading: Icon(
                Icons.delete_forever_outlined,
                color: Theme.of(context).colorScheme.error,
              ),
              title: Text(
                tr('刪除帳號'),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              subtitle: Text(tr('永久刪除帳號與所有資料，無法復原')),
              onTap: () => _deleteAccount(user),
            ),
          ],
        ),
      ),
    );
  }
}

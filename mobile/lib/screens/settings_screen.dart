import 'package:flutter/material.dart';

import '../api_client.dart';
import '../app.dart';
import '../models.dart';
import '../offline/offline_draft_core.dart';
import '../offline/offline_draft_service.dart';
import '../offline/offline_draft_store.dart';
import '../platform/platform_info.dart';
import '../platform/widget_snapshot_service.dart';
import '../widgets.dart';
import 'admin_screen.dart';
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
        title: Text(trKey('settingsAccountEditDisplayName')),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: InputDecoration(border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, ctrl.text.trim()),
            child: Text(trKey('commonSave')),
          ),
        ],
      ),
    );
    if (newName == null || newName.isEmpty) return;
    try {
      await ApiClient.instance.updateDisplayName(newName);
      if (mounted) {
        toast(context, trKey('mobileLegacyUpdated'));
        setState(() => _future = _load());
      }
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  Future<void> _logout() async {
    // 登出前若還有未送出的離線草稿，先明確告知使用者（計畫書 5.5／第 10 節）。
    // 草稿會保留在本機的加密儲存中，以同一帳號登入可再次找回；
    // **不會**自動入帳，也不會在這裡直接丟棄。
    final pending = await OfflineDraftService.instance.list();
    final outstanding = pending.where(isOutstanding).length;
    if (outstanding > 0 && mounted) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(trKey('offlineDraftsLogoutWarningTitle')),
          content: Text(
            trKey('offlineDraftsLogoutWarningHint', {'count': outstanding}),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(trKey('commonCancel')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(trKey('shellLogout')),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }

    await ApiClient.instance.logout();
    if (mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
      widget.onLoggedOut();
    }
  }

  Future<void> _deleteAccount(AppUser user) async {
    final ctrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        String? error;
        bool busy = false;
        return StatefulBuilder(
          builder: (dialogCtx, setLocal) => AlertDialog(
            title: Text(trKey('settingsAccountDeleteTitle')),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  trKey(
                    'mobileLegacyThisPermanentlyDeletesYourAccountAndAllData',
                  ),
                ),
                SizedBox(height: 16),
                TextField(
                  controller: ctrl,
                  autofocus: true,
                  obscureText: false,
                  enabled: !busy,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: trKey(
                      'mobileLegacyEnterTheAccountEmailToConfirm',
                    ),
                    hintText: user.email,
                    errorText: error,
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(dialogCtx, false),
                child: Text(trKey('commonCancel')),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(dialogCtx).colorScheme.error,
                ),
                onPressed: busy
                    ? null
                    : () async {
                        final input = ctrl.text.trim();
                        if (input.toLowerCase() != user.email.toLowerCase()) {
                          setLocal(
                            () => error = trKey(
                              'settingsAccountMessagesDeleteEmailMismatch',
                            ),
                          );
                          return;
                        }
                        setLocal(() {
                          busy = true;
                          error = null;
                        });
                        final nav = Navigator.of(dialogCtx);
                        try {
                          await ApiClient.instance.deleteMyAccount(
                            confirmEmail: input,
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
                    : Text(trKey('mobileLegacyDeletePermanently')),
              ),
            ],
          ),
        );
      },
    );
    if (confirmed == true && mounted) {
      await OfflineDraftStore.clearUser(user.id);
      if (!mounted) return;
      toast(context, trKey('mobileLegacyAccountDeleted'));
      Navigator.of(context).popUntil((route) => route.isFirst);
      widget.onLoggedOut();
    }
  }

  String _themeLabel(ThemeMode m) => switch (m) {
    ThemeMode.light => trKey('mobileLegacyLight'),
    ThemeMode.dark => trKey('mobileLegacyDark'),
    ThemeMode.system => trKey('settingsAccountThemeSystem'),
  };

  Future<void> _pickLanguage() async {
    final picked = await showDialog<String>(
      context: context,
      builder: (_) => SimpleDialog(
        title: Text(trKey('mobileLegacyAppNotificationAndWebLanguage')),
        children: [
          for (final e in appLocaleLabels.entries)
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
      if (mounted) {
        toast(
          context,
          trKey('mobileDynamicLanguageUpdated', {
            'value': appLocaleLabels[picked] ?? picked,
          }),
        );
      }
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  void _push(Widget page) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(trKey('settingsTitle'))),
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
                      label: Text(trKey('navAdmin')),
                      visualDensity: VisualDensity.compact,
                    )
                  : null,
            ),
            if (user.isAdmin) ...[
              ListTile(
                leading: Icon(Icons.admin_panel_settings_outlined),
                title: Text(trKey('navAdmin')),
                subtitle: Text(trKey('adminScreenSubtitle')),
                trailing: Icon(Icons.chevron_right),
                onTap: () => _push(AdminScreen()),
              ),
              Divider(),
            ],
            ListTile(
              leading: Icon(Icons.badge_outlined),
              title: Text(trKey('authDisplayNameLabel')),
              subtitle: Text(user.displayName),
              onTap: () => _editName(user),
            ),
            ValueListenableBuilder<ThemeMode>(
              valueListenable: themeMode,
              builder: (context, mode, _) => ListTile(
                leading: Icon(Icons.brightness_6_outlined),
                title: Text(trKey('mobileLegacyTheme')),
                subtitle: Text(_themeLabel(mode)),
                onTap: () async {
                  final picked = await showDialog<ThemeMode>(
                    context: context,
                    builder: (_) => SimpleDialog(
                      title: Text(trKey('mobileLegacyChooseTheme')),
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
              title: Text(trKey('mobileLegacyCurrencySettings')),
              subtitle: Text(
                trKey('mobileLegacyDefaultAndFrequentlyUsedCurrencies'),
              ),
              onTap: () => _push(CurrencySettingsScreen()),
            ),
            ListTile(
              leading: Icon(Icons.translate),
              title: Text(trKey('commonLanguage')),
              subtitle: Text(trKey('mobileLegacyTraditionalChineseEnglish')),
              onTap: _pickLanguage,
            ),
            ListTile(
              leading: Icon(Icons.notifications_outlined),
              title: Text(trKey('mobileLegacyReportNotifications')),
              subtitle: Text(
                trKey('mobileLegacyCustomizeScheduledCashFlowReports'),
              ),
              onTap: () => _push(ReportScheduleScreen()),
            ),
            if (PlatformInfo.isIOS)
              FutureBuilder<bool>(
                future: WidgetSnapshotService.readHideAmounts(),
                builder: (context, snapshot) {
                  final hide = snapshot.data ?? true;
                  return SwitchListTile(
                    secondary: Icon(Icons.widgets_outlined),
                    title: Text(trKey('settingsWidgetHideAmountsTitle')),
                    subtitle: Text(trKey('settingsWidgetHideAmountsSubtitle')),
                    value: hide,
                    onChanged: (v) async {
                      await WidgetSnapshotService.setHideAmounts(v);
                      if (!context.mounted) return;
                      setState(() {});
                    },
                  );
                },
              ),
            Divider(),
            Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(
                trKey('mobileLegacyAccountSecurity'),
                style: TextStyle(
                  fontSize: 13,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            ListTile(
              leading: Icon(Icons.key_outlined),
              title: Text(trKey('settingsAccountPasskeyTitle')),
              onTap: () => _push(PasskeysScreen()),
            ),
            ListTile(
              leading: Icon(Icons.link),
              title: Text(trKey('mobileLegacyLinkedAccounts')),
              subtitle: Text('Google / LINE'),
              onTap: () => _push(AccountBindingsScreen()),
            ),
            ListTile(
              leading: Icon(Icons.devices_outlined),
              title: Text(trKey('mobileLegacySignedInDevices')),
              onTap: () => _push(SessionsScreen()),
            ),
            ListTile(
              leading: Icon(Icons.history),
              title: Text(trKey('mobileLegacySignInHistory')),
              onTap: () => _push(LoginAuditScreen()),
            ),
            Divider(),
            ListTile(
              leading: Icon(Icons.system_update_outlined),
              title: Text(trKey('shellVersionInfo')),
              subtitle: Text(
                trKey('mobileLegacyViewTheCurrentVersionAndReleaseNotes'),
              ),
              onTap: () => _push(ChangelogScreen()),
            ),
            Divider(),
            ListTile(
              leading: Icon(
                Icons.logout,
                color: Theme.of(context).colorScheme.error,
              ),
              title: Text(
                trKey('shellLogout'),
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
                trKey('settingsAccountDeleteTitle'),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              subtitle: Text(
                trKey('mobileLegacyPermanentlyDeleteYourAccountAndAllData'),
              ),
              onTap: () => _deleteAccount(user),
            ),
          ],
        ),
      ),
    );
  }
}

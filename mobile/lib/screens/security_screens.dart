import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api_client.dart';
import '../models.dart';
import '../widgets.dart';
import '../l10n.dart';

const _kCommonCurrencies = [
  'TWD',
  'USD',
  'JPY',
  'EUR',
  'CNY',
  'HKD',
  'GBP',
  'AUD',
  'CAD',
  'SGD',
  'KRW',
  'THB',
];

String _fmtTs(num ms) {
  if (ms <= 0) return '—';
  return DateFormat(
    'yyyy-MM-dd HH:mm',
  ).format(DateTime.fromMillisecondsSinceEpoch(ms.toInt()));
}

Future<void> _openWeb(BuildContext context, String path) async {
  final url = Uri.parse('${ApiClient.instance.baseUrl}$path');
  final ok = await launchUrl(url, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    toast(context, trKey('mobileLegacyUnableToOpenBrowser'));
  }
}

// ── 幣別設定（預設 + 常用） ───────────────────────────────────

class CurrencySettingsScreen extends StatefulWidget {
  const CurrencySettingsScreen({super.key});

  @override
  State<CurrencySettingsScreen> createState() => _CurrencySettingsScreenState();
}

class _CurrencySettingsScreenState extends State<CurrencySettingsScreen> {
  late Future<void> _future;
  String _default = 'TWD';
  Set<String> _pinned = {'TWD'};
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<void> _load() async {
    final api = ApiClient.instance;
    final def = await api.defaultCurrency();
    final pin = await api.pinnedCurrencies();
    _default = '${def['defaultCurrency'] ?? 'TWD'}';
    final list = (pin['pinnedCurrencies'] as List? ?? ['TWD'])
        .map((e) => '$e')
        .toSet();
    _pinned = list.isEmpty ? {'TWD'} : list;
  }

  List<String> get _options =>
      <String>{..._kCommonCurrencies, _default, ..._pinned}.toList();

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final api = ApiClient.instance;
      await api.setDefaultCurrency(_default);
      final pinned = {'TWD', ..._pinned}.toList();
      await api.setPinnedCurrencies(pinned);
      if (mounted) {
        toast(context, trKey('featuresAccountsMessagesSaved'));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, '$e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(trKey('mobileLegacyCurrencySettings'))),
      body: AsyncView<void>(
        future: _future,
        onRetry: () => setState(() => _future = _load()),
        builder: (context, _) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              trKey('mobileLegacyDefaultCurrency'),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _options.contains(_default) ? _default : 'TWD',
              decoration: InputDecoration(border: OutlineInputBorder()),
              items: [
                for (final c in _options)
                  DropdownMenuItem(value: c, child: Text(c)),
              ],
              onChanged: (v) => setState(() => _default = v ?? 'TWD'),
            ),
            SizedBox(height: 24),
            Text(
              trKey('mobileLegacyFrequentlyUsedCurrencies'),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text(
              trKey(
                'mobileLegacyTwdIsAlwaysIncludedSelectedCurrenciesAppearFirst',
              ),
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                for (final c in <String>{..._kCommonCurrencies, ..._pinned})
                  FilterChip(
                    label: Text(c),
                    selected: c == 'TWD' || _pinned.contains(c),
                    onSelected: c == 'TWD'
                        ? null
                        : (sel) => setState(() {
                            if (sel) {
                              _pinned.add(c);
                            } else {
                              _pinned.remove(c);
                            }
                          }),
                  ),
              ],
            ),
            SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _saving
                  ? SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(trKey('commonSave')),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Passkey 管理 ─────────────────────────────────────────────

class PasskeysScreen extends StatefulWidget {
  const PasskeysScreen({super.key});

  @override
  State<PasskeysScreen> createState() => _PasskeysScreenState();
}

class _PasskeysScreenState extends State<PasskeysScreen> {
  late Future<List<Passkey>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Passkey>> _load() async {
    final list = await ApiClient.instance.passkeys();
    return list
        .map((e) => Passkey.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _rename(Passkey p) async {
    final ctrl = TextEditingController(text: p.deviceName);
    final name = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('mobileLegacyRename')),
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
    if (name == null || name.isEmpty) return;
    try {
      await ApiClient.instance.renamePasskey(p.id, name);
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  Future<void> _delete(Passkey p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('mobileLegacyDeletePasskey')),
        content: Text(
          trKey('mobileDynamicConfirmDeleteNamed', {'name': p.deviceName}),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(trKey('commonDelete')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.deletePasskey(p.id);
      if (mounted) toast(context, trKey('mobileLegacyDeleted'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(trKey('settingsAccountPasskeyTitle'))),
      body: AsyncView<List<Passkey>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) => RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            children: [
              ListTile(
                leading: Icon(Icons.add),
                title: Text(trKey('mobileLegacyAddPasskey')),
                subtitle: Text(
                  trKey(
                    'mobileLegacyCompleteRegistrationInTheBrowserDeviceBiometricsRequired',
                  ),
                ),
                onTap: () => _openWeb(context, '/settings/account'),
              ),
              Divider(),
              if (list.isEmpty)
                Padding(
                  padding: EdgeInsets.all(24),
                  child: EmptyState(
                    icon: Icons.key_outlined,
                    message: trKey('settingsAccountNoPasskeys'),
                  ),
                )
              else
                for (final p in list)
                  ListTile(
                    leading: Icon(Icons.key),
                    title: Text(p.deviceName),
                    subtitle: Text(
                      trKey('mobileDynamicCreatedAt', {
                        'value': _fmtTs(p.createdAt),
                      }),
                    ),
                    trailing: PopupMenuButton<String>(
                      onSelected: (v) =>
                          v == 'rename' ? _rename(p) : _delete(p),
                      itemBuilder: (_) => [
                        PopupMenuItem(
                          value: 'rename',
                          child: Text(trKey('mobileLegacyRename')),
                        ),
                        PopupMenuItem(
                          value: 'delete',
                          child: Text(trKey('commonDelete')),
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── 帳號綁定（Google / LINE） ─────────────────────────────────

class AccountBindingsScreen extends StatefulWidget {
  const AccountBindingsScreen({super.key});

  @override
  State<AccountBindingsScreen> createState() => _AccountBindingsScreenState();
}

class _AccountBindingsScreenState extends State<AccountBindingsScreen> {
  late Future<AppUser> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<AppUser> _load() async =>
      AppUser.fromJson(await ApiClient.instance.me());

  void _reload() => setState(() => _future = _load());

  Future<void> _unlink(String provider) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(
          trKey('mobileDynamicUnlinkProvider', {'provider': provider}),
        ),
        content: Text(
          trKey('mobileDynamicConfirmUnlinkProvider', {'provider': provider}),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(trKey('mobileLegacyUnlink')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      if (provider == 'Google') {
        await ApiClient.instance.unlinkGoogle();
      } else {
        await ApiClient.instance.unlinkLine();
      }
      if (mounted) toast(context, trKey('mobileLegacyUnlinked'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  Widget _tile(String provider, bool linked) => ListTile(
    leading: Icon(
      provider == 'Google' ? Icons.account_circle : Icons.chat_bubble_outline,
    ),
    title: Text(trKey('mobileDynamicProviderBinding', {'provider': provider})),
    subtitle: Text(
      linked ? trKey('mobileLegacyLinked') : trKey('mobileLegacyNotLinked'),
    ),
    trailing: linked
        ? OutlinedButton(
            onPressed: () => _unlink(provider),
            child: Text(trKey('mobileLegacyUnlink')),
          )
        : OutlinedButton(
            onPressed: () => _openWeb(context, '/settings/account'),
            child: Text(trKey('mobileLegacyLink')),
          ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(trKey('mobileLegacyLinkedAccounts'))),
      body: AsyncView<AppUser>(
        future: _future,
        onRetry: _reload,
        builder: (context, user) => ListView(
          children: [
            _tile('Google', user.googleLinked),
            Divider(height: 1),
            _tile('LINE', user.lineLinked),
            Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                trKey(
                  'mobileLegacyLinkingIsCompletedInTheBrowserBeforeUnlinking',
                ),
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── 登入裝置（工作階段） ──────────────────────────────────────

class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key});

  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  late Future<List<LoginSession>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<LoginSession>> _load() async {
    final list = await ApiClient.instance.sessions();
    return list
        .map((e) => LoginSession.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _revoke(LoginSession s) async {
    try {
      await ApiClient.instance.revokeSession(s.id);
      if (mounted) {
        toast(context, trKey('settingsAccountMessagesSessionLoggedOut'));
      }
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(trKey('mobileLegacySignedInDevices'))),
      body: AsyncView<List<LoginSession>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) {
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.devices_outlined,
              message: trKey('settingsAccountNoSessions'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              itemCount: list.length,
              separatorBuilder: (_, _) => Divider(height: 1),
              itemBuilder: (context, i) {
                final s = list[i];
                return ListTile(
                  leading: Icon(Icons.devices),
                  title: Text(s.deviceName),
                  subtitle: Text(
                    '${s.ip.isEmpty ? '—' : s.ip}・${_fmtTs(s.loginAt)}',
                  ),
                  trailing: s.current
                      ? Chip(
                          label: Text(trKey('mobileLegacyCurrentDevice')),
                          visualDensity: VisualDensity.compact,
                        )
                      : TextButton(
                          onPressed: () => _revoke(s),
                          child: Text(trKey('shellLogout')),
                        ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

// ── 登入紀錄（稽核） ──────────────────────────────────────────

class LoginAuditScreen extends StatefulWidget {
  const LoginAuditScreen({super.key});

  @override
  State<LoginAuditScreen> createState() => _LoginAuditScreenState();
}

class _LoginAuditScreenState extends State<LoginAuditScreen> {
  late Future<List<LoginAuditLog>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<LoginAuditLog>> _load() async {
    final list = await ApiClient.instance.loginAudit();
    return list
        .map((e) => LoginAuditLog.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  void _reload() => setState(() => _future = _load());

  String _method(String m) => switch (m) {
    'google' => 'Google',
    'line' => 'LINE',
    'passkey' => 'Passkey',
    _ => '—',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(trKey('mobileLegacySignInHistory'))),
      body: AsyncView<List<LoginAuditLog>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) {
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.history,
              message: trKey('mobileLegacyNoSignInHistory'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              itemCount: list.length,
              separatorBuilder: (_, _) => Divider(height: 1),
              itemBuilder: (context, i) {
                final l = list[i];
                return ListTile(
                  isThreeLine: l.device.isNotEmpty,
                  leading: Icon(
                    l.isAdminLogin ? Icons.shield_outlined : Icons.login,
                  ),
                  title: Text(_fmtTs(l.loginAt)),
                  subtitle: Text(
                    '${_method(l.loginMethod)}・${l.ipAddress}'
                    '${l.country.isNotEmpty && l.country != '-' ? '・${l.country}' : ''}'
                    '${l.device.isNotEmpty ? '\n${l.device}' : ''}',
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

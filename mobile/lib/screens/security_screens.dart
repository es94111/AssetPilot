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
  if (!ok && context.mounted) toast(context, tr('無法開啟瀏覽器'));
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
        toast(context, tr('已儲存'));
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
      appBar: AppBar(title: Text(tr('幣別設定'))),
      body: AsyncView<void>(
        future: _future,
        onRetry: () => setState(() => _future = _load()),
        builder: (context, _) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(tr('預設幣別'), style: Theme.of(context).textTheme.titleMedium),
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
            Text(tr('常用幣別'), style: Theme.of(context).textTheme.titleMedium),
            Text(
              tr('TWD 一律包含。勾選的幣別會出現在交易/固定收支的幣別清單前段。'),
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
                  : Text(tr('儲存')),
            ),
          ],
        ),
      ),
    );
  }
}

// ── 修改密碼 ─────────────────────────────────────────────────

Future<void> showChangePasswordSheet(
  BuildContext context, {
  required bool hasPassword,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _ChangePasswordSheet(hasPassword: hasPassword),
  );
}

class _ChangePasswordSheet extends StatefulWidget {
  final bool hasPassword;
  const _ChangePasswordSheet({required this.hasPassword});

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ApiClient.instance.changePassword(
        widget.hasPassword ? _current.text : null,
        _next.text,
      );
      if (mounted) {
        toast(context, tr('密碼已更新'));
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
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.hasPassword ? tr('修改密碼') : tr('設定密碼'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            SizedBox(height: 16),
            if (widget.hasPassword) ...[
              TextFormField(
                controller: _current,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: tr('目前密碼'),
                  border: OutlineInputBorder(),
                ),
                validator: (v) =>
                    (v == null || v.isEmpty) ? tr('請輸入目前密碼') : null,
              ),
              SizedBox(height: 12),
            ],
            TextFormField(
              controller: _next,
              obscureText: true,
              decoration: InputDecoration(
                labelText: tr('新密碼'),
                helperText: tr('至少 8 字元，含大小寫、數字與特殊符號'),
                border: OutlineInputBorder(),
              ),
              validator: (v) {
                final s = v ?? '';
                if (s.length < 8) return tr('至少 8 字元');
                final ok =
                    RegExp(r'[A-Z]').hasMatch(s) &&
                    RegExp(r'[a-z]').hasMatch(s) &&
                    RegExp(r'\d').hasMatch(s) &&
                    RegExp(r'[^A-Za-z0-9]').hasMatch(s);
                if (!ok) return tr('需含大小寫、數字與特殊符號');
                return null;
              },
            ),
            SizedBox(height: 8),
            Text(
              tr('變更後其他裝置將被登出。'),
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            SizedBox(height: 16),
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
                  : Text(tr('儲存')),
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
        title: Text(tr('重新命名')),
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
        title: Text(tr('刪除 Passkey')),
        content: Text(
          trPair('確定刪除「${p.deviceName}」？', 'Delete “${p.deviceName}”?'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(tr('取消')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(tr('刪除')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.deletePasskey(p.id);
      if (mounted) toast(context, tr('已刪除'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('Passkey 管理'))),
      body: AsyncView<List<Passkey>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) => RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            children: [
              ListTile(
                leading: Icon(Icons.add),
                title: Text(tr('新增 Passkey')),
                subtitle: Text(tr('於瀏覽器完成註冊（需裝置生物辨識）')),
                onTap: () => _openWeb(context, '/settings/account'),
              ),
              Divider(),
              if (list.isEmpty)
                Padding(
                  padding: EdgeInsets.all(24),
                  child: EmptyState(
                    icon: Icons.key_outlined,
                    message: tr('尚未註冊任何 Passkey'),
                  ),
                )
              else
                for (final p in list)
                  ListTile(
                    leading: Icon(Icons.key),
                    title: Text(p.deviceName),
                    subtitle: Text(tr('建立於 ${_fmtTs(p.createdAt)}')),
                    trailing: PopupMenuButton<String>(
                      onSelected: (v) =>
                          v == 'rename' ? _rename(p) : _delete(p),
                      itemBuilder: (_) => [
                        PopupMenuItem(value: 'rename', child: Text(tr('重新命名'))),
                        PopupMenuItem(value: 'delete', child: Text(tr('刪除'))),
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
        title: Text(trPair('解除 $provider 綁定', 'Unlink $provider')),
        content: Text(trPair('確定解除與 $provider 的綁定？', 'Unlink $provider?')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(tr('取消')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(tr('解除')),
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
      if (mounted) toast(context, tr('已解除綁定'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  Widget _tile(String provider, bool linked) => ListTile(
    leading: Icon(
      provider == 'Google' ? Icons.account_circle : Icons.chat_bubble_outline,
    ),
    title: Text(trPair('$provider 綁定', '$provider connection')),
    subtitle: Text(linked ? tr('已綁定') : tr('未綁定')),
    trailing: linked
        ? OutlinedButton(
            onPressed: () => _unlink(provider),
            child: Text(tr('解除')),
          )
        : OutlinedButton(
            onPressed: () => _openWeb(context, '/settings/account'),
            child: Text(tr('綁定')),
          ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('帳號綁定'))),
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
                tr('綁定需於瀏覽器完成授權；解除綁定前請確認仍可用其他方式登入。'),
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
      if (mounted) toast(context, tr('已登出該裝置'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('登入裝置'))),
      body: AsyncView<List<LoginSession>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) {
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.devices_outlined,
              message: tr('尚無登入裝置紀錄'),
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
                          label: Text(tr('目前裝置')),
                          visualDensity: VisualDensity.compact,
                        )
                      : TextButton(
                          onPressed: () => _revoke(s),
                          child: Text(tr('登出')),
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
    _ => tr('密碼'),
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('登入紀錄'))),
      body: AsyncView<List<LoginAuditLog>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) {
          if (list.isEmpty) {
            return EmptyState(icon: Icons.history, message: tr('尚無登入紀錄'));
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

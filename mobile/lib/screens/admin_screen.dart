import 'package:flutter/material.dart';

import '../api_client.dart';
import '../widgets.dart';
import '../l10n.dart';

/// 管理員設定：系統設定、使用者管理、登入稽核。僅管理員可進入。
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(trKey('navAdmin')),
        bottom: TabBar(
          controller: _tab,
          isScrollable: true,
          tabs: [
            Tab(text: trKey('adminSystemSettingsTitle')),
            Tab(text: trKey('adminUsersTitle')),
            Tab(text: trKey('adminLoginAuditTitle')),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: const [
          _SystemSettingsTab(),
          _UsersTab(),
          _LoginAuditTab(),
        ],
      ),
    );
  }
}

// ── 系統設定 ──────────────────────────────────────────────────

class _SystemSettingsTab extends StatefulWidget {
  const _SystemSettingsTab();
  @override
  State<_SystemSettingsTab> createState() => _SystemSettingsTabState();
}

class _SystemSettingsTabState extends State<_SystemSettingsTab> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() =>
      ApiClient.instance.adminSystemSettings();

  void _reload() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      future: _future,
      onRetry: _reload,
      builder: (context, settings) => _SystemSettingsForm(
        initial: settings,
        onSaved: _reload,
      ),
    );
  }
}

class _SystemSettingsForm extends StatefulWidget {
  final Map<String, dynamic> initial;
  final VoidCallback onSaved;
  const _SystemSettingsForm({required this.initial, required this.onSaved});

  @override
  State<_SystemSettingsForm> createState() => _SystemSettingsFormState();
}

class _SystemSettingsFormState extends State<_SystemSettingsForm> {
  late bool _publicRegistration = _b(widget.initial['publicRegistration']);
  late bool _lineLoginEnabled = _b(widget.initial['lineLoginEnabled']);
  late final _allowedEmails = _ctrl(
    (widget.initial['allowedRegistrationEmails'] as List? ?? [])
        .map((e) => '$e')
        .join('\n'),
  );
  late final _ipAllowlist = _ctrl(
    (widget.initial['adminIpAllowlist'] as List? ?? [])
        .map((e) => '$e')
        .join('\n'),
  );
  late String _routeAuditMode =
      '${widget.initial['routeAuditMode'] ?? 'security'}';
  late String _photoStorage =
      '${widget.initial['transactionPhotoStorage'] ?? ''}';
  late final _photoMaxMb = _ctrl(
    _num(widget.initial['transactionPhotoMaxBytes']) > 0
        ? (_num(widget.initial['transactionPhotoMaxBytes']) / 1024 / 1024)
            .round()
            .toString()
        : '',
  );
  late bool _stockAutoUpdate = _b(widget.initial['stockAutoUpdateEnabled']);
  late final _stockInterval = _ctrl(
    '${_num(widget.initial['stockAutoUpdateIntervalMin']) > 0 ? _num(widget.initial['stockAutoUpdateIntervalMin']).round() : 10}',
  );
  bool _saving = false;
  bool _busy = false;
  String? _serverTimeText;

  static bool _b(dynamic v) => v == true;
  static num _num(dynamic v) => v is num ? v : 0;
  static TextEditingController _ctrl(String text) =>
      TextEditingController(text: text);

  @override
  void didUpdateWidget(_SystemSettingsForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    // 儲存後 onSaved 觸發重新載入，initial 更新時同步刷新欄位值。
    if (oldWidget.initial != widget.initial) {
      _publicRegistration = _b(widget.initial['publicRegistration']);
      _lineLoginEnabled = _b(widget.initial['lineLoginEnabled']);
      _allowedEmails.text = (widget.initial['allowedRegistrationEmails'] as List? ?? [])
          .map((e) => '$e')
          .join('\n');
      _ipAllowlist.text = (widget.initial['adminIpAllowlist'] as List? ?? [])
          .map((e) => '$e')
          .join('\n');
      _routeAuditMode = '${widget.initial['routeAuditMode'] ?? 'security'}';
      _photoStorage = '${widget.initial['transactionPhotoStorage'] ?? ''}';
      _photoMaxMb.text = _num(widget.initial['transactionPhotoMaxBytes']) > 0
          ? (_num(widget.initial['transactionPhotoMaxBytes']) / 1024 / 1024)
              .round()
              .toString()
          : '';
      _stockAutoUpdate = _b(widget.initial['stockAutoUpdateEnabled']);
      _stockInterval.text =
          '${_num(widget.initial['stockAutoUpdateIntervalMin']) > 0 ? _num(widget.initial['stockAutoUpdateIntervalMin']).round() : 10}';
    }
  }

  @override
  void dispose() {
    _allowedEmails.dispose();
    _ipAllowlist.dispose();
    _photoMaxMb.dispose();
    _stockInterval.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'publicRegistration': _publicRegistration,
        'lineLoginEnabled': _lineLoginEnabled,
        'allowedRegistrationEmails': _lines(_allowedEmails.text),
        'adminIpAllowlist': _lines(_ipAllowlist.text),
        'routeAuditMode': _routeAuditMode,
        'transactionPhotoStorage': _photoStorage,
        'transactionPhotoMaxBytes': _num(_photoMaxMb.text) > 0
            ? (_num(_photoMaxMb.text) * 1024 * 1024).round()
            : 0,
        'stockAutoUpdateEnabled': _stockAutoUpdate,
        'stockAutoUpdateIntervalMin': _num(_stockInterval.text) > 0
            ? _num(_stockInterval.text).round()
            : 10,
      };
      await ApiClient.instance.updateAdminSystemSettings(body);
      if (mounted) {
        // 先還原按鈕狀態再重新載入；onSaved 觸發 reload 後 State 會被重用，
        // 若沒重設 _saving，按鈕會永遠卡在 loading。
        setState(() => _saving = false);
        toast(context, trKey('adminSaved'));
        widget.onSaved();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, '$e', isError: true);
      }
    }
  }

  static List<String> _lines(String text) => text
      .split('\n')
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty)
      .toList();

  Future<void> _runStockUpdate() async {
    setState(() => _busy = true);
    try {
      final r = await ApiClient.instance.adminRunStockPriceUpdate();
      if (mounted) {
        toast(
          context,
          trKey('adminStockUpdateResult', {
            'updated': '${r['updated'] ?? 0}',
          }),
        );
      }
    } catch (e) {
      if (mounted) toast(context, '$e', isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _compressPhotos() async {
    setState(() => _busy = true);
    try {
      final r = await ApiClient.instance.adminCompressTransactionPhotos();
      if (mounted) {
        toast(
          context,
          trKey('adminPhotoCompressResult', {
            'recompressed': '${r['recompressed'] ?? 0}',
          }),
        );
      }
    } catch (e) {
      if (mounted) toast(context, '$e', isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _encryptPhotos() async {
    setState(() => _busy = true);
    try {
      final r = await ApiClient.instance.adminEncryptTransactionPhotos();
      if (mounted) {
        toast(
          context,
          trKey('adminPhotoEncryptResult', {
            'encrypted': '${r['encrypted'] ?? 0}',
          }),
        );
      }
    } catch (e) {
      if (mounted) toast(context, '$e', isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _showServerTime() async {
    setState(() => _busy = true);
    try {
      final r = await ApiClient.instance.adminServerTime();
      if (mounted) {
        setState(() {
          _serverTimeText = '${r['serverTimeIso'] ?? r['serverTime'] ?? ''}';
        });
      }
    } catch (e) {
      if (mounted) toast(context, '$e', isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _ntpSync() async {
    setState(() => _busy = true);
    try {
      final r = await ApiClient.instance.adminNtpSync();
      if (mounted) {
        toast(
          context,
          trKey('adminNtpSynced', {
            'offset': '${r['offsetMs'] ?? 0}',
          }),
        );
      }
    } catch (e) {
      if (mounted) toast(context, '$e', isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SwitchListTile(
          title: Text(trKey('adminPublicRegistration')),
          value: _publicRegistration,
          onChanged: (v) => setState(() => _publicRegistration = v),
        ),
        SwitchListTile(
          title: Text(trKey('adminLineLoginEnabled')),
          value: _lineLoginEnabled,
          onChanged: (v) => setState(() => _lineLoginEnabled = v),
        ),
        TextFormField(
          controller: _allowedEmails,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: trKey('adminAllowedRegistrationEmails'),
            border: OutlineInputBorder(),
          ),
        ),
        SizedBox(height: 12),
        TextFormField(
          controller: _ipAllowlist,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: trKey('adminAdminIpAllowlist'),
            border: OutlineInputBorder(),
          ),
        ),
        SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _routeAuditMode,
          decoration: InputDecoration(
            labelText: trKey('adminRouteAuditMode'),
            border: OutlineInputBorder(),
          ),
          items: [
            for (final e in {
              'security': trKey('adminRouteAuditSecurity'),
              'extended': trKey('adminRouteAuditExtended'),
              'minimal': trKey('adminRouteAuditMinimal'),
            }.entries)
              DropdownMenuItem(value: e.key, child: Text(e.value)),
          ],
          onChanged: (v) => setState(() => _routeAuditMode = v ?? 'security'),
        ),
        SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _photoStorage,
          decoration: InputDecoration(
            labelText: trKey('adminTransactionPhotoStorage'),
            border: OutlineInputBorder(),
          ),
          items: [
            DropdownMenuItem(value: '', child: Text(trKey('adminPhotoStorageDefault'))),
            DropdownMenuItem(value: 'local', child: Text(trKey('adminPhotoStorageLocal'))),
            DropdownMenuItem(value: 's3', child: Text(trKey('adminPhotoStorageS3'))),
          ],
          onChanged: (v) => setState(() => _photoStorage = v ?? ''),
        ),
        SizedBox(height: 12),
        TextFormField(
          controller: _photoMaxMb,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: trKey('adminTransactionPhotoMaxMb'),
            border: OutlineInputBorder(),
          ),
        ),
        SizedBox(height: 12),
        SwitchListTile(
          title: Text(trKey('adminStockAutoUpdateEnabled')),
          value: _stockAutoUpdate,
          onChanged: (v) => setState(() => _stockAutoUpdate = v),
        ),
        TextFormField(
          controller: _stockInterval,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: trKey('adminStockAutoUpdateIntervalMin'),
            border: OutlineInputBorder(),
          ),
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
              : Text(trKey('commonSave')),
        ),
        Divider(height: 32),
        Text(
          trKey('adminOperationsTitle'),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _busy ? null : _runStockUpdate,
          icon: Icon(Icons.trending_up),
          label: Text(trKey('adminRunStockUpdate')),
        ),
        SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _busy ? null : _compressPhotos,
          icon: Icon(Icons.compress),
          label: Text(trKey('adminCompressPhotos')),
        ),
        SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _busy ? null : _encryptPhotos,
          icon: Icon(Icons.lock_outline),
          label: Text(trKey('adminEncryptPhotos')),
        ),
        SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _busy ? null : _showServerTime,
          icon: Icon(Icons.schedule),
          label: Text(trKey('adminServerTime')),
        ),
        if (_serverTimeText != null) ...[
          SizedBox(height: 8),
          Text(_serverTimeText!, textAlign: TextAlign.center),
        ],
        SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _busy ? null : _ntpSync,
          icon: Icon(Icons.sync),
          label: Text(trKey('adminNtpSync')),
        ),
      ],
    );
  }
}

// ── 使用者管理 ────────────────────────────────────────────────

class _UsersTab extends StatefulWidget {
  const _UsersTab();
  @override
  State<_UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends State<_UsersTab> {
  late Future<List<dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<dynamic>> _load() => ApiClient.instance.adminUsers();

  void _reload() => setState(() => _future = _load());

  Future<void> _toggleAdmin(Map<String, dynamic> user) async {
    final next = !(user['isAdmin'] == true);
    try {
      await ApiClient.instance.adminUpdateUserRole('${user['id']}', {
        'isAdmin': next,
      });
      if (mounted) {
        toast(context, trKey('adminRoleChanged'));
        _reload();
      }
    } catch (e) {
      if (mounted) toast(context, '$e', isError: true);
    }
  }

  Future<void> _deleteUser(Map<String, dynamic> user) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('adminDeleteUser')),
        content: Text(
          trKey('adminDeleteUserConfirm', {
            'email': '${user['email'] ?? ''}',
          }),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: Text(trKey('commonDelete')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.adminDeleteUser('${user['id']}');
      if (mounted) {
        toast(context, trKey('adminUserDeleted'));
        _reload();
      }
    } catch (e) {
      if (mounted) toast(context, '$e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AsyncView<List<dynamic>>(
        future: _future,
        onRetry: _reload,
        builder: (context, users) {
          if (users.isEmpty) {
            return EmptyState(
              icon: Icons.people_outline,
              message: trKey('adminNoUsers'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.only(bottom: 88),
              itemCount: users.length,
              separatorBuilder: (_, _) => Divider(height: 1),
              itemBuilder: (context, i) {
                final u = (users[i] as Map).cast<String, dynamic>();
                final isAdmin = u['isAdmin'] == true;
                return ListTile(
                  title: Text('${u['displayName'] ?? ''}'),
                  subtitle: Text('${u['email'] ?? ''}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isAdmin)
                        Chip(
                          label: Text(trKey('navAdmin')),
                          visualDensity: VisualDensity.compact,
                        ),
                      IconButton(
                        tooltip: isAdmin
                            ? trKey('adminRemoveAdmin')
                            : trKey('adminMakeAdmin'),
                        icon: Icon(
                          isAdmin
                              ? Icons.admin_panel_settings
                              : Icons.person_outline,
                        ),
                        onPressed: () => _toggleAdmin(u),
                      ),
                      IconButton(
                        tooltip: trKey('adminDeleteUser'),
                        icon: Icon(Icons.delete_outline),
                        onPressed: () => _deleteUser(u),
                      ),
                    ],
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

// ── 登入稽核 ──────────────────────────────────────────────────

class _LoginAuditTab extends StatefulWidget {
  const _LoginAuditTab();
  @override
  State<_LoginAuditTab> createState() => _LoginAuditTabState();
}

class _LoginAuditTabState extends State<_LoginAuditTab> {
  late Future<List<dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<dynamic>> _load() => ApiClient.instance.adminLoginAudit();

  void _reload() => setState(() => _future = _load());

  String _methodLabel(String method) => switch (method) {
    'google' => 'Google',
    'line' => 'LINE',
    'passkey' => trKey('authPasskeyButton'),
    _ => '—',
  };

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<dynamic>>(
      future: _future,
      onRetry: _reload,
      builder: (context, logs) {
        if (logs.isEmpty) {
          return EmptyState(
            icon: Icons.history,
            message: trKey('adminNoLoginAudit'),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView.separated(
            itemCount: logs.length,
            separatorBuilder: (_, _) => Divider(height: 1),
            itemBuilder: (context, i) {
              final l = (logs[i] as Map).cast<String, dynamic>();
              final success = l['isSuccess'] == true;
              final ts = _num(l['loginAt']);
              final time = ts > 0
                  ? DateTime.fromMillisecondsSinceEpoch(ts.toInt())
                      .toLocal()
                      .toString()
                      .substring(0, 16)
                  : '—';
              return ListTile(
                dense: true,
                title: Text('${l['email'] ?? ''}'),
                subtitle: Text(
                  '$time · ${l['ipAddress'] ?? '—'} · ${_methodLabel('${l['loginMethod'] ?? ''}')}',
                ),
                trailing: Text(
                  success
                      ? trKey('adminLoginSuccess')
                      : trKey('adminLoginFailed'),
                  style: TextStyle(
                    color: success ? Colors.green.shade700 : Colors.red.shade700,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  static num _num(dynamic v) => v is num ? v : 0;
}

import 'package:flutter/material.dart';

import '../api_client.dart';
import '../l10n.dart';
import '../widgets.dart';

/// 共享帳本的用戶端模型（issue #281）。對應 `GET /api/ledgers` 的單一項目。
class LedgerOption {
  final String id;
  final String name;
  final bool isShared;
  final bool isPersonal;
  final String role; // owner / editor / viewer
  final int memberCount;

  const LedgerOption({
    required this.id,
    required this.name,
    required this.isShared,
    required this.isPersonal,
    required this.role,
    required this.memberCount,
  });

  factory LedgerOption.fromJson(Map<String, dynamic> j) => LedgerOption(
    id: '${j['id'] ?? ''}',
    name: '${j['name'] ?? ''}',
    isShared: j['isShared'] == true,
    isPersonal: j['isPersonal'] == true,
    role: '${j['role'] ?? 'editor'}',
    memberCount: (j['memberCount'] as num?)?.toInt() ?? 0,
  );

  /// 個人帳本顯示統一標籤，不露出內部 `personal:<userId>` 識別碼。
  String get displayName => isShared
      ? name
      : (name.isEmpty ? trKey('ledgerPersonal') : name);

  /// viewer 只能讀取；寫入入口一律隱藏（伺服器端同樣會拒絕）。
  bool get readOnly => role == 'viewer';

  String get roleLabel => switch (role) {
    'owner' => trKey('ledgerOwner'),
    'viewer' => trKey('ledgerViewer'),
    _ => trKey('ledgerEditor'),
  };
}

/// 帳本切換／受邀接受／角色顯示與唯讀控制。
///
/// 切換帳本後一律重新載入畫面，且不會把前一個帳本的快取資料留在畫面上——
/// 帳本範圍由 ApiClient 的 `x-ledger-id` 決定（見 lib/api_client.dart）。
class LedgerScreen extends StatefulWidget {
  final String? invitationToken;
  const LedgerScreen({super.key, this.invitationToken});

  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> {
  late Future<List<LedgerOption>> _future;
  bool _accepting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
    if ((widget.invitationToken ?? '').isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _acceptInvitation());
    }
  }

  Future<List<LedgerOption>> _load() async {
    final rows = await ApiClient.instance.ledgers();
    final ledgers = rows
        .map((e) => LedgerOption.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    // 選取的帳本若已失效（離開／被移除／已刪除），安全地退回個人帳本，
    // 避免後續請求持續帶著已無權限的帳本 id。
    final active = ApiClient.instance.activeLedgerId;
    if (active.isNotEmpty && !ledgers.any((l) => l.id == active)) {
      await ApiClient.instance.setActiveLedgerId('');
    }
    return ledgers;
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _acceptInvitation() async {
    final token = widget.invitationToken ?? '';
    if (token.isEmpty || _accepting) return;
    setState(() => _accepting = true);
    try {
      final result = await ApiClient.instance.acceptLedgerInvitation(token);
      final ledgerId = '${result['ledgerId'] ?? ''}';
      if (ledgerId.isNotEmpty) {
        await ApiClient.instance.setActiveLedgerId(ledgerId);
      }
      if (mounted) toast(context, trKey('ledgerInviteAccepted'), isSuccess: true);
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e', isError: true);
    } finally {
      if (mounted) setState(() => _accepting = false);
    }
  }

  Future<void> _select(LedgerOption ledger) async {
    if (ledger.id == ApiClient.instance.activeLedgerId) return;
    await ApiClient.instance.setActiveLedgerId(ledger.id);
    if (!mounted) return;
    if (ledger.readOnly) {
      toast(context, trKey('ledgerReadOnlyNotice'));
    } else {
      toast(context, trKey('ledgerSwitchHint'));
    }
    _reload();
  }

  Future<void> _createLedger() async {
    final ctrl = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('ledgerCreate')),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: InputDecoration(
            border: const OutlineInputBorder(),
            labelText: trKey('ledgerCreateName'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, ctrl.text.trim()),
            child: Text(trKey('ledgerCreateButton')),
          ),
        ],
      ),
    );
    if (name == null || name.isEmpty) return;
    try {
      final created = await ApiClient.instance.createLedger(name);
      final ledgerId = '${created['id'] ?? ''}';
      if (ledgerId.isNotEmpty) {
        await ApiClient.instance.setActiveLedgerId(ledgerId);
      }
      if (mounted) toast(context, trKey('ledgerCreated'), isSuccess: true);
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(trKey('ledgerSwitchTitle')),
        actions: [
          IconButton(
            onPressed: _createLedger,
            icon: const Icon(Icons.add),
            tooltip: trKey('ledgerCreate'),
          ),
        ],
      ),
      body: AsyncView<List<LedgerOption>>(
        future: _future,
        onRetry: _reload,
        builder: (context, ledgers) {
          if (ledgers.isEmpty) {
            return EmptyState(
              icon: Icons.menu_book_outlined,
              message: trKey('ledgerNoLedger'),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: ledgers.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final ledger = ledgers[index];
              final selected = ledger.id == ApiClient.instance.activeLedgerId;
              return LedgerCard(
                child: ListTile(
                  selected: selected,
                  onTap: () => _select(ledger),
                  leading: Icon(
                    selected ? Icons.check_circle : Icons.menu_book_outlined,
                    color: selected ? Theme.of(context).colorScheme.primary : null,
                  ),
                  title: Text(ledger.displayName),
                  subtitle: Text(
                    ledger.readOnly
                        ? '${ledger.roleLabel}・${trKey('ledgerReadOnlyNotice')}'
                        : ledger.roleLabel,
                  ),
                  trailing: ledger.isShared
                      ? Text(
                          ledger.memberCount.toString(),
                          semanticsLabel: trKey('ledgerMembers'),
                        )
                      : null,
                ),
              );
            },
          );
        },
      ),
    );
  }
}

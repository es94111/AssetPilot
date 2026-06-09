import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api_client.dart';
import '../models.dart';

class DashboardScreen extends StatefulWidget {
  /// 登出後呼叫，由 AuthGate 切回登入頁。
  final VoidCallback onLoggedOut;
  const DashboardScreen({super.key, required this.onLoggedOut});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<_DashboardData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_DashboardData> _load() async {
    final api = ApiClient.instance;
    final userJson = await api.me();
    final accountsJson = await api.accounts();
    final accounts = accountsJson
        .map((e) => Account.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    return _DashboardData(AppUser.fromJson(userJson), accounts);
  }

  Future<void> _refresh() async {
    final data = await _load();
    if (mounted) setState(() => _future = Future.value(data));
  }

  Future<void> _logout() async {
    await ApiClient.instance.logout();
    if (mounted) widget.onLoggedOut();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AssetPilot'),
        actions: [
          IconButton(
            tooltip: '登出',
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: FutureBuilder<_DashboardData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return _ErrorView(
              message: snap.error.toString(),
              onRetry: _refresh,
              onLogout: _logout,
            );
          }
          final data = snap.data!;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _GreetingHeader(user: data.user),
                const SizedBox(height: 16),
                _TotalAssetCard(accounts: data.accounts),
                const SizedBox(height: 24),
                Text('帳戶',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                if (data.accounts.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(child: Text('尚無帳戶')),
                  )
                else
                  ...data.accounts.map((a) => _AccountTile(account: a)),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _DashboardData {
  final AppUser user;
  final List<Account> accounts;
  _DashboardData(this.user, this.accounts);
}

class _GreetingHeader extends StatelessWidget {
  final AppUser user;
  const _GreetingHeader({required this.user});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        CircleAvatar(
          radius: 24,
          backgroundColor: theme.colorScheme.primaryContainer,
          child: Text(
            user.displayName.isNotEmpty
                ? user.displayName.characters.first.toUpperCase()
                : '?',
            style: TextStyle(color: theme.colorScheme.onPrimaryContainer),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('歡迎回來',
                  style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant)),
              Text(user.displayName,
                  style: theme.textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
        if (user.isAdmin)
          Chip(
            label: const Text('管理員'),
            visualDensity: VisualDensity.compact,
            backgroundColor: theme.colorScheme.tertiaryContainer,
          ),
      ],
    );
  }
}

class _TotalAssetCard extends StatelessWidget {
  final List<Account> accounts;
  const _TotalAssetCard({required this.accounts});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = accounts
        .where((a) => !a.excludeFromTotal)
        .fold<num>(0, (sum, a) => sum + a.twdAccumulated);
    final fmt = NumberFormat.currency(locale: 'zh_TW', symbol: 'NT\$ ');
    return Card(
      elevation: 0,
      color: theme.colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('總資產（換算 TWD）',
                style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onPrimaryContainer)),
            const SizedBox(height: 8),
            Text(fmt.format(total),
                style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onPrimaryContainer)),
          ],
        ),
      ),
    );
  }
}

class _AccountTile extends StatelessWidget {
  final Account account;
  const _AccountTile({required this.account});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(
        locale: 'zh_TW', symbol: '${account.currency} ', decimalDigits: 2);
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.account_balance_outlined)),
        title: Text(account.name),
        subtitle: account.category.isEmpty ? null : Text(account.category),
        trailing: Text(
          fmt.format(account.balance),
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: account.balance < 0 ? Colors.red.shade400 : null,
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final VoidCallback onLogout;
  const _ErrorView({
    required this.message,
    required this.onRetry,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 48),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            Wrap(
              spacing: 12,
              children: [
                FilledButton.tonal(onPressed: onRetry, child: const Text('重試')),
                TextButton(onPressed: onLogout, child: const Text('重新登入')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

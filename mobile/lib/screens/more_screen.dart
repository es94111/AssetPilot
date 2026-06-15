import 'package:flutter/material.dart';

import 'accounts_screen.dart';
import 'budgets_screen.dart';
import 'categories_screen.dart';
import 'onboarding_screen.dart';
import 'recurring_screen.dart';
import 'reports_screen.dart';
import 'settings_screen.dart';

class MoreScreen extends StatelessWidget {
  final VoidCallback onLoggedOut;
  const MoreScreen({super.key, required this.onLoggedOut});

  @override
  Widget build(BuildContext context) {
    final items = <(IconData, String, Widget)>[
      (Icons.account_balance_wallet_outlined, '帳戶', const AccountsScreen()),
      (Icons.category_outlined, '分類', const CategoriesScreen()),
      (Icons.savings_outlined, '預算', const BudgetsScreen()),
      (Icons.repeat, '固定收支', const RecurringScreen()),
      (Icons.bar_chart, '統計報表', const ReportsScreen()),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('更多')),
      body: ListView(
        children: [
          for (final (icon, label, page) in items)
            ListTile(
              leading: Icon(icon),
              title: Text(label),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => page)),
            ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.help_outline),
            title: const Text('使用教學'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => OnboardingScreen.show(context),
          ),
          ListTile(
            leading: const Icon(Icons.settings_outlined),
            title: const Text('設定'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => SettingsScreen(onLoggedOut: onLoggedOut),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

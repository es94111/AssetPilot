import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'accounts_screen.dart';
import 'budgets_screen.dart';
import 'categories_screen.dart';
import 'onboarding_screen.dart';
import 'recurring_screen.dart';
import 'reports_screen.dart';
import 'settings_screen.dart';
import '../l10n.dart';

class MoreScreen extends StatelessWidget {
  final VoidCallback onLoggedOut;
  const MoreScreen({super.key, required this.onLoggedOut});

  @override
  Widget build(BuildContext context) {
    final items = <(IconData, String, Widget)>[
      (Icons.account_balance_wallet_outlined, tr('帳戶'), AccountsScreen()),
      (Icons.category_outlined, tr('分類'), CategoriesScreen()),
      (Icons.savings_outlined, tr('預算'), BudgetsScreen()),
      (Icons.repeat, tr('固定收支'), RecurringScreen()),
      (Icons.bar_chart, tr('統計報表'), ReportsScreen()),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(tr('更多'))),
      body: ListView(
        children: [
          for (final (icon, label, page) in items)
            ListTile(
              leading: Icon(icon),
              title: Text(label),
              trailing: Icon(Icons.chevron_right),
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => page)),
            ),
          Divider(),
          ListTile(
            leading: Icon(Icons.help_outline),
            title: Text(tr('使用教學')),
            trailing: Icon(Icons.chevron_right),
            onTap: () => OnboardingScreen.show(context),
          ),
          ListTile(
            leading: Icon(Icons.settings_outlined),
            title: Text(tr('設定')),
            trailing: Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => SettingsScreen(onLoggedOut: onLoggedOut),
              ),
            ),
          ),
          // 僅在 debug build 顯示：依序送出測試指標（驗證 Sentry Metrics）、
          // 測試日誌（驗證 Sentry Logs），再故意丟出例外（驗證錯誤上報）。
          // 正式（release）版不會出現這一項。
          if (kDebugMode)
            ListTile(
              leading: Icon(Icons.bug_report_outlined),
              title: Text(tr('驗證 Sentry 設定（測試用）')),
              trailing: Icon(Icons.chevron_right),
              onTap: () {
                Sentry.metrics.count('verify_button_tapped', 1);
                Sentry.metrics.distribution(
                  'verify_latency',
                  187,
                  unit: SentryMetricUnit.millisecond,
                );
                Sentry.logger.fmt.info('Test log from %s', ['Sentry']);
                throw StateError('This is test exception');
              },
            ),
        ],
      ),
    );
  }
}

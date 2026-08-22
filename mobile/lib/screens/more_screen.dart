import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import '../l10n.dart';
import '../widgets.dart';
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
    void open(Widget page) =>
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

    final finance = <(IconData, String, VoidCallback)>[
      (
        Icons.account_balance_wallet_outlined,
        trKey('featuresCommonAccount'),
        () => open(AccountsScreen()),
      ),
      (
        Icons.category_outlined,
        trKey('dashboardTableCategory'),
        () => open(CategoriesScreen()),
      ),
      (
        Icons.savings_outlined,
        trKey('mobileLegacyBudgets'),
        () => open(BudgetsScreen()),
      ),
      (Icons.repeat, trKey('navRecurring'), () => open(RecurringScreen())),
      (
        Icons.bar_chart_outlined,
        trKey('navReports'),
        () => open(ReportsScreen()),
      ),
    ];
    final system = <(IconData, String, VoidCallback)>[
      (
        Icons.settings_outlined,
        trKey('settingsTitle'),
        () => open(SettingsScreen(onLoggedOut: onLoggedOut)),
      ),
    ];
    if (kDebugMode) {
      system.add((
        Icons.bug_report_outlined,
        trKey('mobileLegacyTestSentryConfiguration'),
        () {
          Sentry.metrics.count('verify_button_tapped', 1);
          Sentry.metrics.distribution(
            'verify_latency',
            187,
            unit: SentryMetricUnit.millisecond,
          );
          Sentry.logger.fmt.info('Test log from %s', ['Sentry']);
          throw StateError('This is test exception');
        },
      ));
    }

    return Scaffold(
      appBar: AppBar(title: Text(trKey('mobileLegacyMore'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          _MoreSection(title: trKey('navSectionsFinance'), items: finance),
          SizedBox(height: 24),
          _MoreSection(title: trKey('settingsAccountTitle'), items: system),
          SizedBox(height: 24),
          _MoreSection(
            title: trKey('mobileLegacyGettingStarted'),
            items: [
              (
                Icons.menu_book_outlined,
                trKey('mobileLegacyGettingStarted'),
                () => OnboardingScreen.show(context),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MoreSection extends StatelessWidget {
  final String title;
  final List<(IconData, String, VoidCallback)> items;

  const _MoreSection({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: title),
        SizedBox(height: 8),
        LedgerCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                _MoreTile(
                  icon: items[i].$1,
                  label: items[i].$2,
                  onTap: items[i].$3,
                ),
                if (i < items.length - 1) Divider(height: 1, indent: 68),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _MoreTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _MoreTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      minVerticalPadding: 12,
      leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
      title: Text(label),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}

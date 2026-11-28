import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import '../api_client.dart';
import '../l10n.dart';
import '../theme.dart';
import '../widgets.dart';
import 'accounts_screen.dart';
import 'budgets_screen.dart';
import 'categories_screen.dart';
import 'changelog_screen.dart';
import 'ledger_screen.dart';
import 'onboarding_screen.dart';
import 'recurring_screen.dart';
import 'reports_screen.dart';
import 'settings_screen.dart';

class MoreScreen extends StatelessWidget {
  final VoidCallback onLoggedOut;
  final VoidCallback onLedgerChanged;

  const MoreScreen({
    super.key,
    required this.onLoggedOut,
    required this.onLedgerChanged,
  });

  @override
  Widget build(BuildContext context) {
    Widget destination(IconData icon, String key, Widget Function() buildPage) {
      return ListTile(
        leading: Icon(icon),
        title: Text(trKey(key)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () =>
            Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => buildPage())),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(trKey('mobileLegacyMore'))),
      body: ListView(
        padding: const EdgeInsets.all(ApSpace.lg),
        children: [
          if (ApiClient.instance.activeLedgerReadOnly) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: ApSpace.md),
              child: Text(trKey('ledgerReadOnlyNotice')),
            ),
          ],
          OptionGroup(
            label: trKey('uxLedgerTools'),
            children: [
              destination(
                Icons.menu_book_outlined,
                'ledgerSwitchTitle',
                () => LedgerScreen(onLedgerChanged: onLedgerChanged),
              ),
              destination(
                Icons.account_balance_wallet_outlined,
                'navAccounts',
                () => AccountsScreen(),
              ),
              destination(
                Icons.category_outlined,
                'navCategories',
                () => CategoriesScreen(),
              ),
              destination(
                Icons.repeat,
                'navRecurring',
                () => RecurringScreen(),
              ),
            ],
          ),
          const SizedBox(height: ApSpace.md),
          OptionGroup(
            label: trKey('uxBudgetsAndReports'),
            children: [
              destination(
                Icons.savings_outlined,
                'mobileLegacyBudgets',
                () => BudgetsScreen(),
              ),
              destination(
                Icons.bar_chart_outlined,
                'navReports',
                () => ReportsScreen(),
              ),
            ],
          ),
          const SizedBox(height: ApSpace.md),
          OptionGroup(
            label: trKey('uxSettingsAndHelp'),
            children: [
              destination(
                Icons.settings_outlined,
                'settingsTitle',
                () => SettingsScreen(onLoggedOut: onLoggedOut),
              ),
              ListTile(
                leading: const Icon(Icons.help_outline),
                title: Text(trKey('mobileLegacyGettingStarted')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => OnboardingScreen.show(context),
              ),
              destination(
                Icons.info_outline,
                'shellVersionInfo',
                () => ChangelogScreen(),
              ),
              if (kDebugMode)
                ListTile(
                  leading: const Icon(Icons.bug_report_outlined),
                  title: Text(trKey('mobileLegacyTestSentryConfiguration')),
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
        ],
      ),
    );
  }
}

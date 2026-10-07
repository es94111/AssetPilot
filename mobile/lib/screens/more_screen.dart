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
import 'ledger_screen.dart';
import 'onboarding_screen.dart';
import 'recurring_screen.dart';
import 'reports_screen.dart';
import 'settings_screen.dart';

/// 「更多」頁：分區列出理財管理、報表分析與系統設定。
/// 高頻功能（帳戶、預算、報表）已提升到 Dashboard 快速入口與底部分頁，
/// 這裡保留完整入口並以語義分組，方便探索其餘功能。
class MoreScreen extends StatefulWidget {
  final VoidCallback onLoggedOut;
  const MoreScreen({super.key, required this.onLoggedOut});

  @override
  State<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends State<MoreScreen> {
  bool _readOnlyLedger = false;

  @override
  void initState() {
    super.initState();
    _refreshLedgerRole();
  }

  /// 目前帳本為 viewer 時，隱藏全部寫入入口（伺服器端同樣會拒絕）。
  /// 帳本切換時 HomeShell 會重建本頁，因此只需在建立時查一次。
  Future<void> _refreshLedgerRole() async {
    try {
      final rows = await ApiClient.instance.ledgers();
      final active = ApiClient.instance.activeLedgerId;
      if (!mounted) return;
      final selected = rows
          .map((e) => LedgerOption.fromJson((e as Map).cast<String, dynamic>()))
          .where((ledger) => ledger.id == active)
          .toList();
      setState(() {
        _readOnlyLedger = selected.isNotEmpty && selected.first.readOnly;
      });
    } catch (_) {
      if (mounted) setState(() => _readOnlyLedger = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    Future<void> open(Widget page) =>
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

    final finance = <(IconData, String, VoidCallback)>[
      (
        Icons.menu_book_outlined,
        trKey('ledgerSwitchTitle'),
        () async {
          await open(const LedgerScreen());
          // 回到本頁時重新檢查角色，切換到 viewer 帳本後立即隱藏寫入入口。
          await _refreshLedgerRole();
        },
      ),
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
        () => open(SettingsScreen(onLoggedOut: widget.onLoggedOut)),
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
        padding: const EdgeInsets.fromLTRB(
          ApSpace.xl,
          ApSpace.md,
          ApSpace.xl,
          ApSpace.xxl,
        ),
        children: [
          if (_readOnlyLedger) ...[
            LedgerCard(
              child: Row(
                children: [
                  Icon(
                    Icons.lock_outline,
                    size: 20,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: ApSpace.sm),
                  Expanded(child: Text(trKey('ledgerReadOnlyNotice'))),
                ],
              ),
            ),
            const SizedBox(height: ApSpace.xl),
          ],
          _MoreSection(
            title: trKey('navSectionsFinance'),
            items: finance,
          ),
          const SizedBox(height: ApSpace.xl),
          _MoreSection(title: trKey('settingsAccountTitle'), items: system),
          const SizedBox(height: ApSpace.xl),
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
        const SizedBox(height: ApSpace.sm),
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
                if (i < items.length - 1)
                  const Divider(height: 1, indent: ApSpace.md * 6),
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
    final scheme = Theme.of(context).colorScheme;
    return ListTile(
      minVerticalPadding: ApSpace.md,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: ApSpace.lg,
        vertical: ApSpace.xs,
      ),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: apTokens(context).glassTint,
          borderRadius: ApRadius.rSm,
        ),
        child: Icon(icon, color: scheme.primary, size: 20),
      ),
      title: Text(label),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
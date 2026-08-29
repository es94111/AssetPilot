import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';
import '../l10n.dart';

class _ReportData {
  final List<CatNode> breakdown;
  final num total;
  _ReportData(this.breakdown, this.total);
}

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _type = 'expense';
  late DateTimeRange _range;
  late Future<_ReportData> _future;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _range = DateTimeRange(start: DateTime(now.year, now.month, 1), end: now);
    _future = _load();
  }

  String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<_ReportData> _load() async {
    final json = await ApiClient.instance.reports(
      type: _type,
      from: _fmt(_range.start),
      to: _fmt(_range.end),
    );
    final breakdown = (json['categoryBreakdown'] as List? ?? [])
        .map((e) => CatNode.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    num total = 0;
    final t = json['total'];
    if (t is num) total = t;
    return _ReportData(breakdown, total);
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _pickRange() async {
    final r = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
      initialDateRange: _range,
    );
    if (r != null) {
      setState(() {
        _range = r;
        _future = _load();
      });
    }
  }

  /// 扇區百分比標籤畫在使用者自訂的分類色上，依亮度選黑或白確保對比。
  Color _onSliceColor(Color slice) =>
      slice.computeLuminance() > 0.55 ? const Color(0xFF26221C) : Colors.white;

  @override
  Widget build(BuildContext context) {
    final tokens = apTokens(context);
    return Scaffold(
      appBar: AppBar(title: Text(trKey('navReports'))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              ApSpace.lg,
              ApSpace.md,
              ApSpace.lg,
              ApSpace.sm,
            ),
            child: Column(
              children: [
                SegmentedButton<String>(
                  segments: [
                    ButtonSegment(
                      value: 'expense',
                      label: Text(trKey('dashboardOverviewExpense')),
                    ),
                    ButtonSegment(
                      value: 'income',
                      label: Text(trKey('dashboardOverviewIncome')),
                    ),
                  ],
                  selected: {_type},
                  onSelectionChanged: (s) {
                    setState(() => _type = s.first);
                    _reload();
                  },
                ),
                const SizedBox(height: ApSpace.sm),
                OutlinedButton.icon(
                  onPressed: _pickRange,
                  icon: const Icon(Icons.date_range),
                  label: Text('${_fmt(_range.start)} ～ ${_fmt(_range.end)}'),
                ),
              ],
            ),
          ),
          Expanded(
            child: AsyncView<_ReportData>(
              future: _future,
              onRetry: _reload,
              loadingBuilder: (_) => ListView(
                padding: const EdgeInsets.fromLTRB(
                  ApSpace.lg,
                  0,
                  ApSpace.lg,
                  ApSpace.xl,
                ),
                children: const [SkeletonSummary()],
              ),
              builder: (context, data) {
                if (data.breakdown.isEmpty) {
                  return EmptyState(
                    icon: Icons.bar_chart,
                    title: trKey('mobileLegacyNoDataForThisPeriod'),
                    message: trKey('mobileLegacyFilterTransactions'),
                  );
                }
                final sorted = [...data.breakdown]
                  ..sort((a, b) => b.total.compareTo(a.total));
                final totalColor = _type == 'expense'
                    ? tokens.expense
                    : tokens.income;
                return ListView(
                  padding: const EdgeInsets.fromLTRB(
                    ApSpace.lg,
                    ApSpace.sm,
                    ApSpace.lg,
                    ApSpace.xl,
                  ),
                  children: [
                    Center(
                      child: AnimatedTextSwap(
                        text: trKey(
                          _type == 'expense'
                              ? 'mobileDynamicReportTotalExpense'
                              : 'mobileDynamicReportTotalIncome',
                          {'total': twd(data.total)},
                        ),
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: totalColor,
                            ),
                      ),
                    ),
                    const SizedBox(height: ApSpace.lg),
                    LedgerCard(
                      child: Column(
                        children: [
                          SizedBox(
                            height: 220,
                            child: PieChart(
                              PieChartData(
                                sectionsSpace: 2,
                                centerSpaceRadius: 50,
                                sections: [
                                  for (final n in sorted.take(10))
                                    PieChartSectionData(
                                      value: n.total.toDouble(),
                                      color: parseColor(n.color),
                                      title: data.total > 0
                                          ? '${(n.total / data.total * 100).round()}%'
                                          : '',
                                      radius: 60,
                                      titleStyle: TextStyle(
                                        fontSize: 11,
                                        color: _onSliceColor(
                                          parseColor(n.color),
                                        ),
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: ApSpace.md),
                    ...sorted.toList().asMap().entries.map(
                      (e) => StaggerIn(
                        index: e.key,
                        child: LedgerCard(
                          margin: const EdgeInsets.only(bottom: ApSpace.sm),
                          padding: const EdgeInsets.symmetric(
                            horizontal: ApSpace.lg,
                            vertical: ApSpace.xs,
                          ),
                          child: ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            leading: Container(
                              width: 16,
                              height: 16,
                              decoration: BoxDecoration(
                                color: parseColor(e.value.color),
                                shape: BoxShape.circle,
                              ),
                            ),
                            title: Text(e.value.name),
                            trailing: AnimatedTextSwap(
                              text: twd(e.value.total),
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../format.dart';
import '../models.dart';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('統計報表'))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                SegmentedButton<String>(
                  segments: [
                    ButtonSegment(value: 'expense', label: Text(tr('支出'))),
                    ButtonSegment(value: 'income', label: Text(tr('收入'))),
                  ],
                  selected: {_type},
                  onSelectionChanged: (s) {
                    setState(() => _type = s.first);
                    _reload();
                  },
                ),
                SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _pickRange,
                  icon: Icon(Icons.date_range),
                  label: Text('${_fmt(_range.start)} ～ ${_fmt(_range.end)}'),
                ),
              ],
            ),
          ),
          Expanded(
            child: AsyncView<_ReportData>(
              future: _future,
              onRetry: _reload,
              builder: (context, data) {
                if (data.breakdown.isEmpty) {
                  return EmptyState(
                    icon: Icons.bar_chart,
                    message: tr('此區間無資料'),
                  );
                }
                final sorted = [...data.breakdown]
                  ..sort((a, b) => b.total.compareTo(a.total));
                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  children: [
                    Center(
                      child: Text(
                        '${trPair(_type == 'expense' ? '總支出：' : '總收入：', _type == 'expense' ? 'Total expenses: ' : 'Total income: ')}'
                        '${twd(data.total)}',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ),
                    SizedBox(height: 16),
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
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(height: 16),
                    for (final n in sorted)
                      ListTile(
                        dense: true,
                        leading: Container(
                          width: 16,
                          height: 16,
                          decoration: BoxDecoration(
                            color: parseColor(n.color),
                            shape: BoxShape.circle,
                          ),
                        ),
                        title: Text(n.name),
                        trailing: Text(
                          twd(n.total),
                          style: TextStyle(fontWeight: FontWeight.bold),
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

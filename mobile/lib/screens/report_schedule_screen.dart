import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';
import '../l10n.dart';

Map<String, String> get _freqLabels => {
  'daily': trKey('featuresRecurringFrequencyLabelsDaily'),
  'weekly': trKey('featuresRecurringFrequencyLabelsWeekly'),
  'monthly': trKey('featuresRecurringFrequencyLabelsMonthly'),
};
List<String> get _weekdays => [
  trKey('mobileLegacyDay'),
  trKey('mobileLegacyMon'),
  trKey('mobileLegacyTue'),
  trKey('mobileLegacyWed'),
  trKey('mobileLegacyThu'),
  trKey('mobileLegacyFri'),
  trKey('mobileLegacySat'),
];

String _two(int n) => n.toString().padLeft(2, '0');

String _fmtDate(num ms) {
  final d = DateTime.fromMillisecondsSinceEpoch(ms.toInt());
  return '${d.year}-${_two(d.month)}-${_two(d.day)} ${_two(d.hour)}:${_two(d.minute)}';
}

String _scheduleSummary(ReportSchedule s) {
  final time = '${_two(s.hour)}:${_two(s.minute)}';
  final when = switch (s.freq) {
    'weekly' => trKey('mobileDynamicEveryWeekday', {
      'weekday': _weekdays[s.weekday.clamp(0, 6)],
    }),
    'monthly' =>
      s.dayOfMonth == 0
          ? trKey('mobileLegacyLastDayOfEachMonth')
          : trKey('mobileDynamicMonthlyOnDay', {'day': s.dayOfMonth}),
    _ => trKey('featuresRecurringFrequencyLabelsDaily'),
  };
  final channels = [
    if (s.notifyEmail) 'Email',
    if (s.notifyLine) 'LINE',
  ].join(isChineseLocale ? '／' : ' / ');
  return '$when $time${isChineseLocale ? '・' : ' · '}$channels';
}

/// 定期報表通知排程：使用者自訂何時、以何種方式收到收支報表。
class ReportScheduleScreen extends StatefulWidget {
  const ReportScheduleScreen({super.key});

  @override
  State<ReportScheduleScreen> createState() => _ReportScheduleScreenState();
}

class _ReportScheduleScreenState extends State<ReportScheduleScreen> {
  late Future<List<ReportSchedule>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<ReportSchedule>> _load() async {
    final list = await ApiClient.instance.reportSchedules();
    return list
        .map((e) => ReportSchedule.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _openForm([ReportSchedule? existing]) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ReportScheduleForm(existing: existing),
    );
    if (changed == true) _reload();
  }

  Future<void> _toggle(ReportSchedule s) async {
    try {
      await ApiClient.instance.updateReportSchedule(s.id, {
        'enabled': !s.enabled,
      });
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  Future<void> _delete(ReportSchedule s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(trKey('mobileLegacyDeleteSchedule')),
        content: Text(
          trKey('mobileLegacyDeleteThisReportNotificationSchedule'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(trKey('commonDelete')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.instance.deleteReportSchedule(s.id);
      if (mounted) toast(context, trKey('mobileLegacyDeleted'));
      _reload();
    } catch (e) {
      if (mounted) toast(context, '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(trKey('mobileLegacyReportNotifications'))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: Icon(Icons.add),
        label: Text(trKey('mobileLegacyAddSchedule')),
      ),
      body: AsyncView<List<ReportSchedule>>(
        future: _future,
        onRetry: _reload,
        builder: (context, list) {
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.notifications_none,
              message: trKey('mobileLegacyN'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView.separated(
              padding: const EdgeInsets.only(bottom: 88),
              itemCount: list.length,
              separatorBuilder: (_, _) => Divider(height: 1),
              itemBuilder: (context, i) {
                final s = list[i];
                return ListTile(
                  leading: Icon(
                    Icons.schedule,
                    color: s.enabled
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  title: Text(_scheduleSummary(s)),
                  subtitle: Text(
                    s.lastRun > 0
                        ? trKey('mobileDynamicLastSent', {
                            'value': _fmtDate(s.lastRun),
                          })
                        : trKey('mobileLegacyNotSentYet'),
                  ),
                  trailing: Switch(
                    value: s.enabled,
                    onChanged: (_) => _toggle(s),
                  ),
                  onTap: () => _openForm(s),
                  onLongPress: () => _delete(s),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _ReportScheduleForm extends StatefulWidget {
  final ReportSchedule? existing;
  const _ReportScheduleForm({this.existing});

  @override
  State<_ReportScheduleForm> createState() => _ReportScheduleFormState();
}

class _ReportScheduleFormState extends State<_ReportScheduleForm> {
  String _freq = 'monthly';
  int _hour = 9;
  int _minute = 0;
  int _weekday = 1;
  int _dayOfMonth = 1;
  bool _notifyEmail = true;
  bool _notifyLine = false;
  bool _enabled = true;
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _freq = _freqLabels.containsKey(e.freq) ? e.freq : 'monthly';
      _hour = e.hour;
      _minute = e.minute;
      _weekday = e.weekday.clamp(0, 6);
      _dayOfMonth = e.dayOfMonth.clamp(0, 28);
      _notifyEmail = e.notifyEmail;
      _notifyLine = e.notifyLine;
      _enabled = e.enabled;
    }
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: _hour, minute: _minute),
    );
    if (t != null) {
      setState(() {
        _hour = t.hour;
        _minute = t.minute;
      });
    }
  }

  Future<void> _save() async {
    if (!_notifyEmail && !_notifyLine) {
      toast(context, trKey('mobileLegacySelectAtLeastOneNotificationMethod'));
      return;
    }
    setState(() => _saving = true);
    try {
      final body = <String, dynamic>{
        'freq': _freq,
        'hour': _hour,
        'minute': _minute,
        'weekday': _weekday,
        'dayOfMonth': _dayOfMonth,
        'notifyEmail': _notifyEmail,
        'notifyLine': _notifyLine,
        'enabled': _enabled,
      };
      final api = ApiClient.instance;
      if (_isEdit) {
        await api.updateReportSchedule(widget.existing!.id, body);
      } else {
        await api.createReportSchedule(body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, '$e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              _isEdit
                  ? trKey('mobileLegacyEditReportSchedule')
                  : trKey('mobileLegacyAddReportSchedule'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            SizedBox(height: 16),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(
                  value: 'daily',
                  label: Text(trKey('featuresRecurringFrequencyLabelsDaily')),
                ),
                ButtonSegment(
                  value: 'weekly',
                  label: Text(trKey('featuresRecurringFrequencyLabelsWeekly')),
                ),
                ButtonSegment(
                  value: 'monthly',
                  label: Text(trKey('featuresRecurringFrequencyLabelsMonthly')),
                ),
              ],
              selected: {_freq},
              onSelectionChanged: (s) => setState(() => _freq = s.first),
            ),
            SizedBox(height: 12),
            ListTile(
              shape: RoundedRectangleBorder(
                side: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
                borderRadius: ApRadius.rSm,
              ),
              leading: Icon(Icons.access_time),
              title: Text(trKey('mobileLegacyTime')),
              trailing: Text('${_two(_hour)}:${_two(_minute)}'),
              onTap: _pickTime,
            ),
            if (_freq == 'weekly') ...[
              SizedBox(height: 12),
              DropdownButtonFormField<int>(
                initialValue: _weekday,
                decoration: InputDecoration(
                  labelText: trKey('mobileLegacyDayOfWeek'),
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (var i = 0; i < 7; i++)
                    DropdownMenuItem(
                      value: i,
                      child: Text(
                        trKey('mobileDynamicWeekday', {
                          'weekday': _weekdays[i],
                        }),
                      ),
                    ),
                ],
                onChanged: (v) => setState(() => _weekday = v ?? 1),
              ),
            ],
            if (_freq == 'monthly') ...[
              SizedBox(height: 12),
              DropdownButtonFormField<int>(
                initialValue: _dayOfMonth,
                decoration: InputDecoration(
                  labelText: trKey('dashboardTableDate'),
                  border: OutlineInputBorder(),
                ),
                items: [
                  DropdownMenuItem(
                    value: 0,
                    child: Text(trKey('mobileLegacyLastDayOfEachMonth')),
                  ),
                  for (var d = 1; d <= 28; d++)
                    DropdownMenuItem(
                      value: d,
                      child: Text(trKey('mobileDynamicDayOfMonth', {'day': d})),
                    ),
                ],
                onChanged: (v) => setState(() => _dayOfMonth = v ?? 1),
              ),
            ],
            SizedBox(height: 4),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(trKey('mobileLegacyEmailNotifications')),
              value: _notifyEmail,
              onChanged: (v) => setState(() => _notifyEmail = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(trKey('mobileLegacyLineNotifications')),
              subtitle: Text(trKey('mobileLegacyRequiresALinkedLineAccount')),
              value: _notifyLine,
              onChanged: (v) => setState(() => _notifyLine = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(trKey('mobileLegacyEnabled')),
              value: _enabled,
              onChanged: (v) => setState(() => _enabled = v),
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
          ],
        ),
      ),
    );
  }
}

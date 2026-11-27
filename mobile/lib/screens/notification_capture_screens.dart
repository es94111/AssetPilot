import 'package:flutter/material.dart';

import '../api_client.dart';
import '../l10n.dart';
import '../platform/notification_capture.dart';
import '../widgets.dart';
import 'ledger_screen.dart';
import 'transaction_form_screen.dart';

class NotificationCaptureSettingsScreen extends StatefulWidget {
  final String ownerId;
  const NotificationCaptureSettingsScreen({super.key, required this.ownerId});

  @override
  State<NotificationCaptureSettingsScreen> createState() =>
      _NotificationCaptureSettingsScreenState();
}

class _NotificationCaptureSettingsScreenState
    extends State<NotificationCaptureSettingsScreen> {
  final _api = ApiClient.instance;
  late Future<Map<String, dynamic>> _configuration;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _configuration = _api.notificationCaptureConfiguration();
    NotificationCapturePlatform.refresh();
  }

  void _reload() => setState(() {
    _configuration = _api.notificationCaptureConfiguration();
  });

  Future<void> _change(bool enabled, Map<String, dynamic> configuration) async {
    if (_busy) return;
    if (enabled) {
      final agreed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(trKey('notificationCaptureConsentTitle')),
          content: SingleChildScrollView(
            child: Text(
              trKey('notificationCaptureConsentBody', {
                'service': configuration['origin'],
                'model': configuration['model'],
              }),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(trKey('commonCancel')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(trKey('notificationCaptureAgree')),
            ),
          ],
        ),
      );
      if (agreed != true || !mounted) return;
    }

    setState(() => _busy = true);
    final generation = NotificationCapturePlatform.sessionGeneration;
    var issued = false;
    try {
      if (enabled) {
        if (!_api.isLoggedIn ||
            NotificationCapturePlatform.snapshot.value.ownerId !=
                widget.ownerId) {
          throw StateError('capture_session_changed');
        }
        final grant = await _api.authorizeNotificationCapture(
          configuration['revision'] as String,
        );
        issued = true;
        if (generation != NotificationCapturePlatform.sessionGeneration) {
          throw StateError('capture_session_changed');
        }
        final active = await NotificationCapturePlatform.enable(
          ownerId: widget.ownerId,
          baseURL: _api.baseUrl,
          token: grant['token'] as String,
          revision: grant['revision'] as String,
          sources: configuration['sources'] as List,
        );
        if (!active) throw StateError('capture_session_changed');
      } else {
        await NotificationCapturePlatform.disable(widget.ownerId);
        // Local stop takes effect even if the device is offline.
        if (generation == NotificationCapturePlatform.sessionGeneration &&
            _api.isLoggedIn) {
          try {
            await _api.revokeNotificationCapture();
          } on ApiException catch (error) {
            if (error.statusCode != 0) rethrow;
          }
        }
      }
    } catch (error) {
      if (issued &&
          generation == NotificationCapturePlatform.sessionGeneration &&
          _api.isLoggedIn &&
          NotificationCapturePlatform.snapshot.value.ownerId ==
              widget.ownerId) {
        try {
          await _api.revokeNotificationCapture();
        } catch (_) {}
      }
      if (mounted) {
        toast(
          context,
          error is ApiException
              ? error.message
              : trKey('notificationCaptureStorageError'),
          isError: true,
        );
        _reload();
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openShortcuts() async {
    if (!await NotificationCapturePlatform.openShortcuts() && mounted) {
      toast(context, trKey('notificationCaptureShortcutsError'), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(trKey('notificationCaptureTitle'))),
    body: FutureBuilder<Map<String, dynamic>>(
      future: _configuration,
      builder: (context, response) => ValueListenableBuilder(
        valueListenable: NotificationCapturePlatform.snapshot,
        builder: (context, snapshot, _) {
          final configuration = response.data ?? const <String, dynamic>{};
          final available = configuration['available'] == true;
          final belongsToOwner = snapshot.ownerId == widget.ownerId;
          final active = belongsToOwner && snapshot.revision != null;
          final changed =
              active &&
              available &&
              snapshot.revision != configuration['revision'];
          final sources = (configuration['sources'] as List? ?? const [])
              .whereType<Map>()
              .toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(trKey('notificationCaptureEnable')),
                subtitle: Text(
                  trKey(
                    !available
                        ? 'notificationCaptureUnavailable'
                        : changed
                        ? 'notificationCaptureConsentChanged'
                        : 'notificationCaptureEnableHint',
                  ),
                ),
                value: active && !changed,
                onChanged: !_busy && (available || active)
                    ? (value) => _change(value, configuration)
                    : null,
              ),
              if (_busy || response.connectionState == ConnectionState.waiting)
                const LinearProgressIndicator(),
              if (response.hasError)
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    onPressed: _reload,
                    icon: const Icon(Icons.refresh),
                    label: Text(trKey('mobileLegacyRetry')),
                  ),
                ),
              if (available)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(trKey('notificationCaptureService')),
                  subtitle: Text(
                    '${configuration['origin']}\n${configuration['model']}',
                  ),
                ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(trKey('notificationCaptureRecent')),
                subtitle: Text(
                  [
                    if (snapshot.lastReceivedAt case final DateTime time
                        when belongsToOwner)
                      _displayTime(context, time),
                    trKey(
                      _captureStatusKey(
                        belongsToOwner ? snapshot.lastStatus : null,
                      ),
                    ),
                  ].join('\n'),
                ),
              ),
              const Divider(),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  trKey('notificationCaptureSetup'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              for (final step in [
                'notificationCaptureStepTrigger',
                'notificationCaptureStepAction',
                'notificationCaptureStepInput',
                'notificationCaptureStepRun',
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(trKey(step)),
                ),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: OutlinedButton.icon(
                  onPressed: _openShortcuts,
                  icon: const Icon(Icons.open_in_new),
                  label: Text(trKey('notificationCaptureOpenShortcuts')),
                ),
              ),
              const SizedBox(height: 16),
              for (final group in ['payment', 'bank'])
                ExpansionTile(
                  title: Text(
                    trKey(
                      group == 'bank'
                          ? 'notificationCaptureBanks'
                          : 'notificationCapturePayments',
                    ),
                  ),
                  tilePadding: EdgeInsets.zero,
                  children: [
                    for (final source in sources.where(
                      (row) => row['group'] == group,
                    ))
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(source['name'] as String),
                        subtitle: Text(
                          [
                            if ((source['appNames'] as List).isNotEmpty)
                              (source['appNames'] as List).join('、'),
                            trKey(switch (source['availability']) {
                              'unavailable' => 'notificationCaptureNoIosSource',
                              'verified' => 'notificationCaptureVerified',
                              _ => 'notificationCaptureUnverified',
                            }),
                          ].join('\n'),
                        ),
                      ),
                  ],
                ),
            ],
          );
        },
      ),
    ),
  );
}

class NotificationDraftsScreen extends StatefulWidget {
  final VoidCallback? onLedgerChanged;
  final VoidCallback onPosted;

  const NotificationDraftsScreen({
    super.key,
    this.onLedgerChanged,
    required this.onPosted,
  });

  @override
  State<NotificationDraftsScreen> createState() =>
      _NotificationDraftsScreenState();
}

class _NotificationDraftsScreenState extends State<NotificationDraftsScreen> {
  @override
  void initState() {
    super.initState();
    NotificationCapturePlatform.retry();
  }

  Future<void> _openLedgerPicker() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LedgerScreen(onLedgerChanged: widget.onLedgerChanged),
      ),
    );
    if (mounted) setState(() {});
  }

  Future<void> _review(NotificationDraft draft) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => TransactionFormScreen(notificationDraft: draft),
      ),
    );
    if (mounted && saved == true) widget.onPosted();
  }

  Future<void> _discard(NotificationDraft draft) async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(trKey('notificationCaptureDiscard')),
        content: Text(trKey('notificationCaptureDiscardHint')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(trKey('commonCancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(trKey('commonDelete')),
          ),
        ],
      ),
    );
    if (discard != true || !mounted) return;
    try {
      await NotificationCapturePlatform.discard(draft);
    } catch (_) {
      if (mounted) {
        toast(context, trKey('notificationCaptureStorageError'), isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(trKey('notificationCaptureDrafts'))),
    body: ValueListenableBuilder(
      valueListenable: NotificationCapturePlatform.snapshot,
      builder: (context, snapshot, _) {
        final personal =
            snapshot.ownerId != null &&
            ApiClient.instance.isPersonalLedgerFor(snapshot.ownerId!);
        return RefreshIndicator(
          onRefresh: NotificationCapturePlatform.retry,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (snapshot.drafts.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Text(trKey('notificationCaptureEmptyDrafts')),
                ),
              if (!personal && snapshot.drafts.isNotEmpty)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.book_outlined),
                  title: Text(trKey('notificationCapturePersonalLedger')),
                  subtitle: Text(trKey('notificationCapturePickLedger')),
                  onTap: _openLedgerPicker,
                ),
              for (final draft in snapshot.drafts)
                Card(
                  child: ListTile(
                    title: Text(draft.merchant ?? draft.sourceName),
                    subtitle: Text(
                      [
                        if (draft.merchant != null) draft.sourceName,
                        if ((draft.occurredAt ?? draft.receivedAt)
                            case final DateTime time)
                          _displayTime(context, time),
                        if (draft.amount != null)
                          [draft.currency, draft.amount].nonNulls.join(' '),
                        trKey(switch (draft.status) {
                          'ready' => 'notificationCaptureDraftReady',
                          'queued' => 'notificationCaptureQueued',
                          _ => 'notificationCaptureReview',
                        }),
                        if (draft.possibleDuplicate)
                          trKey('notificationCaptureCompare'),
                      ].join('\n'),
                    ),
                    onTap: personal && !draft.pendingRecognition
                        ? () => _review(draft)
                        : null,
                    trailing: IconButton(
                      tooltip: trKey('notificationCaptureDiscard'),
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () => _discard(draft),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    ),
  );
}

String _displayTime(BuildContext context, DateTime instant) {
  final local = instant.toLocal();
  final labels = MaterialLocalizations.of(context);
  return '${labels.formatShortDate(local)} ${labels.formatTimeOfDay(TimeOfDay.fromDateTime(local))}';
}

String _captureStatusKey(String? status) => switch (status) {
  'queued' => 'notificationCaptureQueued',
  'ready' => 'notificationCaptureDraftReady',
  'review' => 'notificationCaptureReview',
  'ignored' => 'notificationCaptureIgnored',
  'source' => 'notificationCaptureUnknownSource',
  'empty' => 'notificationCaptureEmptyInput',
  'duplicate' => 'notificationCaptureDuplicate',
  'full' => 'notificationCaptureFull',
  'expired' => 'notificationCaptureExpired',
  'consent' => 'notificationCaptureConsentChanged',
  'session' => 'notificationCaptureSessionExpired',
  'retry' || 'limited' => 'notificationCaptureRetry',
  _ => 'notificationCaptureNoRecent',
};

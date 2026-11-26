import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'platform_info.dart';

class NotificationDraft {
  final String id;
  final String ownerId;
  final String sourceName;
  final String status;
  final DateTime? receivedAt;
  final DateTime? occurredAt;
  final String? amount;
  final String? currency;
  final String? merchant;
  final String? date;
  final bool possibleDuplicate;
  final Map<dynamic, dynamic>? edits;

  NotificationDraft.fromMap(this.ownerId, Map<dynamic, dynamic> row)
    : id = row['id'] as String,
      sourceName = row['sourceName'] as String,
      status = row['status'] as String,
      receivedAt = DateTime.tryParse(row['receivedAt'] as String? ?? ''),
      occurredAt = DateTime.tryParse(row['occurredAt'] as String? ?? ''),
      amount = row['amount'] as String?,
      currency = row['currency'] as String?,
      merchant = row['merchant'] as String?,
      date = row['date'] as String?,
      possibleDuplicate = row['possibleDuplicate'] == true,
      edits = row['edits'] as Map?;

  bool get pendingRecognition => status == 'queued';
}

class NotificationCaptureSnapshot {
  final String? ownerId;
  final String? revision;
  final String? lastStatus;
  final DateTime? lastReceivedAt;
  final DateTime? nextRetryAt;
  final List<NotificationDraft> drafts;

  const NotificationCaptureSnapshot()
    : ownerId = null,
      revision = null,
      lastStatus = null,
      lastReceivedAt = null,
      nextRetryAt = null,
      drafts = const [];

  NotificationCaptureSnapshot.fromMap(Map<dynamic, dynamic> data)
    : ownerId = data['ownerId'] as String?,
      revision = data['revision'] as String?,
      lastStatus = data['lastStatus'] as String?,
      lastReceivedAt = DateTime.tryParse(
        data['lastReceivedAt'] as String? ?? '',
      ),
      nextRetryAt = DateTime.tryParse(data['nextRetryAt'] as String? ?? ''),
      drafts = [
        if (data['ownerId'] case final String owner)
          for (final row
              in (data['drafts'] as List? ?? const []).whereType<Map>())
            NotificationDraft.fromMap(owner, row),
      ];
}

/// Swift owns the protected inbox. The automation can queue and recognize
/// payments while Flutter is suspended or has never been opened that day.
class NotificationCapturePlatform {
  NotificationCapturePlatform._();

  static const _channel = MethodChannel('assetpilot/notification_capture');
  static final supported = ValueNotifier(false);
  static final snapshot = ValueNotifier(const NotificationCaptureSnapshot());
  static Future<void>? _initialization;
  static Future<void>? _processingQueue;
  static int _readGeneration = 0;
  static int _sessionGeneration = 0;
  static bool _sessionEnded = false;

  static int get sessionGeneration => _sessionGeneration;

  static Future<void> initialize() => _initialization ??= _initialize();

  static Future<void> _initialize() async {
    if (!PlatformInfo.isIOS) return;
    try {
      final available = await _channel.invokeMethod<bool>('isSupported');
      if (available != true) return;
      _channel.setMethodCallHandler((call) async {
        if (call.method == 'changed') await refresh();
      });
      supported.value = true;
      await refresh();
    } on PlatformException {
      // Keep the existing app available if the native integration is unavailable.
    } on MissingPluginException {
      // Older builds do not have the native integration.
    }
  }

  static Future<void> bindOwner(String ownerId) async {
    final generation = _sessionGeneration;
    await initialize();
    if (!supported.value ||
        ownerId.isEmpty ||
        generation != _sessionGeneration) {
      return;
    }
    await _channel.invokeMethod<void>('bindOwner', {'ownerId': ownerId});
    if (generation == _sessionGeneration) {
      _sessionEnded = false;
      await refresh();
    }
  }

  static Future<NotificationCaptureSnapshot> read() async {
    if (!supported.value) return const NotificationCaptureSnapshot();
    final data = await _channel.invokeMapMethod<dynamic, dynamic>('snapshot');
    return NotificationCaptureSnapshot.fromMap(data ?? const {});
  }

  static Future<void> refresh() async {
    if (!supported.value || _sessionEnded) return;
    final generation = ++_readGeneration;
    try {
      final current = await read();
      if (generation == _readGeneration) snapshot.value = current;
    } on PlatformException {
      if (generation == _readGeneration) {
        snapshot.value = const NotificationCaptureSnapshot();
      }
    }
  }

  static Future<bool> enable({
    required String ownerId,
    required String baseURL,
    required String token,
    required String revision,
    required List<dynamic> sources,
  }) async {
    final enabled = await _channel.invokeMethod<bool>('enable', {
      'ownerId': ownerId,
      'baseURL': baseURL,
      'token': token,
      'revision': revision,
      'sources': sources,
    });
    await refresh();
    return enabled == true;
  }

  static Future<void> disable(String ownerId) async {
    await _channel.invokeMethod<void>('disable', {'ownerId': ownerId});
    await refresh();
  }

  static Future<void> endSession() async {
    if (!PlatformInfo.isIOS) return;
    ++_sessionGeneration;
    _sessionEnded = true;
    ++_readGeneration;
    snapshot.value = const NotificationCaptureSnapshot();
    try {
      await _channel.invokeMethod<void>('endSession');
    } on PlatformException {
      // Server-side session revocation independently disables the credential.
    } on MissingPluginException {
      // The native integration is absent on this build.
    }
  }

  static Future<void> clearUser(String? ownerId) async {
    if (!supported.value) return;
    final owner = ownerId ?? (await read()).ownerId;
    if (owner == null) return;
    await _channel.invokeMethod<void>('clearUser', {'ownerId': owner});
    await refresh();
  }

  static Future<void> retry() =>
      _processingQueue ??= _processQueue().whenComplete(() {
        _processingQueue = null;
      });

  static Future<void> _processQueue() async {
    await initialize();
    if (!supported.value || _sessionEnded) return;
    await refresh();
    final owner = snapshot.value.ownerId;
    if (owner == null || snapshot.value.revision == null) return;
    try {
      await _channel.invokeMethod<void>('process', {'ownerId': owner});
    } on PlatformException {
      // The queue can be read and tried again when storage is available.
    }
    await refresh();
  }

  static Future<void> discard(NotificationDraft draft) async {
    await _channel.invokeMethod<void>('discard', {
      'ownerId': draft.ownerId,
      'draftId': draft.id,
    });
    await refresh();
  }

  static Future<bool> saveEdits(
    NotificationDraft draft,
    Map<String, dynamic> edits,
  ) async =>
      await _channel.invokeMethod<bool>('saveEdits', {
        'ownerId': draft.ownerId,
        'draftId': draft.id,
        'edits': edits,
      }) ==
      true;

  static Future<bool> openShortcuts() async =>
      await _channel.invokeMethod<bool>('openShortcuts') == true;
}

/// An Apple Shortcuts share link shipped with the app after device acceptance.
class NotificationCaptureShortcutTemplate {
  final String appleShareUrl;
  final int version;
  final bool includesNotificationTrigger;
  final bool verifiedLockedExecution;

  const NotificationCaptureShortcutTemplate({
    required this.appleShareUrl,
    required this.version,
    required this.includesNotificationTrigger,
    this.verifiedLockedExecution = false,
  });

  static final _sharePath = RegExp(r'^/shortcuts/[A-Za-z0-9]+$');

  Uri? get shareUri {
    final uri = Uri.tryParse(appleShareUrl);
    if (version < 1 ||
        !includesNotificationTrigger ||
        uri == null ||
        uri.scheme != 'https' ||
        uri.authority != 'www.icloud.com' ||
        uri.hasQuery ||
        uri.hasFragment ||
        !_sharePath.hasMatch(uri.path)) {
      return null;
    }
    return uri;
  }
}

// Set this after the shared trigger and its notification inputs pass the iPhone
// acceptance checks in docs/ios-release-checklist.md.
const NotificationCaptureShortcutTemplate? releasedNotificationCaptureShortcut =
    null;

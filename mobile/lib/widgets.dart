import 'package:flutter/material.dart';

import 'api_client.dart';
import 'l10n.dart';

/// 統一的非同步載入畫面：處理 loading / error（含重試）/ 成功。
///
/// 若重新整理時 FutureBuilder 仍保留上一份資料，會優先顯示舊資料而非
/// 讓整頁閃成 spinner，降低金融資料畫面跳動；第一次載入才顯示 loading。
class AsyncView<T> extends StatelessWidget {
  final Future<T> future;
  final Widget Function(BuildContext, T) builder;
  final VoidCallback onRetry;
  final WidgetBuilder? loadingBuilder;
  const AsyncView({
    super.key,
    required this.future,
    required this.builder,
    required this.onRetry,
    this.loadingBuilder,
  });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting && !snap.hasData) {
          return loadingBuilder?.call(context) ??
              Center(
                child: Semantics(
                  label: trKey('commonLoading'),
                  liveRegion: true,
                  child: CircularProgressIndicator(),
                ),
              );
        }
        if (snap.hasError) {
          // If refresh failed after data was rendered, keep the data visible and
          // let the page's refresh affordance handle the transient failure.
          if (snap.hasData) return builder(context, snap.data as T);
          return _ErrorBox(
            message: _safeErrorMessage(snap.error),
            onRetry: onRetry,
          );
        }
        if (!snap.hasData) {
          return _ErrorBox(
            message: trKey('mobileLegacyApiRequestFailed'),
            onRetry: onRetry,
          );
        }
        return builder(context, snap.data as T);
      },
    );
  }
}

String _safeErrorMessage(Object? error) {
  if (error is ApiException) {
    if (error.statusCode == 0) {
      return trKey('mobileLegacyApiRequestConnectionFailed');
    }
    if (error.statusCode == 401) {
      return trKey('mobileLegacyApiReturned401TheExpiredLocalSessionWas');
    }
    return trKey('mobileLegacyApiRequestFailed');
  }
  // TimeoutException, SocketException and package-specific transport errors
  // must not leak endpoint URLs or implementation details into the UI.
  return trKey('mobileLegacyApiRequestConnectionFailed');
}

/// Opaque work-area surface shared by the dashboard and collection screens.
/// It keeps the visual hierarchy stable in light/dark mode without relying on
/// blur or decorative gradients.
class LedgerCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final EdgeInsetsGeometry? margin;

  const LedgerCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.color,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: margin ?? EdgeInsets.zero,
      elevation: 0,
      color: color ?? scheme.surface,
      surfaceTintColor: Colors.transparent,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: scheme.outlineVariant),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class SectionHeader extends StatelessWidget {
  final String title;
  final Widget? trailing;

  const SectionHeader({super.key, required this.title, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        ?trailing,
      ],
    );
  }
}

class _ErrorBox extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorBox({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Semantics(
              label: message,
              liveRegion: true,
              container: true,
              child: Icon(
                Icons.cloud_off,
                size: 48,
                color: Theme.of(context).colorScheme.error,
              ),
            ),
            const SizedBox(height: 16),
            Semantics(
              liveRegion: true,
              child: Text(message, textAlign: TextAlign.center),
            ),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: onRetry,
              child: Text(trKey('mobileLegacyRetry')),
            ),
          ],
        ),
      ),
    );
  }
}

/// 空狀態提示，可提供清楚的下一步操作。
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String message;
  final String? title;
  final VoidCallback? onAction;
  final String? actionLabel;
  const EmptyState({
    super.key,
    required this.icon,
    required this.message,
    this.title,
    this.onAction,
    this.actionLabel,
  });

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme.onSurfaceVariant;
    return Semantics(
      container: true,
      label: title == null ? message : '$title. $message',
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 48, color: c),
              const SizedBox(height: 12),
              if (title != null) ...[
                Text(
                  title!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
              ],
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(color: c),
              ),
              if (onAction != null && actionLabel != null) ...[
                const SizedBox(height: 16),
                FilledButton.tonal(
                  onPressed: onAction,
                  child: Text(actionLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// 顯示 SnackBar 提示。成功／錯誤狀態以語義色與 live region 宣告，
/// 呼叫端仍可使用原本的 [toast(context, message)] API。
void toast(
  BuildContext context,
  String msg, {
  bool isError = false,
  bool isSuccess = false,
}) {
  final scheme = Theme.of(context).colorScheme;
  final background = isError
      ? scheme.errorContainer
      : isSuccess
      ? scheme.primaryContainer
      : scheme.inverseSurface;
  final foreground = isError
      ? scheme.onErrorContainer
      : isSuccess
      ? scheme.onPrimaryContainer
      : scheme.onInverseSurface;
  ScaffoldMessenger.of(context)
    ..clearSnackBars()
    ..showSnackBar(
      SnackBar(
        backgroundColor: background,
        content: Semantics(
          liveRegion: true,
          container: true,
          label: msg,
          child: Text(msg, style: TextStyle(color: foreground)),
        ),
      ),
    );
}

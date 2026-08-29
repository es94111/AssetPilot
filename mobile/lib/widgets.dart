import 'package:flutter/material.dart';

import 'api_client.dart';
import 'l10n.dart';
import 'theme.dart';

/// 統一的非同步載入畫面：處理 loading（骨架屏）/ error（含重試）/ 成功。
///
/// 若重新整理時 FutureBuilder 仍保留上一份資料，會優先顯示舊資料而非
/// 讓整頁閃成 spinner，降低金融資料畫面跳動；第一次載入才顯示骨架屏。
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
          return loadingBuilder?.call(context) ?? const SkeletonList();
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

/// 骨架屏基礎元素：柔和的閃爍色塊（尊重減少動態設定）。
class SkeletonBox extends StatefulWidget {
  final double width;
  final double height;
  final BorderRadius? radius;
  const SkeletonBox({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.radius,
  });

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
      value: 0.35,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 尊重系統「減少動態」：停用閃爍動畫，改為靜態灰塊。
    if (apReduceMotion(context)) {
      _controller.stop();
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHigh;
    final highlight = Theme.of(context).colorScheme.surfaceContainerLowest;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) => Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: Color.lerp(base, highlight, _controller.value * 0.5),
          borderRadius: widget.radius ?? ApRadius.rSm,
        ),
      ),
    );
  }
}

/// 通用清單骨架屏：模擬「卡片列」的節奏。
class SkeletonList extends StatelessWidget {
  final int rows;
  const SkeletonList({super.key, this.rows = 6});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        ApSpace.lg,
        ApSpace.lg,
        ApSpace.lg,
        ApSpace.xl,
      ),
      itemCount: rows,
      itemBuilder: (context, i) => Padding(
        padding: const EdgeInsets.only(bottom: ApSpace.md),
        child: LedgerCard(
          padding: const EdgeInsets.all(ApSpace.lg),
          child: Row(
            children: [
              SkeletonBox(width: 40, height: 40, radius: ApRadius.circle),
              const SizedBox(width: ApSpace.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonBox(
                      width: double.infinity,
                      height: 14,
                      radius: ApRadius.rSm,
                    ),
                    const SizedBox(height: ApSpace.sm),
                    FractionallySizedBox(
                      widthFactor: 0.6,
                      child: SkeletonBox(
                        width: double.infinity,
                        height: 12,
                        radius: ApRadius.rSm,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: ApSpace.md),
              SkeletonBox(width: 64, height: 14, radius: ApRadius.rSm),
            ],
          ),
        ),
      ),
    );
  }
}

/// 統計／摘要區塊骨架屏（Dashboard 等）。
class SkeletonSummary extends StatelessWidget {
  const SkeletonSummary({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        LedgerCard(
          padding: const EdgeInsets.all(ApSpace.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonBox(width: 96, height: 12, radius: ApRadius.rSm),
              const SizedBox(height: ApSpace.md),
              SkeletonBox(width: 180, height: 30, radius: ApRadius.rSm),
              const SizedBox(height: ApSpace.xl),
              Row(
                children: [
                  for (var i = 0; i < 2; i++) ...[
                    if (i > 0) const SizedBox(width: ApSpace.lg),
                    Expanded(
                      child: SkeletonBox(
                        width: double.infinity,
                        height: 40,
                        radius: ApRadius.rSm,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: ApSpace.xl),
        LedgerCard(
          padding: const EdgeInsets.all(ApSpace.xl),
          child: Column(
            children: [
              SkeletonBox(width: 120, height: 14, radius: ApRadius.rSm),
              const SizedBox(height: ApSpace.lg),
              SkeletonBox(
                width: double.infinity,
                height: 140,
                radius: ApRadius.rMd,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 玻璃質感卡片：統一的表面、邊框、陰影與按壓回饋容器。
///
/// 深色模式使用 surface + white/10 邊框；淺色模式使用 surface + 淡灰邊框與
/// 品牌色陰影。可用 [gradient] 做品牌漸層 hero 卡。
class LedgerCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final EdgeInsetsGeometry? margin;
  final Gradient? gradient;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;

  const LedgerCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(ApSpace.lg),
    this.color,
    this.margin,
    this.gradient,
    this.onTap,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final tokens = apTokens(context);
    final scheme = Theme.of(context).colorScheme;
    final radius = borderRadius ?? ApRadius.rLg;
    final isDark = scheme.brightness == Brightness.dark;
    // 暖中性兩層陰影（品牌規範：不用藍色陰影）——亮色為
    // `0 3px 12px` + `0 1px 3px` 暖棕；暗色單層加深即可。
    final shadows = isDark
        ? <BoxShadow>[
            BoxShadow(
              color: tokens.shadow,
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ]
        : <BoxShadow>[
            const BoxShadow(
              color: Color(0x0F3C2D1E), // rgba(60,45,30,.06)
              blurRadius: 12,
              offset: Offset(0, 3),
            ),
            BoxShadow(
              // 淡陰影層：rgba(60,45,30,.05)（0x0D ≈ .05 直接表達）。
              color: Color(0x0D3C2D1E),
              blurRadius: 3,
              offset: Offset(0, 1),
            ),
          ];
    final content = Padding(padding: padding, child: child);
    Widget card = DecoratedBox(
      decoration: BoxDecoration(
        color: gradient == null ? (color ?? scheme.surface) : null,
        gradient: gradient,
        borderRadius: radius,
        border: Border.all(color: tokens.glassBorder),
        boxShadow: shadows,
      ),
      child: content,
    );
    if (onTap != null) {
      card = Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: card,
        ),
      );
    }
    return Card(
      margin: margin ?? EdgeInsets.zero,
      elevation: 0,
      color: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      clipBehavior: Clip.antiAlias,
      shadowColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: radius),
      child: card,
    );
  }
}

/// 統一的區塊標題（可帶右側動作）。
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
            // 區塊標題用 display 襯線（中文字符自動 fallback 系統字）。
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        if (trailing != null) trailing!,
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
        padding: const EdgeInsets.all(ApSpace.xl),
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
            const SizedBox(height: ApSpace.lg),
            Semantics(
              liveRegion: true,
              child: Text(message, textAlign: TextAlign.center),
            ),
            const SizedBox(height: ApSpace.lg),
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
    final scheme = Theme.of(context).colorScheme;
    final tokens = apTokens(context);
    return Semantics(
      container: true,
      label: title == null ? message : '$title. $message',
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(ApSpace.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: tokens.glassTint,
                  shape: BoxShape.circle,
                  border: Border.all(color: tokens.glassBorder),
                ),
                child: Icon(icon, size: 32, color: scheme.onSurfaceVariant),
              ),
              const SizedBox(height: ApSpace.lg),
              if (title != null) ...[
                Text(
                  title!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: ApSpace.xs),
              ],
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(color: scheme.onSurfaceVariant),
              ),
              if (onAction != null && actionLabel != null) ...[
                const SizedBox(height: ApSpace.lg),
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

/// 錯誤／強調提示框（品牌規範：危險訊息用 danger 色）。
class NoticeBanner extends StatelessWidget {
  final String message;
  final ApNoticeKind kind;
  const NoticeBanner({super.key, required this.message, this.kind = ApNoticeKind.info});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = apTokens(context);
    final (bg, fg, icon) = switch (kind) {
      ApNoticeKind.success => (
        tokens.income.withValues(alpha: 0.12),
        tokens.income,
        Icons.check_circle_outline,
      ),
      ApNoticeKind.warning => (
        tokens.warning.withValues(alpha: 0.14),
        tokens.warning,
        Icons.warning_amber_rounded,
      ),
      ApNoticeKind.error => (
        scheme.errorContainer,
        scheme.onErrorContainer,
        Icons.error_outline,
      ),
      ApNoticeKind.info => (
        tokens.info.withValues(alpha: 0.12),
        tokens.info,
        Icons.info_outline,
      ),
    };
    return Container(
      padding: const EdgeInsets.all(ApSpace.md),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: ApRadius.rMd,
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: fg),
          const SizedBox(width: ApSpace.sm),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: fg, fontSize: 13, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

enum ApNoticeKind { info, success, warning, error }

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

/// 清單項目進場動畫：淡入＋上移，逐項延遲 [ApMotion.stagger]。
/// 尊重系統「減少動態」設定（直接顯示，不做位移）。
class StaggerIn extends StatefulWidget {
  final int index;
  final Widget child;
  const StaggerIn({super.key, required this.index, required this.child});

  @override
  State<StaggerIn> createState() => _StaggerInState();
}

class _StaggerInState extends State<StaggerIn>
    with SingleTickerProviderStateMixin {
  // 注意：initializer 不能呼叫 apReduceMotion(context)——它相依 MediaQuery，
  // 而 late final 欄位會在 initState 期間被首次求值，此時相依尚未建立
  // （debug 模式直接拋錯）。改在 didChangeDependencies 才讀取。
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: ApMotion.slow,
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (apReduceMotion(context)) {
      // 尊重系統「減少動態」：直接顯示，不做位移。
      _controller.value = 1;
      return;
    }
    // 上限 600ms 延遲，長清單不會無限遞增。
    final delay = Duration(milliseconds: (widget.index * 40).clamp(0, 600));
    Future<void>.delayed(delay, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (apReduceMotion(context)) return widget.child;
    final curved = CurvedAnimation(parent: _controller, curve: ApMotion.easeOut);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.04),
          end: Offset.zero,
        ).animate(curved),
        child: widget.child,
      ),
    );
  }
}

/// 數字／文字內容變化時的淡入更新（廉價的數字動畫替代）。
class AnimatedTextSwap extends StatelessWidget {
  final String text;
  final TextStyle? style;
  const AnimatedTextSwap({super.key, required this.text, this.style});

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: apReduceMotion(context) ? Duration.zero : ApMotion.base,
      switchInCurve: ApMotion.easeOut,
      child: Text(
        text,
        key: ValueKey(text),
        style: style,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

/// 標準頁面 Scaffold：AppBar + 安全區塊內距 + 統一頁面 padding。
class ApPage extends StatelessWidget {
  final String? title;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;
  final Widget body;
  final FloatingActionButton? floatingActionButton;

  const ApPage({
    super.key,
    this.title,
    this.actions,
    this.bottom,
    required this.body,
    this.floatingActionButton,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: title == null ? null : Text(title!), actions: actions, bottom: bottom),
      floatingActionButton: floatingActionButton,
      body: body,
    );
  }
}
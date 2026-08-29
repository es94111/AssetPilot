import 'package:flutter/material.dart';

import '../l10n.dart';
import '../theme.dart';

/// AssetPilot 品牌入場動畫畫面。
///
/// 於 App 啟動時顯示（見 app.dart 的 [RootGate]），用自訂動畫
/// 呈現品牌 logo（上升柱狀圖＋金幣＋趨勢線），播放完畢後回呼
/// [onDone] 讓上層切到實際首頁／登入畫面。
class SplashScreen extends StatefulWidget {
  final VoidCallback onDone;
  const SplashScreen({super.key, required this.onDone});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2300),
    )..forward();
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        widget.onDone();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // logo 彈跳
    final logoPop = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0, 0.5, curve: Curves.easeOutBack),
    );
    final fadeIn = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.3, 0.7, curve: Curves.easeOut),
    );
    final progress = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.5, 0.95, curve: Curves.easeInOut),
    );

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 暖夜漸層背景，呼應品牌「Warm Console」金融控制台風格。
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF141210), Color(0xFF1D1A16), Color(0xFF241712)],
              ),
            ),
          ),
          // 柔和的品牌光暈 blob：暖赭為主，松綠／赭金點綴。
          Positioned(
            top: -120,
            left: -100,
            child: _Blob(color: const Color(0xFFB0521C), size: 320),
          ),
          Positioned(
            bottom: -120,
            right: -100,
            child: _Blob(color: const Color(0xFF5F8D7A), size: 280),
          ),
          Positioned(
            top: 320,
            left: 40,
            child: _Blob(color: const Color(0xFFD98A4A), size: 220),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ScaleTransition(
                  scale: logoPop,
                  child: const _BrandLogo(),
                ),
                const SizedBox(height: 28),
                FadeTransition(
                  opacity: fadeIn,
                  child: Text(
                    'AssetPilot',
                    style: TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.w800,
                      fontFamily: apDisplayFontFamily,
                      color: const Color(0xFFECE7DE),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                FadeTransition(
                  opacity: fadeIn,
                  child: Text(
                    trKey('publicHomeTagline'),
                    style: const TextStyle(
                      fontSize: 13,
                      letterSpacing: 4,
                      color: Color(0x99ECE7DE),
                    ),
                  ),
                ),
                const SizedBox(height: 36),
                // 進度條，呼應「資產上升」意象。
                SizedBox(
                  width: 140,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: progress.value,
                      minHeight: 3,
                      color: const Color(0xFFE2A377),
                      backgroundColor: const Color(0x1AECE7DE),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 模糊光暈圓點。
class _Blob extends StatelessWidget {
  final Color color;
  final double size;
  const _Blob({required this.color, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 80),
        ],
      ),
    );
  }
}

/// 品牌 logo：上升趨勢柱狀圖 + 金幣 + 折線。
class _BrandLogo extends StatelessWidget {
  const _BrandLogo();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 104,
      height: 104,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          // 暖赭 135° hero 漸層（品牌規範）。
          colors: [Color(0xFF994215), Color(0xFFB0521C), Color(0xFFD98A4A)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFB0521C).withValues(alpha: 0.4),
            blurRadius: 30,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: CustomPaint(
        painter: const _LogoPainter(),
        child: const SizedBox.expand(),
      ),
    );
  }
}

/// 用 CustomPainter 重現品牌 logo（柱狀圖 + 折線 + 金幣）。
class _LogoPainter extends CustomPainter {
  const _LogoPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final paintBar = Paint()..color = Colors.white.withValues(alpha: 0.9);

    // 三根柱狀圖
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.10, h * 0.62, w * 0.16, h * 0.34),
        const Radius.circular(4),
      ),
      paintBar,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.34, h * 0.48, w * 0.16, h * 0.48),
        const Radius.circular(4),
      ),
      paintBar,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.58, h * 0.34, w * 0.16, h * 0.62),
        const Radius.circular(4),
      ),
      paintBar,
    );

    // 趨勢折線 + 箭頭
    final line = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.06
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path()
      ..moveTo(w * 0.12, h * 0.62)
      ..lineTo(w * 0.40, h * 0.42)
      ..lineTo(w * 0.68, h * 0.26);
    canvas.drawPath(path, line);

    // 金幣
    final coin = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFE5B567), Color(0xFFD98A4A)],
      ).createShader(
        Rect.fromCircle(center: Offset(w * 0.85, h * 0.74), radius: w * 0.16),
      );
    canvas.drawCircle(Offset(w * 0.85, h * 0.74), w * 0.16, coin);
    canvas.drawCircle(
      Offset(w * 0.85, h * 0.74),
      w * 0.16,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = w * 0.05,
    );
    final textPainter = TextPainter(
      text: const TextSpan(
        text: '\$',
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 22,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    textPainter.paint(
      canvas,
      Offset(
        w * 0.85 - textPainter.width / 2,
        h * 0.74 - textPainter.height / 2,
      ),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

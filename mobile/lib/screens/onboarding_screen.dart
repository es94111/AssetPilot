import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 第一次使用教學是否看過的旗標。改版調整教學內容時可遞增 key 版本讓舊用戶重看。
const _kOnboardingSeenKey = 'onboarding_seen_v1';

class _Slide {
  final IconData icon;
  final String title;
  final String body;
  const _Slide(this.icon, this.title, this.body);
}

/// 教學投影片內容（對齊底部導覽：首頁／記帳／股票／更多）。
const _slides = <_Slide>[
  _Slide(
    Icons.account_balance_wallet_outlined,
    '歡迎使用 AssetPilot',
    '你的個人資產管家——記帳、預算、台股投資與統計報表，一個 App 全部搞定。花一分鐘快速認識主要功能。',
  ),
  _Slide(
    Icons.receipt_long_outlined,
    '隨手記一筆',
    '在底部「記帳」分頁點右下角的「＋」即可新增收入或支出，支援多幣別與帳戶轉帳。交易往左滑可刪除、點一下可編輯。',
  ),
  _Slide(
    Icons.dashboard_outlined,
    '掌握收支全貌',
    '「首頁」依月份顯示收入、支出、淨額與支出分類圓餅圖，左右切換月份，一眼看懂錢花到哪裡。',
  ),
  _Slide(
    Icons.trending_up_outlined,
    '追蹤台股投資',
    '在「股票」分頁輸入股票代號（例如 2330）即可追蹤即時股價、未實現與已實現損益，系統還會自動同步除權息。',
  ),
  _Slide(
    Icons.menu,
    '預算、報表與更多',
    '到「更多」設定每月預算、查看統計報表、管理帳戶與分類，還能設定固定收支與報表通知。準備好了，開始記錄吧！',
  ),
];

/// 第一次使用引導：全螢幕可滑動的教學投影片。
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  /// 第一次使用時自動彈出（看過後就不再出現）。
  static Future<void> showIfFirstTime(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_kOnboardingSeenKey) ?? false) return;
    if (!context.mounted) return;
    await _push(context);
    await prefs.setBool(_kOnboardingSeenKey, true);
  }

  /// 從「更多 → 使用教學」手動開啟。
  static Future<void> show(BuildContext context) => _push(context);

  static Future<void> _push(BuildContext context) => Navigator.of(context).push(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => const OnboardingScreen(),
    ),
  );

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;

  bool get _isLast => _page == _slides.length - 1;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _next() {
    if (_isLast) {
      Navigator.of(context).pop();
    } else {
      _controller.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('跳過'),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                onPageChanged: (i) => setState(() => _page = i),
                itemCount: _slides.length,
                itemBuilder: (context, i) {
                  final s = _slides[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 128,
                          height: 128,
                          decoration: BoxDecoration(
                            color: cs.primaryContainer,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            s.icon,
                            size: 64,
                            color: cs.onPrimaryContainer,
                          ),
                        ),
                        const SizedBox(height: 36),
                        Text(
                          s.title,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          s.body,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: cs.onSurfaceVariant,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (int i = 0; i < _slides.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: i == _page ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: i == _page ? cs.primary : cs.outlineVariant,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            Padding(
              padding: const EdgeInsets.fromLTRB(32, 0, 32, 32),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _next,
                  child: Text(_isLast ? '開始使用' : '下一步'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

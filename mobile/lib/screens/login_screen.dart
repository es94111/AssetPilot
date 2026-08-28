import 'package:flutter/material.dart';

import '../api_client.dart';
import '../google_auth.dart';
import '../line_auth.dart';
import '../passkey_auth.dart';
import '../theme.dart';
import '../widgets/turnstile_widget.dart';
import '../l10n.dart';

class LoginScreen extends StatefulWidget {
  /// 登入成功後呼叫，由 AuthGate 切換到主畫面。
  final VoidCallback onLoggedIn;
  const LoginScreen({super.key, required this.onLoggedIn});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  String? _error;

  // 後端設定（來自 /api/config）
  bool _configLoading = true;
  bool _turnstileEnabled = false;
  String? _siteKey;
  bool _googleEnabled = false;
  String? _googleClientId;
  bool _googleLoading = false;
  bool _lineEnabled = false;
  String? _lineChannelId;
  bool _lineLoading = false;
  bool _passkeyLoading = false;

  // Turnstile 狀態
  String? _turnstileToken;
  int _turnstileNonce = 0; // 改變即強制重建 widget（重新取得 token）

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    setState(() => _configLoading = true);
    try {
      final cfg = await ApiClient.instance.config();
      if (!mounted) return;
      setState(() {
        _turnstileEnabled =
            cfg['turnstileEnabled'] == true &&
            (cfg['turnstileSiteKey'] is String);
        _siteKey = cfg['turnstileSiteKey'] as String?;
        _googleEnabled =
            cfg['googleCodeFlow'] == true && (cfg['googleClientId'] is String);
        _googleClientId = cfg['googleClientId'] as String?;
        _lineEnabled =
            cfg['lineCodeFlow'] == true && (cfg['lineChannelId'] is String);
        _lineChannelId = cfg['lineChannelId'] as String?;
        _turnstileToken = null;
        _turnstileNonce++;
      });
    } catch (_) {
      // 取不到設定（舊後端或網路問題）→ 當作無 Turnstile、不顯示提供者按鈕。
      if (!mounted) return;
      setState(() {
        _turnstileEnabled = false;
        _googleEnabled = false;
        _lineEnabled = false;
      });
    } finally {
      if (mounted) setState(() => _configLoading = false);
    }
  }

  void _resetTurnstile() => setState(() {
    _turnstileToken = null;
    _turnstileNonce++;
  });

  bool _requireTurnstile() {
    if (!_turnstileEnabled || _turnstileToken != null) return true;
    setState(
      () => _error = trKey('mobileLegacyCompleteTheVerificationBelowFirst'),
    );
    return false;
  }

  Future<void> _googleSignIn() async {
    if (_googleClientId == null) return;
    if (!_requireTurnstile()) return;
    final turnstileToken = _turnstileToken;
    setState(() {
      _googleLoading = true;
      _error = null;
    });
    try {
      await GoogleAuth.signIn(
        clientId: _googleClientId!,
        baseUrl: ApiClient.instance.baseUrl,
        turnstileToken: turnstileToken,
      );
      if (mounted) widget.onLoggedIn();
    } on ApiException catch (e) {
      if (!mounted) return; // await 期間畫面可能已被 dispose，避免 setState 崩潰
      setState(() => _error = e.message);
      if (_turnstileEnabled) _resetTurnstile();
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _error = trKey('mobileDynamicProviderLoginFailed', {
          'provider': 'Google',
          'error': e,
        }),
      );
      if (_turnstileEnabled) _resetTurnstile();
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  Future<void> _lineSignIn() async {
    if (_lineChannelId == null) return;
    if (!_requireTurnstile()) return;
    final turnstileToken = _turnstileToken;
    setState(() {
      _lineLoading = true;
      _error = null;
    });
    try {
      await LineAuth.signIn(
        channelId: _lineChannelId!,
        baseUrl: ApiClient.instance.baseUrl,
        turnstileToken: turnstileToken,
      );
      if (mounted) widget.onLoggedIn();
    } on ApiException catch (e) {
      if (!mounted) return; // await 期間畫面可能已被 dispose，避免 setState 崩潰
      setState(() => _error = e.message);
      if (_turnstileEnabled) _resetTurnstile();
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _error = trKey('mobileDynamicProviderLoginFailed', {
          'provider': 'LINE',
          'error': e,
        }),
      );
      if (_turnstileEnabled) _resetTurnstile();
    } finally {
      if (mounted) setState(() => _lineLoading = false);
    }
  }

  Future<void> _passkeySignIn() async {
    if (!_requireTurnstile()) return;
    final turnstileToken = _turnstileToken;
    setState(() {
      _passkeyLoading = true;
      _error = null;
    });
    try {
      await PasskeyAuth.signIn(
        baseUrl: ApiClient.instance.baseUrl,
        turnstileToken: turnstileToken,
      );
      if (mounted) widget.onLoggedIn();
    } on ApiException catch (e) {
      if (!mounted) return; // await 期間畫面可能已被 dispose，避免 setState 崩潰
      setState(() => _error = e.message);
      if (_turnstileEnabled) _resetTurnstile();
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _error = trKey('mobileDynamicProviderLoginFailed', {
          'provider': 'Passkey',
          'error': e,
        }),
      );
      if (_turnstileEnabled) _resetTurnstile();
    } finally {
      if (mounted) setState(() => _passkeyLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = apTokens(context);
    return Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: tokens.pageGradient,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(ApSpace.xl),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(
                      Icons.account_balance_wallet_rounded,
                      size: 64,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(height: ApSpace.lg),
                    Text(
                      'AssetPilot',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: ApSpace.xs),
                    Text(
                      trKey('mobileLegacyPersonalFinanceAndroidApp'),
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: ApSpace.xxl),
                    if (_turnstileEnabled && _siteKey != null) ...[
                      const SizedBox(height: ApSpace.lg),
                      TurnstileWidget(
                        key: ValueKey('ts_$_turnstileNonce'),
                        siteKey: _siteKey!,
                        baseUrl: ApiClient.instance.baseUrl,
                        action: 'login',
                        onToken: (t) => setState(() {
                          _turnstileToken = t;
                          _error = null;
                        }),
                        onError: (_) => setState(() => _turnstileToken = null),
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: ApSpace.lg),
                      Container(
                        padding: const EdgeInsets.all(ApSpace.md),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.errorContainer,
                          borderRadius: ApRadius.rMd,
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.error_outline,
                              color: theme.colorScheme.onErrorContainer,
                              size: 20,
                            ),
                            const SizedBox(width: ApSpace.sm),
                            Expanded(
                              child: Text(
                                _error!,
                                style: TextStyle(
                                  color: theme.colorScheme.onErrorContainer,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: ApSpace.xl),
                    OutlinedButton.icon(
                      onPressed: _passkeyLoading ? null : _passkeySignIn,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        backgroundColor: theme.colorScheme.surface.withValues(
                          alpha: 0.85,
                        ),
                      ),
                      icon: _passkeyLoading
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.fingerprint_rounded),
                      label: Text(trKey('authPasskeyButton')),
                    ),
                    if (_googleEnabled) ...[
                      const SizedBox(height: ApSpace.md),
                      OutlinedButton.icon(
                        onPressed: _googleLoading ? null : _googleSignIn,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          backgroundColor: theme.colorScheme.surface.withValues(
                            alpha: 0.85,
                          ),
                        ),
                        icon: _googleLoading
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.account_circle_outlined),
                        label: Text(trKey('authGoogleButton')),
                      ),
                    ],
                    if (_lineEnabled) ...[
                      const SizedBox(height: ApSpace.md),
                      OutlinedButton.icon(
                        onPressed: _lineLoading ? null : _lineSignIn,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          backgroundColor: theme.colorScheme.surface.withValues(
                            alpha: 0.85,
                          ),
                        ),
                        icon: _lineLoading
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.chat_bubble_outline_rounded),
                        label: Text(trKey('authLineButton')),
                      ),
                    ],
                    if (_configLoading)
                      const Padding(
                        padding: EdgeInsets.only(top: ApSpace.md),
                        child: Center(
                          child: SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

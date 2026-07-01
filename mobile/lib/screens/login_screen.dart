import 'package:flutter/material.dart';

import '../api_client.dart';
import '../google_auth.dart';
import '../line_auth.dart';
import '../passkey_auth.dart';
import '../widgets/turnstile_widget.dart';
import 'register_screen.dart';
import '../l10n.dart';

class LoginScreen extends StatefulWidget {
  /// 登入成功後呼叫，由 AuthGate 切換到主畫面。
  final VoidCallback onLoggedIn;
  const LoginScreen({super.key, required this.onLoggedIn});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _obscure = true;
  bool _loading = false;
  String? _error;

  // 後端設定（來自 /api/config）
  bool _configLoading = true;
  bool _turnstileEnabled = false;
  String? _siteKey;
  bool _registrationEnabled = false;
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

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
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
        _registrationEnabled = cfg['registrationEnabled'] == true;
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
      // 取不到設定（舊後端或網路問題）→ 當作無 Turnstile、不顯示註冊／Google，
      // 仍允許嘗試登入；若後端其實要求驗證，會回傳對應訊息。
      if (!mounted) return;
      setState(() {
        _turnstileEnabled = false;
        _registrationEnabled = false;
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

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_requireTurnstile()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiClient.instance.login(
        _email.text.trim(),
        _password.text,
        turnstileToken: _turnstileToken,
      );
      if (mounted) widget.onLoggedIn();
    } on ApiException catch (e) {
      if (!mounted) return; // await 期間畫面可能已被 dispose，避免 setState 崩潰
      setState(() => _error = e.message);
      if (_turnstileEnabled) _resetTurnstile(); // token 單次使用，失敗後重取
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _error = trKey('mobileDynamicUnexpectedError', {'value': e}),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _goRegister() async {
    final ok = await Navigator.of(
      context,
    ).push<bool>(MaterialPageRoute(builder: (_) => RegisterScreen()));
    if (ok == true && mounted) widget.onLoggedIn();
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
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(
                      Icons.account_balance_wallet_rounded,
                      size: 64,
                      color: theme.colorScheme.primary,
                    ),
                    SizedBox(height: 16),
                    Text(
                      'AssetPilot',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      trKey('mobileLegacyPersonalFinanceAndroidApp'),
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    SizedBox(height: 32),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      decoration: InputDecoration(
                        labelText: trKey('settingsAccountEmail'),
                        prefixIcon: Icon(Icons.email_outlined),
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) => (v == null || !v.contains('@'))
                          ? trKey('mobileLegacyEnterAValidEmailAddress')
                          : null,
                    ),
                    SizedBox(height: 16),
                    TextFormField(
                      controller: _password,
                      obscureText: _obscure,
                      decoration: InputDecoration(
                        labelText: trKey('authPasswordLabel'),
                        prefixIcon: Icon(Icons.lock_outline),
                        border: OutlineInputBorder(),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) => (v == null || v.isEmpty)
                          ? trKey('authPasswordPlaceholder')
                          : null,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    if (_turnstileEnabled && _siteKey != null) ...[
                      SizedBox(height: 16),
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
                      SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.errorContainer,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.error_outline,
                              color: theme.colorScheme.onErrorContainer,
                              size: 20,
                            ),
                            SizedBox(width: 8),
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
                    SizedBox(height: 24),
                    FilledButton(
                      onPressed: _loading ? null : _submit,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: _loading
                          ? SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(trKey('authLoginTab')),
                    ),
                    SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: (_passkeyLoading || _loading)
                          ? null
                          : _passkeySignIn,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      icon: _passkeyLoading
                          ? SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(Icons.fingerprint_rounded),
                      label: Text(trKey('authPasskeyButton')),
                    ),
                    if (_googleEnabled) ...[
                      SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: (_googleLoading || _loading)
                            ? null
                            : _googleSignIn,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        icon: _googleLoading
                            ? SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Icon(Icons.account_circle_outlined),
                        label: Text(trKey('authGoogleButton')),
                      ),
                    ],
                    if (_lineEnabled) ...[
                      SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: (_lineLoading || _loading)
                            ? null
                            : _lineSignIn,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        icon: _lineLoading
                            ? SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Icon(Icons.chat_bubble_outline_rounded),
                        label: Text(trKey('authLineButton')),
                      ),
                    ],
                    if (_configLoading)
                      Padding(
                        padding: EdgeInsets.only(top: 12),
                        child: Center(
                          child: SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                      )
                    else if (_registrationEnabled)
                      TextButton(
                        onPressed: _loading ? null : _goRegister,
                        child: Text(
                          trKey('mobileLegacyDonTHaveAnAccountSignUp'),
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

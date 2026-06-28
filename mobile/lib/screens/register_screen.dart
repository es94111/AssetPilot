import 'package:flutter/material.dart';

import '../api_client.dart';
import '../l10n.dart';

/// 註冊畫面。註冊成功後後端直接發 Cookie（自動登入），以 `pop(true)` 回到登入頁
/// 由其觸發進入主畫面。
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _name = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _name.dispose();
    _password.dispose();
    super.dispose();
  }

  String? _validatePassword(String? v) {
    final s = v ?? '';
    if (s.length < 8) {
      return trKey('mobileLegacyPasswordMustBeAtLeast8Characters');
    }
    final ok =
        RegExp(r'[A-Z]').hasMatch(s) &&
        RegExp(r'[a-z]').hasMatch(s) &&
        RegExp(r'\d').hasMatch(s) &&
        RegExp(r'[^A-Za-z0-9]').hasMatch(s);
    if (!ok) {
      return trKey(
        'mobileLegacyIncludeUppercaseLowercaseNumbersAndSymbols21fb52f3',
      );
    }
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiClient.instance.register(
        email: _email.text.trim(),
        password: _password.text,
        displayName: _name.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return; // await 期間畫面可能已被 dispose，避免 setState 崩潰
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _error = trKey('mobileDynamicUnexpectedError', {'value': e}),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(trKey('authRegisterTab'))),
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
                      controller: _name,
                      decoration: InputDecoration(
                        labelText: trKey('authDisplayNameLabel'),
                        prefixIcon: Icon(Icons.badge_outlined),
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? trKey('mobileLegacyEnterADisplayName')
                          : null,
                    ),
                    SizedBox(height: 16),
                    TextFormField(
                      controller: _password,
                      obscureText: _obscure,
                      decoration: InputDecoration(
                        labelText: trKey('authPasswordLabel'),
                        helperText: trKey(
                          'mobileLegacyAtLeast8CharactersWithUppercaseLowercaseNumbers',
                        ),
                        helperMaxLines: 2,
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
                      validator: _validatePassword,
                    ),
                    if (_error != null) ...[
                      SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.errorContainer,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _error!,
                          style: TextStyle(
                            color: theme.colorScheme.onErrorContainer,
                          ),
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
                          : Text(trKey('mobileLegacySignUpAndSignIn')),
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

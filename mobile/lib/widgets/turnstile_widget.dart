import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// 在 WebView 內呈現 Cloudflare Turnstile（真人驗證），完成後以 token 回呼。
///
/// 以 [WebViewController.loadHtmlString] 的 `baseUrl` 帶入後端網址，使 Turnstile
/// 取得的 document hostname 與 site key 設定的允許網域一致，通過網域檢查。
class TurnstileWidget extends StatefulWidget {
  final String siteKey;

  /// 後端網址（base URL），作為 WebView document 的 origin。
  final String baseUrl;

  /// Turnstile action，需與後端驗證的 expectedAction 一致（登入為 `login`）。
  final String action;

  final ValueChanged<String> onToken;
  final ValueChanged<String>? onError;

  const TurnstileWidget({
    super.key,
    required this.siteKey,
    required this.baseUrl,
    required this.onToken,
    this.action = 'login',
    this.onError,
  });

  @override
  State<TurnstileWidget> createState() => _TurnstileWidgetState();
}

class _TurnstileWidgetState extends State<TurnstileWidget> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..addJavaScriptChannel('TurnstileToken',
          onMessageReceived: (m) => widget.onToken(m.message))
      ..addJavaScriptChannel('TurnstileError',
          onMessageReceived: (m) => widget.onError?.call(m.message))
      ..loadHtmlString(_html, baseUrl: widget.baseUrl);
  }

  String get _html => '''
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit" async defer></script>
<style>
  html,body{margin:0;padding:0;background:transparent;}
  #cf{display:flex;justify-content:center;padding:4px 0;}
</style>
</head>
<body>
<div id="cf"></div>
<script>
  function onTurnstileLoad(){
    turnstile.render('#cf', {
      sitekey: '${widget.siteKey}',
      action: '${widget.action}',
      callback: function(token){ TurnstileToken.postMessage(token); },
      'error-callback': function(e){ TurnstileError.postMessage('error'); },
      'expired-callback': function(){ TurnstileError.postMessage('expired'); },
      'timeout-callback': function(){ TurnstileError.postMessage('timeout'); }
    });
  }
</script>
</body>
</html>
''';

  @override
  Widget build(BuildContext context) {
    // Turnstile 標準 widget 約 65px 高；留一點空間給載入與訊息。
    return SizedBox(
      height: 80,
      child: WebViewWidget(controller: _controller),
    );
  }
}

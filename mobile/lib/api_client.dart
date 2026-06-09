import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// API 呼叫失敗時拋出，message 已在地化為繁體中文。
class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

/// 與 AssetPilot Next.js 後端溝通的單例 client。
///
/// 後端認證採 httpOnly Cookie（JWT `authToken`）。Dart 的 [http] 套件不會自動
/// 管理 Cookie，因此這裡手動從登入回應擷取 `Set-Cookie`，並在後續請求帶回
/// `Cookie` 標頭。base URL 與 Cookie 皆持久化於 [SharedPreferences]。
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _kBaseUrl = 'baseUrl';
  static const _kCookie = 'authCookie';

  /// Android 模擬器以 `10.0.2.2` 對應宿主機的 `localhost`。
  /// 實機請改為後端的區網 IP 或網域（可在登入頁的「後端設定」修改）。
  static const defaultBaseUrl = 'http://10.0.2.2:3000';

  String _baseUrl = defaultBaseUrl;
  String? _cookie; // 例："authToken=xxxxx"

  String get baseUrl => _baseUrl;
  bool get isLoggedIn => _cookie != null;

  /// App 啟動時呼叫一次，載入持久化的設定。
  Future<void> init() async {
    final p = await SharedPreferences.getInstance();
    _baseUrl = p.getString(_kBaseUrl) ?? defaultBaseUrl;
    _cookie = p.getString(_kCookie);
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    final p = await SharedPreferences.getInstance();
    await p.setString(_kBaseUrl, _baseUrl);
  }

  Uri _uri(String path) => Uri.parse('$_baseUrl$path');

  Map<String, String> _headers({bool json = false}) => {
        if (json) 'Content-Type': 'application/json',
        'Cookie': ?_cookie,
      };

  /// 從回應擷取 `authToken` Cookie。用 regex 只抓 authToken 值，
  /// 避免 `Expires=Wed, 09 Jun ...` 內的逗號干擾解析。
  void _captureCookie(http.Response res) {
    final raw = res.headers['set-cookie'];
    if (raw == null) return;
    final m = RegExp(r'authToken=([^;,\s]+)').firstMatch(raw);
    if (m != null) _cookie = 'authToken=${m.group(1)}';
  }

  Future<void> _persistCookie() async {
    final p = await SharedPreferences.getInstance();
    if (_cookie == null) {
      await p.remove(_kCookie);
    } else {
      await p.setString(_kCookie, _cookie!);
    }
  }

  /// 以電子郵件密碼登入。成功後 Cookie 已儲存。
  Future<void> login(String email, String password) async {
    late http.Response res;
    try {
      res = await http
          .post(
            _uri('/api/auth/login'),
            headers: _headers(json: true),
            body: jsonEncode({'email': email, 'password': password}),
          )
          .timeout(const Duration(seconds: 20));
    } catch (e) {
      throw ApiException(0, '無法連線到後端（$_baseUrl）：$e');
    }

    switch (res.statusCode) {
      case 200:
        _captureCookie(res);
        if (_cookie == null) {
          throw ApiException(200, '登入回應未包含認證 Cookie，請確認後端設定');
        }
        await _persistCookie();
        return;
      case 401:
        throw ApiException(401, '電子郵件或密碼錯誤');
      case 429:
        throw ApiException(429, '登入嘗試過於頻繁，請稍後再試');
      default:
        throw ApiException(res.statusCode, '登入失敗（HTTP ${res.statusCode}）');
    }
  }

  Future<void> logout() async {
    try {
      await http
          .post(_uri('/api/auth/logout'), headers: _headers())
          .timeout(const Duration(seconds: 10));
    } catch (_) {
      // 即使後端登出失敗，本地仍清除 Cookie。
    }
    _cookie = null;
    await _persistCookie();
  }

  /// 取得目前登入使用者；401 時清除本地 Cookie。
  Future<Map<String, dynamic>> me() async {
    final res = await _get('/api/auth/me');
    final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    return (body['user'] as Map).cast<String, dynamic>();
  }

  /// 取得帳戶清單（含餘額）。
  Future<List<dynamic>> accounts() async {
    final res = await _get('/api/accounts');
    return jsonDecode(utf8.decode(res.bodyBytes)) as List<dynamic>;
  }

  Future<http.Response> _get(String path) async {
    late http.Response res;
    try {
      res = await http
          .get(_uri(path), headers: _headers())
          .timeout(const Duration(seconds: 20));
    } catch (e) {
      throw ApiException(0, '無法連線到後端（$_baseUrl）：$e');
    }
    if (res.statusCode == 401) {
      _cookie = null;
      await _persistCookie();
      throw ApiException(401, '登入已過期，請重新登入');
    }
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, '請求失敗（HTTP ${res.statusCode}）');
    }
    return res;
  }
}

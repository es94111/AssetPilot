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

  /// 預設正式後台；使用者可於登入頁或設定頁改成自架的位址。
  /// 本機開發可改 `http://10.0.2.2:3000`（模擬器對應宿主機 localhost）。
  static const defaultBaseUrl = 'https://asset.shao.one';

  String _baseUrl = defaultBaseUrl;
  String? _cookie; // 例："authToken=xxxxx"

  String get baseUrl => _baseUrl;
  bool get isLoggedIn => _cookie != null;

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

  // ── 低階請求 ────────────────────────────────────────────────

  Uri _uri(String path) => Uri.parse('$_baseUrl$path');

  Map<String, String> _headers({bool json = false}) => {
        if (json) 'Content-Type': 'application/json',
        'Cookie': ?_cookie,
      };

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

  /// 統一發送請求，回傳已解碼的 JSON（Map 或 List）。
  Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
  }) async {
    final hasBody = body != null;
    late http.Response res;
    try {
      final uri = _uri(path);
      final headers = _headers(json: hasBody);
      final encoded = hasBody ? jsonEncode(body) : null;
      final c = http.Client();
      try {
        switch (method) {
          case 'GET':
            res = await c.get(uri, headers: headers).timeout(_timeout);
            break;
          case 'POST':
            res = await c
                .post(uri, headers: headers, body: encoded)
                .timeout(_timeout);
            break;
          case 'PUT':
            res = await c
                .put(uri, headers: headers, body: encoded)
                .timeout(_timeout);
            break;
          case 'DELETE':
            res = await c
                .delete(uri, headers: headers, body: encoded)
                .timeout(_timeout);
            break;
          default:
            throw ArgumentError('未知的 HTTP method: $method');
        }
      } finally {
        c.close();
      }
    } catch (e) {
      throw ApiException(0, '無法連線到後端（$_baseUrl）：$e');
    }

    if (res.statusCode == 401) {
      _cookie = null;
      await _persistCookie();
      throw ApiException(401, '登入已過期，請重新登入');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, _errorMessage(res));
    }
    if (res.bodyBytes.isEmpty) return null;
    return jsonDecode(utf8.decode(res.bodyBytes));
  }

  static const _timeout = Duration(seconds: 25);

  String _errorMessage(http.Response res) {
    try {
      final body = jsonDecode(utf8.decode(res.bodyBytes));
      if (body is Map && body['error'] != null) return '${body['error']}';
    } catch (_) {}
    return '請求失敗（HTTP ${res.statusCode}）';
  }

  Future<Map<String, dynamic>> _getMap(String path) async =>
      (await _send('GET', path) as Map).cast<String, dynamic>();

  Future<List<dynamic>> _getList(String path) async {
    final r = await _send('GET', path);
    if (r is List) return r;
    if (r is Map && r['data'] is List) return r['data'] as List;
    return const [];
  }

  // ── 認證 ────────────────────────────────────────────────────

  Future<void> login(String email, String password) async {
    late http.Response res;
    try {
      res = await http
          .post(
            _uri('/api/auth/login'),
            headers: _headers(json: true),
            body: jsonEncode({'email': email, 'password': password}),
          )
          .timeout(_timeout);
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
      await _send('POST', '/api/auth/logout');
    } catch (_) {}
    _cookie = null;
    await _persistCookie();
  }

  Future<Map<String, dynamic>> me() async {
    final body = await _getMap('/api/auth/me');
    return (body['user'] as Map).cast<String, dynamic>();
  }

  Future<void> updateDisplayName(String name) =>
      _send('PUT', '/api/account/settings/display-name',
          body: {'displayName': name});

  // ── 帳戶 ────────────────────────────────────────────────────

  Future<List<dynamic>> accounts() => _getList('/api/accounts');

  Future<void> createAccount(Map<String, dynamic> body) =>
      _send('POST', '/api/accounts', body: body);

  Future<void> updateAccount(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/accounts/$id', body: body);

  Future<void> deleteAccount(String id) =>
      _send('DELETE', '/api/accounts/$id');

  // ── 分類 ────────────────────────────────────────────────────

  Future<List<dynamic>> categories() => _getList('/api/categories');

  Future<void> createCategory(Map<String, dynamic> body) =>
      _send('POST', '/api/categories', body: body);

  Future<void> updateCategory(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/categories/$id', body: body);

  Future<void> deleteCategory(String id) =>
      _send('DELETE', '/api/categories/$id');

  // ── 交易 ────────────────────────────────────────────────────

  Future<List<dynamic>> transactions({
    String? dateFrom,
    String? dateTo,
    String? type,
    int pageSize = 100,
  }) {
    final q = <String, String>{'pageSize': '$pageSize', 'sort': 'date_desc'};
    if (dateFrom != null) q['dateFrom'] = dateFrom;
    if (dateTo != null) q['dateTo'] = dateTo;
    if (type != null && type != 'all') q['type'] = type;
    final qs = q.entries.map((e) => '${e.key}=${e.value}').join('&');
    return _getList('/api/transactions?$qs');
  }

  Future<void> createTransaction(Map<String, dynamic> body) =>
      _send('POST', '/api/transactions', body: body);

  Future<void> updateTransaction(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/transactions/$id', body: body);

  Future<void> deleteTransaction(String id) =>
      _send('DELETE', '/api/transactions/$id');

  Future<void> transfer(Map<String, dynamic> body) =>
      _send('POST', '/api/transactions/transfer', body: body);

  // ── 儀表板 ──────────────────────────────────────────────────

  Future<Map<String, dynamic>> dashboard(String yearMonth) =>
      _getMap('/api/dashboard?ym=$yearMonth');

  // ── 預算 ────────────────────────────────────────────────────

  Future<List<dynamic>> budgets(String yearMonth) =>
      _getList('/api/budgets?yearMonth=$yearMonth');

  Future<void> createBudget(Map<String, dynamic> body) =>
      _send('POST', '/api/budgets', body: body);

  Future<void> updateBudget(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/budgets/$id', body: body);

  Future<void> deleteBudget(String id) => _send('DELETE', '/api/budgets/$id');

  // ── 固定收支 ────────────────────────────────────────────────

  Future<List<dynamic>> recurring() => _getList('/api/recurring');

  Future<void> createRecurring(Map<String, dynamic> body) =>
      _send('POST', '/api/recurring', body: body);

  Future<void> deleteRecurring(String id) =>
      _send('DELETE', '/api/recurring/$id');

  Future<void> toggleRecurring(String id) =>
      _send('POST', '/api/recurring/$id/toggle');

  // ── 股票 ────────────────────────────────────────────────────

  Future<Map<String, dynamic>> stocks() => _getMap('/api/stocks');

  Future<void> createStock(Map<String, dynamic> body) =>
      _send('POST', '/api/stocks', body: body);

  Future<void> deleteStock(String id) => _send('DELETE', '/api/stocks/$id');

  Future<List<dynamic>> stockTransactions() =>
      _getList('/api/stock-transactions');

  Future<void> createStockTransaction(Map<String, dynamic> body) =>
      _send('POST', '/api/stock-transactions', body: body);

  Future<void> deleteStockTransaction(String id) =>
      _send('DELETE', '/api/stock-transactions/$id');

  Future<List<dynamic>> stockDividends() => _getList('/api/stock-dividends');

  Future<List<dynamic>> stockRealized() => _getList('/api/stock-realized');

  // ── 報表 ────────────────────────────────────────────────────

  Future<Map<String, dynamic>> reports({
    required String type,
    required String from,
    required String to,
  }) =>
      _getMap('/api/reports?type=$type&from=$from&to=$to');

  // ── 匯率 ────────────────────────────────────────────────────

  Future<List<dynamic>> exchangeRates() => _getList('/api/exchange-rates');
}

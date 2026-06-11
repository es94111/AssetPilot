import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'play_integrity.dart';

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

  static const _kCookie = 'authCookie';

  /// 固定正式後台；App 不提供使用者自行修改，避免 OAuth/CSRF 設定不一致。
  static const defaultBaseUrl = 'https://asset.shao.one';

  String _baseUrl = defaultBaseUrl;
  String? _cookie; // 例："authToken=xxxxx"
  final ValueNotifier<bool> authState = ValueNotifier(false);

  String get baseUrl => _baseUrl;
  bool get isLoggedIn => _cookie != null;

  /// 顯示受認證保護的媒體（如交易照片）時，提供給 `Image.network` 的標頭。
  /// `/file` 端點走與一般 GET 相同的 Cookie 認證。
  Map<String, String> mediaHeaders() => _headers();

  /// 交易附件原圖的完整 URL，供 `Image.network` 搭配 [mediaHeaders] 載入。
  String attachmentFileUrl(String txId, String attachmentId) =>
      '$_baseUrl/api/transactions/$txId/attachments/$attachmentId/file';

  Future<void> init() async {
    final p = await SharedPreferences.getInstance();
    _baseUrl = defaultBaseUrl;
    await p.remove('baseUrl');
    _cookie = p.getString(_kCookie);
    authState.value = isLoggedIn;
  }

  // ── 低階請求 ────────────────────────────────────────────────

  Uri _uri(String path) => Uri.parse('$_baseUrl$path');

  Map<String, String> _headers({bool json = false}) => {
    if (json) 'Content-Type': 'application/json',
    // 後端對帶 cookie 的寫入請求做 CSRF 來源檢查（middleware）。原生 App 不會
    // 自動帶 Origin，缺少時 isOriginAllowed('') 會回 false → 403。送出與後端
    // 同源的 Origin 讓寫入操作通過 CSRF 防護。
    'Origin': _baseUrl,
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

  Future<void> _clearAuth() async {
    _cookie = null;
    await _persistCookie();
    authState.value = false;
  }

  Future<void> _persistLogin() async {
    await _persistCookie();
    authState.value = isLoggedIn;
  }

  /// 統一發送請求，回傳已解碼的 JSON（Map 或 List）。
  Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
    Duration? timeout,
  }) async {
    final hasBody = body != null;
    final t = timeout ?? _timeout;
    late http.Response res;
    try {
      final uri = _uri(path);
      final headers = _headers(json: hasBody);
      final encoded = hasBody ? jsonEncode(body) : null;
      final c = http.Client();
      try {
        switch (method) {
          case 'GET':
            res = await c.get(uri, headers: headers).timeout(t);
            break;
          case 'POST':
            res = await c
                .post(uri, headers: headers, body: encoded)
                .timeout(t);
            break;
          case 'PUT':
            res = await c
                .put(uri, headers: headers, body: encoded)
                .timeout(t);
            break;
          case 'DELETE':
            res = await c
                .delete(uri, headers: headers, body: encoded)
                .timeout(t);
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
      await _clearAuth();
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

  /// 後端公開設定（是否開放註冊、是否啟用 Turnstile、site key…）。
  Future<Map<String, dynamic>> config() => _getMap('/api/config');

  /// 取得一次性 Play Integrity nonce（登入／註冊前向後端索取）。
  Future<String> integrityNonce() async {
    final m = await _getMap('/api/app/integrity/nonce');
    return '${m['nonce'] ?? ''}';
  }

  /// 取得 Play Integrity 欄位（nonce + token）併入認證請求 body。
  /// 軟性：任何失敗都回空 Map，不阻斷登入／註冊。
  Future<Map<String, String>> _integrityFields() async {
    try {
      final nonce = await integrityNonce();
      if (nonce.isEmpty) return const {};
      final token = await PlayIntegrity.requestToken(nonce);
      if (token == null) return const {};
      return {'integrityNonce': nonce, 'integrityToken': token};
    } catch (_) {
      return const {};
    }
  }

  Future<void> login(
    String email,
    String password, {
    String? turnstileToken,
  }) async {
    final integrity = await _integrityFields();
    late http.Response res;
    try {
      res = await http
          .post(
            _uri('/api/auth/login'),
            headers: _headers(json: true),
            body: jsonEncode({
              'email': email,
              'password': password,
              'turnstileToken': ?turnstileToken,
              ...integrity,
            }),
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
        await _persistLogin();
        return;
      case 401:
        throw ApiException(401, '電子郵件或密碼錯誤');
      case 403:
        throw ApiException(403, _errorMessage(res)); // 多半是真人驗證失敗
      case 429:
        throw ApiException(429, _errorMessage(res));
      default:
        throw ApiException(res.statusCode, '登入失敗（HTTP ${res.statusCode}）');
    }
  }

  /// 註冊並自動登入（後端成功時直接發 Cookie）。註冊端點不需 Turnstile。
  Future<void> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    final integrity = await _integrityFields();
    late http.Response res;
    try {
      res = await http
          .post(
            _uri('/api/auth/register'),
            headers: _headers(json: true),
            body: jsonEncode({
              'email': email,
              'password': password,
              'displayName': displayName,
              ...integrity,
            }),
          )
          .timeout(_timeout);
    } catch (e) {
      throw ApiException(0, '無法連線到後端（$_baseUrl）：$e');
    }
    if (res.statusCode == 200 || res.statusCode == 201) {
      _captureCookie(res);
      if (_cookie == null) {
        throw ApiException(200, '註冊回應未包含認證 Cookie，請確認後端設定');
      }
      await _persistLogin();
      return;
    }
    throw ApiException(res.statusCode, _errorMessage(res));
  }

  /// 取得 Google OAuth 一次性 state（防 CSRF；後端會記住並於登入時核銷）。
  Future<String> googleState() async {
    final m = await _getMap('/api/auth/google/state');
    final s = m['state'];
    if (s == null) throw ApiException(0, '無法建立 Google 登入狀態');
    return '$s';
  }

  /// 以授權碼換登入（後端用 client_secret 與 redirectUri 向 Google 兌換）。
  Future<void> googleLogin({
    required String code,
    required String redirectUri,
    required String state,
  }) async {
    final integrity = await _integrityFields();
    late http.Response res;
    try {
      res = await http
          .post(
            _uri('/api/auth/google'),
            headers: _headers(json: true),
            body: jsonEncode({
              'code': code,
              'redirect_uri': redirectUri,
              'state': state,
              ...integrity,
            }),
          )
          .timeout(_timeout);
    } catch (e) {
      throw ApiException(0, '無法連線到後端（$_baseUrl）：$e');
    }
    if (res.statusCode == 200) {
      _captureCookie(res);
      if (_cookie == null) {
        throw ApiException(200, 'Google 登入回應未包含認證 Cookie');
      }
      await _persistLogin();
      return;
    }
    throw ApiException(res.statusCode, _errorMessage(res));
  }

  Future<Map<String, String>> lineState() async {
    final m = await _getMap('/api/auth/line/state?flow=login');
    return {'state': '${m['state'] ?? ''}', 'nonce': '${m['nonce'] ?? ''}'};
  }

  Future<void> lineLogin({
    required String code,
    required String redirectUri,
    required String state,
  }) async {
    late http.Response res;
    try {
      res = await http
          .post(
            _uri('/api/auth/line'),
            headers: _headers(json: true),
            body: jsonEncode({
              'code': code,
              'redirect_uri': redirectUri,
              'state': state,
            }),
          )
          .timeout(_timeout);
    } catch (e) {
      throw ApiException(0, '無法連線到後端（$_baseUrl）：$e');
    }
    if (res.statusCode == 200) {
      _captureCookie(res);
      if (_cookie == null) {
        throw ApiException(200, 'LINE 登入回應未包含認證 Cookie');
      }
      await _persistLogin();
      return;
    }
    throw ApiException(res.statusCode, _errorMessage(res));
  }

  Future<void> exchangeAppAuthTicket(String ticket) async {
    late http.Response res;
    try {
      res = await http
          .post(
            _uri('/api/app/auth-ticket/exchange'),
            headers: _headers(json: true),
            body: jsonEncode({'ticket': ticket}),
          )
          .timeout(_timeout);
    } catch (e) {
      throw ApiException(0, '無法連線到後端（$_baseUrl）：$e');
    }
    if (res.statusCode == 200) {
      _captureCookie(res);
      if (_cookie == null) {
        throw ApiException(200, 'App 登入回應未包含認證 Cookie');
      }
      await _persistLogin();
      return;
    }
    throw ApiException(res.statusCode, _errorMessage(res));
  }

  Future<void> logout() async {
    try {
      await _send('POST', '/api/auth/logout');
    } catch (_) {}
    await _clearAuth();
  }

  Future<Map<String, dynamic>> me() async {
    final body = await _getMap('/api/auth/me');
    return (body['user'] as Map).cast<String, dynamic>();
  }

  Future<void> updateDisplayName(String name) => _send(
    'PUT',
    '/api/account/settings/display-name',
    body: {'displayName': name},
  );

  /// 永久刪除目前登入的使用者帳號與所有資料。
  ///
  /// 有本機密碼的帳號傳 [password] 確認；OAuth-only（Google／LINE）帳號改傳
  /// 與帳號相同的 [confirmEmail] 確認。成功後清除本機 Cookie（等同登出）。
  Future<void> deleteMyAccount({String? password, String? confirmEmail}) async {
    await _send(
      'DELETE',
      '/api/account/settings/delete',
      body: {'password': ?password, 'confirmEmail': ?confirmEmail},
    );
    await _clearAuth();
  }

  // ── 帳戶 ────────────────────────────────────────────────────

  Future<List<dynamic>> accounts() => _getList('/api/accounts');

  Future<void> createAccount(Map<String, dynamic> body) =>
      _send('POST', '/api/accounts', body: body);

  Future<void> updateAccount(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/accounts/$id', body: body);

  Future<void> deleteAccount(String id) => _send('DELETE', '/api/accounts/$id');

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

  Future<Map<String, dynamic>> createTransaction(Map<String, dynamic> body) =>
      _getMapFromSend('POST', '/api/transactions', body: body);

  Future<Map<String, dynamic>> _getMapFromSend(
    String method,
    String path, {
    Object? body,
    Duration? timeout,
  }) async =>
      (await _send(method, path, body: body, timeout: timeout) as Map)
          .cast<String, dynamic>();

  Future<void> updateTransaction(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/transactions/$id', body: body);

  Future<void> deleteTransaction(String id) =>
      _send('DELETE', '/api/transactions/$id');

  Future<List<dynamic>> uploadTransactionPhotos(
    String transactionId,
    List<String> paths,
  ) async {
    if (paths.isEmpty) return const [];
    late http.Response res;
    try {
      final req = http.MultipartRequest(
        'POST',
        _uri('/api/transactions/$transactionId/attachments'),
      );
      req.headers.addAll(_headers());
      for (final path in paths) {
        req.files.add(
          await http.MultipartFile.fromPath(
            'photos',
            path,
            contentType: _imageContentType(path),
          ),
        );
      }
      final streamed = await req.send().timeout(_timeout);
      res = await http.Response.fromStream(streamed);
    } catch (e) {
      throw ApiException(0, '照片上傳失敗：$e');
    }

    if (res.statusCode == 401) {
      await _clearAuth();
      throw ApiException(401, '登入已過期，請重新登入');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, _errorMessage(res));
    }
    final body = jsonDecode(utf8.decode(res.bodyBytes));
    return body is Map && body['attachments'] is List
        ? body['attachments'] as List
        : const [];
  }

  /// 列出某筆交易已上傳的照片附件，回傳 `[{ id, filename, mimeType, byteSize,
  /// storage, createdAt, url }, ...]`。
  Future<List<dynamic>> listTransactionAttachments(String txId) async {
    final r = await _send('GET', '/api/transactions/$txId/attachments');
    return r is Map && r['attachments'] is List
        ? r['attachments'] as List
        : const [];
  }

  /// 刪除某筆交易的一張照片附件。
  Future<void> deleteTransactionAttachment(String txId, String attachmentId) =>
      _send('DELETE', '/api/transactions/$txId/attachments/$attachmentId');

  MediaType _imageContentType(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.png')) return MediaType('image', 'png');
    if (lower.endsWith('.webp')) return MediaType('image', 'webp');
    if (lower.endsWith('.gif')) return MediaType('image', 'gif');
    if (lower.endsWith('.heic')) return MediaType('image', 'heic');
    if (lower.endsWith('.heif')) return MediaType('image', 'heif');
    return MediaType('image', 'jpeg');
  }

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

  // 從 TWSE 依持有期間自動同步股利，回傳 { synced, skipped, errors }。
  // 後端會逐年查詢並含節流延遲，故放寬逾時。
  Future<Map<String, dynamic>> syncStockDividends() => _getMapFromSend(
    'POST',
    '/api/stock-dividends/sync',
    timeout: const Duration(seconds: 120),
  );

  Future<List<dynamic>> stockRealized() => _getList('/api/stock-realized');

  // 批次查詢所有持股最新股價（TWSE/TPEx 三段策略），回傳 { results: [...] }
  Future<Map<String, dynamic>> batchFetchStockPrices() =>
      _getMapFromSend('POST', '/api/stocks/batch-fetch');

  // 批次寫回現價，updates: [{ stockId, currentPrice }]
  Future<Map<String, dynamic>> batchUpdateStockPrices(
    List<Map<String, dynamic>> updates,
  ) => _getMapFromSend(
    'POST',
    '/api/stocks/batch-price',
    body: {'updates': updates},
  );

  // ── 報表 ────────────────────────────────────────────────────

  Future<Map<String, dynamic>> reports({
    required String type,
    required String from,
    required String to,
  }) => _getMap('/api/reports?type=$type&from=$from&to=$to');

  // ── 匯率 ────────────────────────────────────────────────────

  Future<List<dynamic>> exchangeRates() => _getList('/api/exchange-rates');

  // ── 版本資訊 ────────────────────────────────────────────────

  /// 取得版本更新資訊（合併後端本機與遠端分支 changelog），回傳
  /// `{ currentVersion, latestVersion, releases: [{ version, date, title,
  /// type, changes: [{ tag, text }] }], ... }`。
  Future<Map<String, dynamic>> changelog({bool refresh = false}) =>
      _getMapFromSend('GET', '/api/changelog${refresh ? '?refresh=1' : ''}');
}

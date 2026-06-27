import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'play_integrity.dart';
import 'l10n.dart';

/// API 呼叫失敗時拋出，message 已在地化為繁體中文。
class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, String message) : message = tr(message);

  @override
  String toString() => message;
}

/// 與 AssetPilot Next.js 後端溝通的單例 client。
///
/// 後端認證採 httpOnly Cookie（JWT `authToken`）。Dart 的 [http] 套件不會自動
/// 管理 Cookie，因此這裡手動從登入回應擷取 `Set-Cookie`，並在後續請求帶回
/// `Cookie` 標頭。為避免登入憑證以明文落地，Cookie 改存於 Android Keystore
/// 加密的 [FlutterSecureStorage]（EncryptedSharedPreferences）。
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _kCookie = 'authCookie';

  // 認證 Cookie 的加密儲存（Android 走 Keystore 加密的 EncryptedSharedPreferences）。
  static const _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

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
    try {
      _cookie = await _secure.read(key: _kCookie);
    } catch (_) {
      // 解密失敗（如裝置遷移後 Keystore 金鑰不可用）→ 清掉避免反覆失敗，使用者重新登入即可。
      _cookie = null;
      try {
        await _secure.delete(key: _kCookie);
      } catch (_) {}
    }
    // 一次性遷移：把舊版明文存於 SharedPreferences 的 cookie 搬進加密儲存，並清除明文殘留。
    final legacy = p.getString(_kCookie);
    if (legacy != null && legacy.isNotEmpty) {
      _cookie ??= legacy;
      if (_cookie != null) {
        try {
          await _secure.write(key: _kCookie, value: _cookie!);
        } catch (_) {}
      }
      await p.remove(_kCookie);
    }
    authState.value = isLoggedIn;
  }

  // ── 低階請求 ────────────────────────────────────────────────

  Uri _uri(String path) => Uri.parse('$_baseUrl$path');

  /// 供 Sentry Logs 使用的「安全路徑」：去掉 query string，避免把使用者搜尋
  /// 關鍵字（`?keyword=…`）等可能機敏的查詢參數送進監控服務。路徑中的資源
  /// ID 為不可逆的隨機字串、非個資，保留以利定位是哪個端點出錯。
  String _logPath(String path) {
    final q = path.indexOf('?');
    return q == -1 ? path : path.substring(0, q);
  }

  /// 把後端回傳的統計欄位轉成筆數（同時容忍「數字」或「陣列」兩種形態），
  /// 供 Sentry Logs 記錄同步結果用；只取數量、不含任何明細內容。
  int _asCount(dynamic v) => v is num ? v.toInt() : (v is List ? v.length : 0);

  // 自訂 User-Agent，讓後端登入稽核能識別這是 AssetPilot App 及其平台。
  static final String _userAgent = () {
    final os = Platform.isAndroid
        ? 'Android'
        : Platform.isIOS
        ? 'iOS'
        : Platform.operatingSystem;
    return 'AssetPilotApp ($os)';
  }();

  Map<String, String> _headers({bool json = false}) => {
    if (json) 'Content-Type': 'application/json',
    // 後端對帶 cookie 的寫入請求做 CSRF 來源檢查（middleware）。原生 App 不會
    // 自動帶 Origin，缺少時 isOriginAllowed('') 會回 false → 403。送出與後端
    // 同源的 Origin 讓寫入操作通過 CSRF 防護。
    'Origin': _baseUrl,
    'User-Agent': _userAgent,
    'Cookie': ?_cookie,
  };

  void _captureCookie(http.Response res) {
    final raw = res.headers['set-cookie'];
    if (raw == null) return;
    final m = RegExp(r'authToken=([^;,\s]+)').firstMatch(raw);
    if (m != null) _cookie = 'authToken=${m.group(1)}';
  }

  Future<void> _persistCookie() async {
    if (_cookie == null) {
      await _secure.delete(key: _kCookie);
    } else {
      await _secure.write(key: _kCookie, value: _cookie!);
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
      // 以 SentryHttpClient 包裝，讓每個 API 請求自動產生效能 span 與麵包屑
      // （方法／路徑／狀態碼／耗時），用於監控 API 延遲造成的效能下降；
      // 伺服器 5xx 亦會被擷取為 Sentry 事件。請求帶的 query string 由 sentry_config
      // 的 hook 於送出前清除，避免外洩搜尋關鍵字；認證 Cookie 因 sendDefaultPii=false
      // 不會被記錄。
      final c = SentryHttpClient(client: http.Client());
      try {
        switch (method) {
          case 'GET':
            res = await c.get(uri, headers: headers).timeout(t);
            break;
          case 'POST':
            res = await c.post(uri, headers: headers, body: encoded).timeout(t);
            break;
          case 'PUT':
            res = await c.put(uri, headers: headers, body: encoded).timeout(t);
            break;
          case 'DELETE':
            res = await c
                .delete(uri, headers: headers, body: encoded)
                .timeout(t);
            break;
          default:
            throw ArgumentError(
              trPair(
                '未知的 HTTP method: $method',
                'Unknown HTTP method: $method',
              ),
            );
        }
      } finally {
        c.close();
      }
    } catch (e) {
      // 連線層失敗（逾時、DNS、無網路…）。只記端點與例外型別，不帶 body/個資。
      Sentry.logger.error(
        tr('API 請求連線失敗'),
        attributes: {
          'http.method': SentryAttribute.string(method),
          'http.path': SentryAttribute.string(_logPath(path)),
          'error.type': SentryAttribute.string(e.runtimeType.toString()),
        },
      );
      throw ApiException(0, '無法連線到後端（$_baseUrl）：$e');
    }

    if (res.statusCode == 401) {
      await _clearAuth();
      Sentry.logger.info(
        tr('API 回應 401，工作階段已過期並清除本機登入'),
        attributes: {'http.path': SentryAttribute.string(_logPath(path))},
      );
      throw ApiException(401, tr('登入已過期，請重新登入'));
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      Sentry.logger.warn(
        tr('API 請求失敗'),
        attributes: {
          'http.method': SentryAttribute.string(method),
          'http.path': SentryAttribute.string(_logPath(path)),
          'http.status_code': SentryAttribute.int(res.statusCode),
        },
      );
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
    return [];
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
      if (nonce.isEmpty) return {};
      final token = await PlayIntegrity.requestToken(nonce);
      if (token == null) return {};
      return {'integrityNonce': nonce, 'integrityToken': token};
    } catch (_) {
      return {};
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
      Sentry.logger.error(
        tr('登入請求連線失敗'),
        attributes: {
          'auth.method': SentryAttribute.string('password'),
          'error.type': SentryAttribute.string(e.runtimeType.toString()),
        },
      );
      throw ApiException(0, '無法連線到後端（$_baseUrl）：$e');
    }
    // 只記登入結果與狀態碼，絕不記 email/密碼。
    if (res.statusCode != 200) {
      Sentry.logger.warn(
        tr('登入失敗'),
        attributes: {
          'auth.method': SentryAttribute.string('password'),
          'http.status_code': SentryAttribute.int(res.statusCode),
        },
      );
    }
    switch (res.statusCode) {
      case 200:
        _captureCookie(res);
        if (_cookie == null) {
          throw ApiException(200, tr('登入回應未包含認證 Cookie，請確認後端設定'));
        }
        await _persistLogin();
        Sentry.logger.info(
          tr('登入成功'),
          attributes: {'auth.method': SentryAttribute.string('password')},
        );
        return;
      case 401:
        throw ApiException(401, tr('電子郵件或密碼錯誤'));
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
        throw ApiException(200, tr('註冊回應未包含認證 Cookie，請確認後端設定'));
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
    if (s == null) throw ApiException(0, tr('無法建立 Google 登入狀態'));
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
        throw ApiException(200, tr('Google 登入回應未包含認證 Cookie'));
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
        throw ApiException(200, tr('LINE 登入回應未包含認證 Cookie'));
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
        throw ApiException(200, tr('App 登入回應未包含認證 Cookie'));
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
    Sentry.logger.info(tr('使用者登出，已清除本機登入'));
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

  /// 信用卡每期帳單明細（消費／實際繳款），需該卡已設結帳日。
  Future<Map<String, dynamic>> accountStatementCycles(
    String id, {
    int count = 12,
  }) => _getMap('/api/accounts/$id/cycles?count=$count');

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
    String? accountId,
    String? categoryId,
    String? keyword,
    int pageSize = 100,
  }) {
    // 後端分頁參數為 limit（非 pageSize）；一併送出確保筆數生效。
    final q = <String, String>{'limit': '$pageSize', 'sort': 'date_desc'};
    if (dateFrom != null) q['dateFrom'] = dateFrom;
    if (dateTo != null) q['dateTo'] = dateTo;
    if (type != null && type != 'all') q['type'] = type;
    if (accountId != null && accountId.isNotEmpty) q['accountId'] = accountId;
    if (categoryId != null && categoryId.isNotEmpty)
      q['categoryId'] = categoryId;
    if (keyword != null && keyword.trim().isNotEmpty) {
      q['keyword'] = Uri.encodeQueryComponent(keyword.trim());
    }
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
  }) async => (await _send(method, path, body: body, timeout: timeout) as Map)
      .cast<String, dynamic>();

  Future<void> updateTransaction(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/transactions/$id', body: body);

  Future<void> deleteTransaction(String id) =>
      _send('DELETE', '/api/transactions/$id');

  Future<List<dynamic>> uploadTransactionPhotos(
    String transactionId,
    List<String> paths,
  ) async {
    if (paths.isEmpty) return [];
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
      throw ApiException(401, tr('登入已過期，請重新登入'));
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, _errorMessage(res));
    }
    final body = jsonDecode(utf8.decode(res.bodyBytes));
    return body is Map && body['attachments'] is List
        ? body['attachments'] as List
        : [];
  }

  /// 列出某筆交易已上傳的照片附件，回傳 `[{ id, filename, mimeType, byteSize,
  /// storage, createdAt, url }, ...]`。
  Future<List<dynamic>> listTransactionAttachments(String txId) async {
    final r = await _send('GET', '/api/transactions/$txId/attachments');
    return r is Map && r['attachments'] is List ? r['attachments'] as List : [];
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
  Future<Map<String, dynamic>> syncStockDividends() async {
    final r = await _getMapFromSend(
      'POST',
      '/api/stock-dividends/sync',
      timeout: Duration(seconds: 120),
    );
    // synced/skipped/errors 為筆數統計，非金額/個資；記錄以利觀察同步成效。
    // 連線或非 2xx 失敗已由 _send 統一記錄，故此處只記成功結果。
    Sentry.logger.info(
      tr('股利同步完成'),
      attributes: {
        'sync.synced': SentryAttribute.int(_asCount(r['synced'])),
        'sync.skipped': SentryAttribute.int(_asCount(r['skipped'])),
        'sync.errors': SentryAttribute.int(_asCount(r['errors'])),
      },
    );
    return r;
  }

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

  // ── 固定收支（編輯） ────────────────────────────────────────
  Future<void> updateRecurring(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/recurring/$id', body: body);

  // ── 股票（編輯／刪除、股利 CRUD、設定） ─────────────────────
  Future<void> updateStock(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/stocks/$id', body: body);

  Future<void> updateStockTransaction(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/stock-transactions/$id', body: body);

  Future<void> createStockDividend(Map<String, dynamic> body) =>
      _send('POST', '/api/stock-dividends', body: body);

  Future<void> updateStockDividend(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/stock-dividends/$id', body: body);

  Future<void> deleteStockDividend(String id) =>
      _send('DELETE', '/api/stock-dividends/$id');

  Future<Map<String, dynamic>> stockSettings() =>
      _getMap('/api/stock-settings');

  Future<Map<String, dynamic>> updateStockSettings(Map<String, dynamic> body) =>
      _getMapFromSend('PUT', '/api/stock-settings', body: body);

  // ── 帳戶（信用卡還款） ──────────────────────────────────────
  Future<void> creditCardRepayment(Map<String, dynamic> body) =>
      _send('POST', '/api/accounts/credit-card-repayment', body: body);

  // ── 使用者幣別設定 ──────────────────────────────────────────
  Future<Map<String, dynamic>> defaultCurrency() =>
      _getMap('/api/user/settings/default-currency');

  Future<Map<String, dynamic>> setDefaultCurrency(String currency) =>
      _getMapFromSend(
        'PUT',
        '/api/user/settings/default-currency',
        body: {'defaultCurrency': currency},
      );

  Future<Map<String, dynamic>> pinnedCurrencies() =>
      _getMap('/api/user/settings/pinned-currencies');

  Future<Map<String, dynamic>> setPinnedCurrencies(List<String> list) =>
      _getMapFromSend(
        'PUT',
        '/api/user/settings/pinned-currencies',
        body: {'pinnedCurrencies': list},
      );

  // ── 帳號安全 ────────────────────────────────────────────────
  /// 變更密碼。後端會輪替 token 並撤銷其他工作階段，回應帶新的認證 Cookie，
  /// 這裡擷取並保存，避免本機在下一次請求被登出。
  Future<void> changePassword(String? current, String next) async {
    late http.Response res;
    try {
      res = await http
          .put(
            _uri('/api/account/settings/password'),
            headers: _headers(json: true),
            body: jsonEncode({
              'currentPassword': current ?? '',
              'newPassword': next,
            }),
          )
          .timeout(_timeout);
    } catch (e) {
      throw ApiException(0, '無法連線到後端（$_baseUrl）：$e');
    }
    if (res.statusCode == 401) {
      throw ApiException(401, _errorMessage(res));
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, _errorMessage(res));
    }
    _captureCookie(res);
    await _persistCookie();
  }

  Future<void> setLanguage(String locale) =>
      _send('POST', '/api/account/settings/language', body: {'locale': locale});

  Future<List<dynamic>> sessions() async {
    final r = await _send('GET', '/api/account/sessions');
    return r is Map && r['sessions'] is List ? r['sessions'] as List : [];
  }

  Future<void> revokeSession(String id) =>
      _send('DELETE', '/api/account/sessions/$id');

  Future<List<dynamic>> loginAudit() async {
    final r = await _send('GET', '/api/user/login-audit');
    return r is Map && r['logs'] is List ? r['logs'] as List : [];
  }

  Future<List<dynamic>> passkeys() async {
    final r = await _send('GET', '/api/account/passkeys');
    return r is Map && r['passkeys'] is List ? r['passkeys'] as List : [];
  }

  Future<void> renamePasskey(String id, String deviceName) => _send(
    'PUT',
    '/api/account/passkey/$id',
    body: {'deviceName': deviceName},
  );

  Future<void> deletePasskey(String id) =>
      _send('DELETE', '/api/account/passkey/$id');

  Future<void> unlinkGoogle() =>
      _send('DELETE', '/api/account/settings/google');

  Future<void> unlinkLine() => _send('DELETE', '/api/account/settings/line');

  // ── 定期報表通知排程 ────────────────────────────────────────
  Future<List<dynamic>> reportSchedules() async {
    final r = await _send('GET', '/api/user/report-schedules');
    return r is List ? r : [];
  }

  Future<void> createReportSchedule(Map<String, dynamic> body) =>
      _send('POST', '/api/user/report-schedules', body: body);

  Future<void> updateReportSchedule(String id, Map<String, dynamic> body) =>
      _send('PUT', '/api/user/report-schedules/$id', body: body);

  Future<void> deleteReportSchedule(String id) =>
      _send('DELETE', '/api/user/report-schedules/$id');
}

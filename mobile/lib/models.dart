/// 對應 `GET /api/auth/me` 回傳的 `user` 物件。
/// 後端欄位可能為 snake_case 或 camelCase，這裡皆容錯解析。
class AppUser {
  final String id;
  final String email;
  final String displayName;
  final bool isAdmin;
  final String defaultCurrency;

  AppUser({
    required this.id,
    required this.email,
    required this.displayName,
    required this.isAdmin,
    required this.defaultCurrency,
  });

  factory AppUser.fromJson(Map<String, dynamic> j) {
    final email = '${j['email'] ?? ''}';
    final name = j['displayName'] ?? j['display_name'];
    return AppUser(
      id: '${j['id'] ?? ''}',
      email: email,
      displayName: (name == null || '$name'.isEmpty) ? email : '$name',
      isAdmin: j['isAdmin'] == true || j['is_admin'] == true || j['is_admin'] == 1,
      defaultCurrency: '${j['defaultCurrency'] ?? 'TWD'}',
    );
  }
}

/// 對應 `GET /api/accounts` 陣列中的單一帳戶。
class Account {
  final String id;
  final String name;
  final num balance;
  final String currency;

  /// 換算為 TWD 後的累計餘額，用於總資產加總。
  final num twdAccumulated;
  final bool excludeFromTotal;
  final String category;

  Account({
    required this.id,
    required this.name,
    required this.balance,
    required this.currency,
    required this.twdAccumulated,
    required this.excludeFromTotal,
    required this.category,
  });

  factory Account.fromJson(Map<String, dynamic> j) {
    num asNum(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
    return Account(
      id: '${j['id'] ?? ''}',
      name: '${j['name'] ?? ''}',
      balance: asNum(j['balance']),
      currency: '${j['currency'] ?? 'TWD'}',
      twdAccumulated: asNum(j['twdAccumulated']),
      excludeFromTotal: j['excludeFromTotal'] == true,
      category: '${j['category'] ?? ''}',
    );
  }
}

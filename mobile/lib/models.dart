import 'l10n.dart';

// AssetPilot App 資料模型。後端欄位多為 camelCase，少數為 snake_case，
// 解析時皆以容錯方式處理。

num _asNum(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
String _asStr(dynamic v) => v == null ? '' : '$v';
bool _asBool(dynamic v) => v == true || v == 1 || v == '1';
num? _asNumOrNull(dynamic v) =>
    v == null ? null : (v is num ? v : num.tryParse('$v'));
int? _asIntOrNull(dynamic v) => _asNumOrNull(v)?.toInt();
String? _asStrOrNull(dynamic v) {
  if (v == null) return null;
  final s = '$v';
  return s.isEmpty ? null : s;
}

/// `GET /api/auth/me` → `user`
class AppUser {
  final String id;
  final String email;
  final String displayName;
  final bool isAdmin;
  final String defaultCurrency;
  final bool hasPassword;
  final bool googleLinked;
  final bool lineLinked;

  AppUser({
    required this.id,
    required this.email,
    required this.displayName,
    required this.isAdmin,
    required this.defaultCurrency,
    required this.hasPassword,
    required this.googleLinked,
    required this.lineLinked,
  });

  factory AppUser.fromJson(Map<String, dynamic> j) {
    final email = _asStr(j['email']);
    final name = j['displayName'] ?? j['display_name'];
    return AppUser(
      id: _asStr(j['id']),
      email: email,
      displayName: (name == null || '$name'.isEmpty) ? email : '$name',
      isAdmin: _asBool(j['isAdmin']) || _asBool(j['is_admin']),
      defaultCurrency: _asStr(j['defaultCurrency']).isEmpty
          ? 'TWD'
          : _asStr(j['defaultCurrency']),
      hasPassword: _asBool(j['hasPassword']) || _asBool(j['has_password']),
      googleLinked: _asBool(j['googleLinked']) || _asBool(j['google_linked']),
      lineLinked: _asBool(j['lineLinked']) || _asBool(j['line_linked']),
    );
  }
}

/// `GET /api/accounts` 陣列項目
class Account {
  final String id;
  final String name;
  final String category; // bank / credit_card / securities / cash ...
  final num balance;
  final String currency;
  final num initialBalance;
  final num twdAccumulated;
  final bool excludeFromTotal;
  final num overseasFeeRate; // 海外手續費率（百分比 %），非信用卡為 0
  final int? statementClosingDay; // 信用卡每月結帳日（1~31），未設定為 null
  final num? cycleSpending; // 本期帳單消費（原幣別），未設結帳日為 null
  final String? cycleStart; // 本期區間起日 YYYY-MM-DD
  final String? cycleEnd; // 本期區間迄日 YYYY-MM-DD
  // 上期帳單（最近一張已結帳）：消費與已繳（繳款對應回它所清償的帳單）
  final num? lastCycleSpending;
  final num? lastCyclePayment;
  final String? lastCycleStart;
  final String? lastCycleEnd;

  Account({
    required this.id,
    required this.name,
    required this.category,
    required this.balance,
    required this.currency,
    required this.initialBalance,
    required this.twdAccumulated,
    required this.excludeFromTotal,
    required this.overseasFeeRate,
    this.statementClosingDay,
    this.cycleSpending,
    this.cycleStart,
    this.cycleEnd,
    this.lastCycleSpending,
    this.lastCyclePayment,
    this.lastCycleStart,
    this.lastCycleEnd,
  });

  factory Account.fromJson(Map<String, dynamic> j) => Account(
    id: _asStr(j['id']),
    name: _asStr(j['name']),
    category: _asStr(j['category']),
    balance: _asNum(j['balance']),
    currency: _asStr(j['currency']).isEmpty ? 'TWD' : _asStr(j['currency']),
    initialBalance: _asNum(j['initialBalance']),
    twdAccumulated: _asNum(j['twdAccumulated']),
    excludeFromTotal: _asBool(j['excludeFromTotal']),
    overseasFeeRate: _asNum(j['overseasFeeRate'] ?? j['overseas_fee_rate']),
    statementClosingDay: _asIntOrNull(
      j['statementClosingDay'] ?? j['statement_closing_day'],
    ),
    cycleSpending: _asNumOrNull(j['cycleSpending']),
    cycleStart: _asStrOrNull(j['cycleStart']),
    cycleEnd: _asStrOrNull(j['cycleEnd']),
    lastCycleSpending: _asNumOrNull(j['lastCycleSpending']),
    lastCyclePayment: _asNumOrNull(j['lastCyclePayment']),
    lastCycleStart: _asStrOrNull(j['lastCycleStart']),
    lastCycleEnd: _asStrOrNull(j['lastCycleEnd']),
  );
}

/// `GET /api/accounts/{id}/cycles` 的單期項目
class StatementCycle {
  final String start;
  final String end;
  final bool current;
  final num spending;
  final num payment;

  StatementCycle({
    required this.start,
    required this.end,
    required this.current,
    required this.spending,
    required this.payment,
  });

  factory StatementCycle.fromJson(Map<String, dynamic> j) => StatementCycle(
    start: _asStr(j['start']),
    end: _asStr(j['end']),
    current: _asBool(j['current']),
    spending: _asNum(j['spending']),
    payment: _asNum(j['payment']),
  );
}

/// `GET /api/categories` 陣列項目（父子兩層）
class Category {
  final String id;
  final String name;
  final String type; // income / expense
  final String color;
  final String parentId; // '' 代表父分類
  final bool isDefault;

  Category({
    required this.id,
    required this.name,
    required this.type,
    required this.color,
    required this.parentId,
    required this.isDefault,
  });

  bool get isParent => parentId.isEmpty;

  factory Category.fromJson(Map<String, dynamic> j) => Category(
    id: _asStr(j['id']),
    name: _asStr(j['name']),
    type: _asStr(j['type']),
    color: _asStr(j['color']).isEmpty ? '#888888' : _asStr(j['color']),
    parentId: _asStr(j['parentId']),
    isDefault: _asBool(j['isDefault']),
  );
}

/// `GET /api/transactions` → `data[]`
class Txn {
  final String id;
  final String type; // income / expense / transfer
  final num amount; // 已換算的 TWD 金額（twd_amount）
  final num originalAmount; // 原始幣別金額；TWD 交易等同 amount
  final String currency;
  final String fxRate; // 1 外幣 = ? TWD；TWD 交易為 '1'
  final String date; // YYYY-MM-DD
  final String categoryId;
  final String accountId;
  final String toAccountId;
  final String note;
  final String? catName;
  final int attachmentCount; // 照片附件數量
  final bool excludeFromStats;
  final num fxFee; // 海外刷卡手續費（TWD）
  final bool isFxFee; // 是否為自動產生的國外刷卡手續費交易

  Txn({
    required this.id,
    required this.type,
    required this.amount,
    required this.originalAmount,
    required this.currency,
    required this.fxRate,
    required this.date,
    required this.categoryId,
    required this.accountId,
    required this.toAccountId,
    required this.note,
    required this.catName,
    this.attachmentCount = 0,
    this.excludeFromStats = false,
    this.fxFee = 0,
    this.isFxFee = false,
  });

  factory Txn.fromJson(Map<String, dynamic> j) {
    final amount = _asNum(j['amount']);
    final orig = _asNum(j['originalAmount'] ?? j['original_amount']);
    final rate = _asStr(j['fxRate'] ?? j['fx_rate']);
    return Txn(
      id: _asStr(j['id']),
      type: _asStr(j['type']),
      amount: amount,
      originalAmount: orig > 0 ? orig : amount,
      currency: _asStr(j['currency']).isEmpty ? 'TWD' : _asStr(j['currency']),
      fxRate: rate.isEmpty ? '1' : rate,
      date: _asStr(j['date']),
      categoryId: _asStr(j['categoryId'] ?? j['category_id']),
      accountId: _asStr(j['accountId'] ?? j['account_id']),
      toAccountId: _asStr(j['toAccountId'] ?? j['to_account_id']),
      note: _asStr(j['note']),
      excludeFromStats: _asBool(
        j['excludeFromStats'] ?? j['exclude_from_stats'],
      ),
      fxFee: _asNum(j['fxFee'] ?? j['fx_fee']),
      isFxFee: _asBool(j['isFxFee'] ?? j['is_fx_fee']),
      catName:
          (j['cat_name'] ??
                  j['catName'] ??
                  j['category_name'] ??
                  j['categoryName'] ??
                  (j['category'] is Map ? j['category']['name'] : null)) ==
              null
          ? null
          : _asStr(
              j['cat_name'] ??
                  j['catName'] ??
                  j['category_name'] ??
                  j['categoryName'] ??
                  (j['category'] is Map ? j['category']['name'] : null),
            ),
      attachmentCount: _asNum(
        j['attachmentCount'] ?? j['attachment_count'],
      ).toInt(),
    );
  }
}

/// 儀表板分類彙總節點。API 回傳的是「子分類」層級的節點，每筆都帶有所屬
/// 父分類的 parentId / parentName / parentColor，供前端依父分類彙總（與 Web 一致）。
class CatNode {
  final String name;
  final String color;
  final num total;
  final String parentId;
  final String parentName;
  final String parentColor;
  CatNode({
    required this.name,
    required this.color,
    required this.total,
    required this.parentId,
    required this.parentName,
    required this.parentColor,
  });

  factory CatNode.fromJson(Map<String, dynamic> j) {
    final name = _asStr(j['name']);
    final color = _asStr(j['color']).isEmpty ? '#888888' : _asStr(j['color']);
    // fallback 規則對齊 Web dashboard 的 groupCategoryRows()。
    final parentName = _asStr(j['parentName']).isEmpty
        ? (name.isEmpty ? tr('未分類') : name)
        : _asStr(j['parentName']);
    final parentColor = _asStr(j['parentColor']).isEmpty
        ? color
        : _asStr(j['parentColor']);
    final parentId = _asStr(j['parentId']).isEmpty
        ? 'parent-$parentName'
        : _asStr(j['parentId']);
    return CatNode(
      name: name,
      color: color,
      total: _asNum(j['total']),
      parentId: parentId,
      parentName: parentName,
      parentColor: parentColor,
    );
  }
}

/// `GET /api/dashboard?ym=YYYY-MM`
class Dashboard {
  final String yearMonth;
  final num income;
  final num expense;
  final num net;
  final num todayExpense;
  final num bankBalance;
  final num stockMarketValue;
  final List<CatNode> catBreakdown;
  final List<Txn> recent;

  Dashboard({
    required this.yearMonth,
    required this.income,
    required this.expense,
    required this.net,
    required this.todayExpense,
    required this.bankBalance,
    required this.stockMarketValue,
    required this.catBreakdown,
    required this.recent,
  });

  factory Dashboard.fromJson(Map<String, dynamic> j) {
    List<CatNode> nodes(dynamic v) => (v as List? ?? [])
        .map((e) => CatNode.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    return Dashboard(
      yearMonth: _asStr(j['yearMonth']),
      income: _asNum(j['income']),
      expense: _asNum(j['expense']),
      net: _asNum(j['net']),
      todayExpense: _asNum(j['todayExpense']),
      bankBalance: _asNum(j['bankBalance']),
      stockMarketValue: _asNum(j['stockMarketValue']),
      catBreakdown: nodes(j['catBreakdown']),
      recent: (j['recent'] as List? ?? [])
          .map((e) => Txn.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
    );
  }
}

/// `GET /api/budgets?yearMonth=YYYY-MM`
class Budget {
  final String id;
  final String? categoryId; // null = 月度總預算
  final String yearMonth;
  final num amount;
  final num used;

  Budget({
    required this.id,
    required this.categoryId,
    required this.yearMonth,
    required this.amount,
    required this.used,
  });

  double get progress => amount > 0 ? (used / amount).toDouble() : 0;

  factory Budget.fromJson(Map<String, dynamic> j) => Budget(
    id: _asStr(j['id']),
    categoryId: j['categoryId'] == null ? null : _asStr(j['categoryId']),
    yearMonth: _asStr(j['yearMonth']),
    amount: _asNum(j['amount']),
    used: _asNum(j['used']),
  );
}

/// `GET /api/recurring`
class Recurring {
  final String id;
  final String type; // income / expense
  final num amount;
  final String categoryId;
  final String accountId;
  final String frequency; // daily / weekly / monthly / yearly
  final String startDate;
  final String note;
  final bool isActive;
  final String currency;
  final String fxRate; // 1 外幣 = ? TWD；TWD 為 '1'
  final bool excludeFromStats;
  final num fxFee;

  Recurring({
    required this.id,
    required this.type,
    required this.amount,
    required this.categoryId,
    required this.accountId,
    required this.frequency,
    required this.startDate,
    required this.note,
    required this.isActive,
    required this.currency,
    required this.fxRate,
    this.excludeFromStats = false,
    this.fxFee = 0,
  });

  factory Recurring.fromJson(Map<String, dynamic> j) {
    final rate = _asStr(j['fxRate'] ?? j['fx_rate']);
    return Recurring(
      id: _asStr(j['id']),
      type: _asStr(j['type']),
      amount: _asNum(j['amount']),
      categoryId: _asStr(j['categoryId']),
      accountId: _asStr(j['accountId']),
      frequency: _asStr(j['frequency']),
      startDate: _asStr(j['startDate']),
      note: _asStr(j['note']),
      isActive: _asBool(j['isActive']),
      currency: _asStr(j['currency']).isEmpty ? 'TWD' : _asStr(j['currency']),
      fxRate: rate.isEmpty ? '1' : rate,
      excludeFromStats: _asBool(
        j['excludeFromStats'] ?? j['exclude_from_stats'],
      ),
      fxFee: _asNum(j['fxFee'] ?? j['fx_fee']),
    );
  }
}

/// `GET /api/stocks` → `stocks[]`
class Stock {
  final String id;
  final String symbol;
  final String name;
  final num totalShares;
  final num avgCost;
  final num currentPrice;
  final num marketValue;
  final num estimatedProfit;
  final num returnRate;
  final num totalDividend;
  final bool delisted;
  final String stockType; // stock / etf / warrant

  Stock({
    required this.id,
    required this.symbol,
    required this.name,
    required this.totalShares,
    required this.avgCost,
    required this.currentPrice,
    required this.marketValue,
    required this.estimatedProfit,
    required this.returnRate,
    required this.totalDividend,
    required this.delisted,
    required this.stockType,
  });

  factory Stock.fromJson(Map<String, dynamic> j) => Stock(
    id: _asStr(j['id']),
    symbol: _asStr(j['symbol']),
    name: _asStr(j['name']),
    totalShares: _asNum(j['totalShares']),
    avgCost: _asNum(j['avgCost']),
    currentPrice: _asNum(j['currentPrice']),
    marketValue: _asNum(j['marketValue']),
    estimatedProfit: _asNum(j['estimatedProfit']),
    returnRate: _asNum(j['returnRate']),
    totalDividend: _asNum(j['totalDividend']),
    delisted: _asBool(j['delisted']),
    stockType: _asStr(j['stockType'] ?? j['stock_type']).isEmpty
        ? 'stock'
        : _asStr(j['stockType'] ?? j['stock_type']),
  );
}

class PortfolioSummary {
  final num totalMarketValue;
  final num totalCost;
  final num totalPL;
  final num? totalReturnRate;

  PortfolioSummary({
    required this.totalMarketValue,
    required this.totalCost,
    required this.totalPL,
    required this.totalReturnRate,
  });

  factory PortfolioSummary.fromJson(Map<String, dynamic> j) => PortfolioSummary(
    totalMarketValue: _asNum(j['totalMarketValue']),
    totalCost: _asNum(j['totalCost']),
    totalPL: _asNum(j['totalPL']),
    totalReturnRate: j['totalReturnRate'] == null
        ? null
        : _asNum(j['totalReturnRate']),
  );
}

/// `GET /api/stock-transactions`
class StockTxn {
  final String id;
  final String stockId;
  final String symbol;
  final String stockName;
  final String type; // buy / sell
  final num shares;
  final num price;
  final num fee;
  final num tax;
  final String date;
  final String note;

  StockTxn({
    required this.id,
    required this.stockId,
    required this.symbol,
    required this.stockName,
    required this.type,
    required this.shares,
    required this.price,
    required this.fee,
    required this.tax,
    required this.date,
    required this.note,
  });

  factory StockTxn.fromJson(Map<String, dynamic> j) => StockTxn(
    id: _asStr(j['id']),
    stockId: _asStr(j['stockId'] ?? j['stock_id']),
    symbol: _asStr(j['symbol']),
    stockName: _asStr(j['stock_name'] ?? j['name']),
    type: _asStr(j['type']),
    shares: _asNum(j['shares']),
    price: _asNum(j['price']),
    fee: _asNum(j['fee']),
    tax: _asNum(j['tax']),
    date: _asStr(j['date']),
    note: _asStr(j['note']),
  );
}

/// `GET /api/stock-dividends`
class Dividend {
  final String id;
  final String stockId;
  final String symbol;
  final String stockName;
  final num cashDividend;
  final num stockDividendShares;
  final String date;
  final String accountId;
  final String note;

  Dividend({
    required this.id,
    required this.stockId,
    required this.symbol,
    required this.stockName,
    required this.cashDividend,
    required this.stockDividendShares,
    required this.date,
    required this.accountId,
    required this.note,
  });

  factory Dividend.fromJson(Map<String, dynamic> j) => Dividend(
    id: _asStr(j['id']),
    stockId: _asStr(j['stockId'] ?? j['stock_id']),
    symbol: _asStr(j['symbol']),
    stockName: _asStr(j['stock_name'] ?? j['name']),
    cashDividend: _asNum(j['cash_dividend'] ?? j['cashDividend']),
    stockDividendShares: _asNum(
      j['stock_dividend_shares'] ?? j['stockDividendShares'],
    ),
    date: _asStr(j['date']),
    accountId: _asStr(j['accountId'] ?? j['account_id']),
    note: _asStr(j['note']),
  );
}

/// `GET/PUT /api/stock-settings` — 手續費／交易稅率設定
class StockSettings {
  final num feeRate; // 手續費率（%）
  final num feeDiscount; // 折讓（0~1）
  final num feeMinLot; // 整股最低手續費
  final num feeMinOdd; // 零股最低手續費
  final num sellTaxRateStock; // 一般股票賣出證交稅（%）
  final num sellTaxRateEtf; // ETF 賣出證交稅（%）
  final num sellTaxRateWarrant; // 權證賣出證交稅（%）
  final num sellTaxMin; // 最低證交稅

  StockSettings({
    required this.feeRate,
    required this.feeDiscount,
    required this.feeMinLot,
    required this.feeMinOdd,
    required this.sellTaxRateStock,
    required this.sellTaxRateEtf,
    required this.sellTaxRateWarrant,
    required this.sellTaxMin,
  });

  factory StockSettings.fromJson(Map<String, dynamic> j) => StockSettings(
    feeRate: _asNum(j['feeRate']),
    feeDiscount: _asNum(j['feeDiscount']),
    feeMinLot: _asNum(j['feeMinLot']),
    feeMinOdd: _asNum(j['feeMinOdd']),
    sellTaxRateStock: _asNum(j['sellTaxRateStock']),
    sellTaxRateEtf: _asNum(j['sellTaxRateEtf']),
    sellTaxRateWarrant: _asNum(j['sellTaxRateWarrant']),
    sellTaxMin: _asNum(j['sellTaxMin']),
  );
}

/// `GET /api/account/sessions` → `sessions[]`
class LoginSession {
  final String id;
  final String deviceName;
  final String ip;
  final num loginAt;
  final bool current;

  LoginSession({
    required this.id,
    required this.deviceName,
    required this.ip,
    required this.loginAt,
    required this.current,
  });

  factory LoginSession.fromJson(Map<String, dynamic> j) => LoginSession(
    id: _asStr(j['id'] ?? j['sessionId']),
    deviceName: _asStr(j['deviceName'] ?? j['device_name']).isEmpty
        ? tr('未知裝置')
        : _asStr(j['deviceName'] ?? j['device_name']),
    ip: _asStr(j['ip'] ?? j['ipAddress'] ?? j['ip_address']),
    loginAt: _asNum(j['loginAt'] ?? j['createdAt'] ?? j['created_at']),
    current: _asBool(j['current'] ?? j['isCurrent'] ?? j['is_current']),
  );
}

/// `GET /api/user/login-audit` → `logs[]`
class LoginAuditLog {
  final num loginAt;
  final String ipAddress;
  final String country;
  final String loginMethod;
  final String device;
  final bool isAdminLogin;

  LoginAuditLog({
    required this.loginAt,
    required this.ipAddress,
    required this.country,
    required this.loginMethod,
    required this.device,
    required this.isAdminLogin,
  });

  factory LoginAuditLog.fromJson(Map<String, dynamic> j) => LoginAuditLog(
    loginAt: _asNum(j['loginAt']),
    ipAddress: _asStr(j['ipAddress']),
    country: _asStr(j['country']),
    loginMethod: _asStr(j['loginMethod']),
    device: _asStr(j['device']),
    isAdminLogin: _asBool(j['isAdminLogin']),
  );
}

/// `GET /api/account/passkeys` → `passkeys[]`
class Passkey {
  final String id;
  final String deviceName;
  final num createdAt;

  Passkey({
    required this.id,
    required this.deviceName,
    required this.createdAt,
  });

  factory Passkey.fromJson(Map<String, dynamic> j) => Passkey(
    id: _asStr(j['id']),
    deviceName: _asStr(j['deviceName']).isEmpty
        ? tr('未命名 Passkey')
        : _asStr(j['deviceName']),
    createdAt: _asNum(j['createdAt']),
  );
}

/// `GET /api/user/report-schedules` — 定期報表通知排程
class ReportSchedule {
  final String id;
  final String freq; // daily / weekly / monthly
  final int hour;
  final int minute;
  final int weekday; // 0=日 ... 6=六
  final int dayOfMonth; // 0=每月最後一天，1-28
  final bool enabled;
  final bool notifyEmail;
  final bool notifyLine;
  final num lastRun;

  ReportSchedule({
    required this.id,
    required this.freq,
    required this.hour,
    required this.minute,
    required this.weekday,
    required this.dayOfMonth,
    required this.enabled,
    required this.notifyEmail,
    required this.notifyLine,
    required this.lastRun,
  });

  factory ReportSchedule.fromJson(Map<String, dynamic> j) => ReportSchedule(
    id: _asStr(j['id']),
    freq: _asStr(j['freq']).isEmpty ? 'monthly' : _asStr(j['freq']),
    hour: _asNum(j['hour']).toInt(),
    minute: _asNum(j['minute']).toInt(),
    weekday: _asNum(j['weekday']).toInt(),
    dayOfMonth: _asNum(j['dayOfMonth']).toInt(),
    enabled: _asBool(j['enabled']),
    notifyEmail: _asBool(j['notifyEmail']),
    notifyLine: _asBool(j['notifyLine']),
    lastRun: _asNum(j['lastRun']),
  );
}

/// `GET /api/stock-realized`
class RealizedPL {
  final String id;
  final String symbol;
  final String name;
  final num shares;
  final num sellPrice;
  final num realizedPL;
  final num returnRate;
  final String date;

  RealizedPL({
    required this.id,
    required this.symbol,
    required this.name,
    required this.shares,
    required this.sellPrice,
    required this.realizedPL,
    required this.returnRate,
    required this.date,
  });

  factory RealizedPL.fromJson(Map<String, dynamic> j) => RealizedPL(
    id: _asStr(j['id']),
    symbol: _asStr(j['symbol']),
    name: _asStr(j['name']),
    shares: _asNum(j['shares']),
    sellPrice: _asNum(j['sellPrice']),
    realizedPL: _asNum(j['realizedPL']),
    returnRate: _asNum(j['returnRate']),
    date: _asStr(j['date']),
  );
}

// AssetPilot App 資料模型。後端欄位多為 camelCase，少數為 snake_case，
// 解析時皆以容錯方式處理。

num _asNum(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
String _asStr(dynamic v) => v == null ? '' : '$v';
bool _asBool(dynamic v) => v == true || v == 1 || v == '1';

/// `GET /api/auth/me` → `user`
class AppUser {
  final String id;
  final String email;
  final String displayName;
  final bool isAdmin;
  final String defaultCurrency;
  final bool hasPassword;

  AppUser({
    required this.id,
    required this.email,
    required this.displayName,
    required this.isAdmin,
    required this.defaultCurrency,
    required this.hasPassword,
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
  final num overseasFeeRate; // 海外手續費率（千分點），非信用卡為 0

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
  final num amount;
  final String currency;
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
    required this.currency,
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

  factory Txn.fromJson(Map<String, dynamic> j) => Txn(
    id: _asStr(j['id']),
    type: _asStr(j['type']),
    amount: _asNum(j['amount']),
    currency: _asStr(j['currency']).isEmpty ? 'TWD' : _asStr(j['currency']),
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
    attachmentCount: _asNum(j['attachmentCount'] ?? j['attachment_count'])
        .toInt(),
  );
}

/// 儀表板分類彙總節點（圓餅扇區）
class CatNode {
  final String name;
  final String color;
  final num total;
  CatNode({required this.name, required this.color, required this.total});

  factory CatNode.fromJson(Map<String, dynamic> j) => CatNode(
    name: _asStr(j['name']),
    color: _asStr(j['color']).isEmpty ? '#888888' : _asStr(j['color']),
    total: _asNum(j['total']),
  );
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
    this.excludeFromStats = false,
    this.fxFee = 0,
  });

  factory Recurring.fromJson(Map<String, dynamic> j) => Recurring(
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
    excludeFromStats: _asBool(
      j['excludeFromStats'] ?? j['exclude_from_stats'],
    ),
    fxFee: _asNum(j['fxFee'] ?? j['fx_fee']),
  );
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
  final String symbol;
  final String stockName;
  final String type; // buy / sell
  final num shares;
  final num price;
  final num fee;
  final num tax;
  final String date;

  StockTxn({
    required this.id,
    required this.symbol,
    required this.stockName,
    required this.type,
    required this.shares,
    required this.price,
    required this.fee,
    required this.tax,
    required this.date,
  });

  factory StockTxn.fromJson(Map<String, dynamic> j) => StockTxn(
    id: _asStr(j['id']),
    symbol: _asStr(j['symbol']),
    stockName: _asStr(j['stock_name'] ?? j['name']),
    type: _asStr(j['type']),
    shares: _asNum(j['shares']),
    price: _asNum(j['price']),
    fee: _asNum(j['fee']),
    tax: _asNum(j['tax']),
    date: _asStr(j['date']),
  );
}

/// `GET /api/stock-dividends`
class Dividend {
  final String id;
  final String symbol;
  final String stockName;
  final num cashDividend;
  final num stockDividendShares;
  final String date;

  Dividend({
    required this.id,
    required this.symbol,
    required this.stockName,
    required this.cashDividend,
    required this.stockDividendShares,
    required this.date,
  });

  factory Dividend.fromJson(Map<String, dynamic> j) => Dividend(
    id: _asStr(j['id']),
    symbol: _asStr(j['symbol']),
    stockName: _asStr(j['stock_name'] ?? j['name']),
    cashDividend: _asNum(j['cash_dividend'] ?? j['cashDividend']),
    stockDividendShares: _asNum(
      j['stock_dividend_shares'] ?? j['stockDividendShares'],
    ),
    date: _asStr(j['date']),
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

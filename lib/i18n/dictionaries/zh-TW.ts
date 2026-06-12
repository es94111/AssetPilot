// lib/i18n/dictionaries/zh-TW.ts — 繁體中文字典（來源語言 / source of truth）
//
// 規則：
// 1. 這份檔案是所有譯文鍵的「唯一真實來源」。其它語言檔以此型別為準（DeepPartialDict）。
// 2. 巢狀以命名空間分組（common / nav / auth / settings ...）。逐步把散落在
//    各頁面的硬編碼中文搬進對應命名空間，呼叫端改用 t('namespace.key')。
// 3. 插值用 {變數名}，例如 '剩餘 {count} 天'，呼叫 t('x.y', { count: 3 })。
//
// 注意：物件字面值的屬性會自動 widen 成 string，故 typeof zhTW 即可作為型別來源。

export const zhTW = {
  common: {
    save: '儲存',
    cancel: '取消',
    delete: '刪除',
    edit: '編輯',
    confirm: '確認',
    close: '關閉',
    loading: '載入中…',
    add: '新增',
    back: '返回',
    search: '搜尋',
  },
  nav: {
    sections: {
      finance: '財務管理',
      stocks: '股票投資',
      system: '系統設定',
    },
    dashboard: '儀表板',
    transactions: '交易記錄',
    reports: '統計報表',
    budget: '預算管理',
    accounts: '帳戶管理',
    categories: '分類管理',
    recurring: '固定收支',
    stocksPortfolio: '持股總覽',
    stocksTransactions: '股票交易紀錄',
    stocksDividends: '股利紀錄',
    stocksRealized: '實現損益',
    stocksSettings: '股票設定',
    exportImport: '資料匯出匯入',
    account: '帳號設定',
    apiCredits: 'API 授權',
    admin: '管理員',
    // 頁首標題（部分與側欄用詞不同）
    titleStocks: '持股總覽',
    titleStockTransactions: '股票交易紀錄',
    titleStockDividends: '股票股利紀錄',
    titleStockRealized: '股票實現損益',
    titleStockSettings: '股票交易設定',
    titleApiCredits: 'API 使用與授權',
  },
  shell: {
    fallbackUser: '使用者',
    logout: '登出',
    versionInfo: '版本資訊',
    openMenu: '開啟選單',
    theme: {
      light: '亮色',
      system: '系統',
      dark: '暗色',
    },
    changelog: {
      loading: '正在讀取版本資訊...',
      loadFailed: '讀取版本資訊失敗',
      unknownVersion: '未知',
      currentVersion: '目前版本',
      updatableVersion: '可更新版本',
      upToDate: '已是最新版本',
      updatableContent: '可更新內容',
      recentContent: '最近更新內容',
    },
  },
  auth: {
    loginTab: '登入',
    registerTab: '註冊',
    subtitleLogin: '歡迎回來，請登入您的帳號',
    subtitleRegister: '建立您的帳號，開始記帳',
    emailLabel: '電子信箱',
    passwordLabel: '密碼',
    passwordPlaceholder: '請輸入密碼',
    displayNameLabel: '顯示名稱',
    displayNamePlaceholder: '您的暱稱',
    registerPasswordPlaceholder: '至少 8 位，含大小寫英文與數字',
    togglePassword: '切換密碼顯示',
    turnstileAria: 'Cloudflare Turnstile 真人驗證',
    loginButton: '登入',
    loggingIn: '登入中…',
    passkeyButton: '使用 Passkey 登入',
    passkeyVerifying: 'Passkey 驗證中…',
    googleButton: '使用 Google 登入',
    googleVerifying: 'Google 驗證中…',
    lineButton: '使用 LINE 登入',
    lineVerifying: 'LINE 驗證中…',
    registerSubmit: '立即註冊',
    registering: '註冊中…',
    errors: {
      turnstileRequired: '請先完成真人驗證',
      loginFailed: '登入失敗',
      registerFailed: '註冊失敗',
      googleNotConfigured: 'Google 登入尚未設定完成',
      googleComponentNotLoaded: 'Google 登入元件尚未載入',
      googleStateFailed: '無法建立 Google 登入狀態',
      googleNoCode: '未收到 Google 授權碼',
      googleFailed: 'Google 登入失敗',
      googleCancelled: 'Google 登入已取消',
      passkeyUnsupported: '此瀏覽器不支援 Passkey',
      passkeyChallengeFailed: '無法建立 Passkey 登入挑戰',
      passkeyFailed: 'Passkey 登入失敗',
      lineNotConfigured: 'LINE 登入尚未設定完成',
      lineFailed: 'LINE 登入失敗',
    },
  },
  settings: {
    title: '設定',
    language: {
      title: '語言',
      description: '選擇介面與通知（Email／LINE）使用的語言。',
      saved: '語言偏好已更新',
    },
  },

  // 伺服器端通知（Email + LINE 收支報表）。排程觸發、無 request context，
  // 由 scheduler 依 getUserLanguage(userId) 取得 locale 後傳入 builder。
  // 變數以 {name} 插值：{name} 顯示名稱、{date} 報表日、{weekday} 星期字、
  // {start}/{end} 區間、{month} 報表月、{sendDate} 寄送日、{lead} 期間前綴、
  // {label} 區間說明、{marketValue}/{pl} 股票金額。
  notifications: {
    brand: 'AssetPilot',
    reportType: {
      daily: '每日收支報表',
      weekly: '每週收支報表',
      monthly: '每月收支報表',
    },
    subject: {
      daily: '每日收支報表｜{date}（週{weekday}）',
      weekly: '每週收支報表｜{start} ~ {end}',
      monthly: '每月收支報表｜{month}',
    },
    headerTitle: {
      daily: '{name}，{date}（週{weekday}）的收支',
      weekly: '{name}，{start} ~ {end} 的收支',
      monthly: '{name}，{month} 月的收支',
    },
    headerMeta: {
      daily: '📅 報表日 {date}　·　寄送日 {sendDate}',
      weekly: '📅 報表區間 {start} ~ {end}　·　寄送日 {sendDate}',
      monthly: '📅 報表月 {month}　·　寄送日 {sendDate}',
    },
    banner: {
      daily: '統計昨日（{date} 週{weekday}）整日收支，今日（{sendDate}）寄出',
      weekly: '統計過去 7 日（{start} ~ {end}，共 7 天）收支，今日（{sendDate}）寄出',
      monthly: '統計上月（{month}，{start} ~ {end}）整月收支，本月（{sendDate}）寄出',
    },
    lead: {
      daily: '昨日',
      weekly: '本週',
      monthly: '上月',
    },
    kpi: {
      income: '{lead}收入',
      expense: '{lead}支出',
      net: '{lead}淨額',
    },
    compareLabel: {
      daily: '對比前日',
      weekly: '對比上週',
      monthly: '對比上月',
    },
    periodLabel: {
      daily: '昨日（{date}）',
      weekly: '過去 7 日（{start} ~ {end}）',
      monthly: '上月（{month}）',
    },
    sections: {
      balance: '帳戶餘額',
      topCategories: '本月支出 Top 5',
      topCategoriesMonthly: '{month} 月支出 Top 5',
      dailyDetail: '每日明細',
      monthlyAccrual: '本月累計（{month}）',
      stock: '股票投資',
      recentDaily: '昨日交易',
      recentWeekly: '本週交易',
      recentMonthly: '上月交易',
    },
    labels: {
      income: '收入',
      expense: '支出',
      net: '淨額',
      cost: '總成本',
      marketValue: '市值',
      unrealizedPL: '未實現損益',
      returnRate: '報酬率',
      uncategorized: '未分類',
    },
    table: {
      date: '日期',
    },
    empty: {
      noAccount: '尚無帳戶',
      noExpense: '尚無支出紀錄',
      noTx: '{label}沒有交易',
    },
    stockInline: '股票投資：市值 {marketValue}，未實現損益 {pl}',
    cta: {
      viewFullReport: '查看完整報表',
      viewLineRecord: '查看 LINE 紀錄',
    },
    reminder: {
      altText: '記錄支出提醒',
      title: '記得記錄今天的支出',
      body: '{name}，花 10 秒把今天的支出補上，月底比較不會漏帳。',
      hint: '按下新增支出後，直接輸入：金額 備註 日期（日期可省略）',
      fallbackName: '你',
      addExpense: '新增支出',
      viewToday: '查看今天紀錄',
    },
    fallbackUser: '使用者',
  },
};

// 來源型別：其它語言檔與翻譯器都以此為準。
export type Dictionary = typeof zhTW;

// 部分翻譯型別：允許只填部分鍵，缺漏的由 getDictionary 深層合併回退到 zh-TW。
export type DeepPartialDict<T> = {
  [K in keyof T]?: T[K] extends string ? string : DeepPartialDict<T[K]>;
};

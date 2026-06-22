import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _localePreferenceKey = 'appLocale';

/// The locale used by the native app. Chinese remains the source language so
/// existing user-created data is never rewritten when the interface changes.
final ValueNotifier<String> appLocale = ValueNotifier('zh-TW');

bool get isEnglish => appLocale.value == 'en';

Future<void> loadAppLocale() async {
  final preferences = await SharedPreferences.getInstance();
  final saved = preferences.getString(_localePreferenceKey);
  if (saved == 'en' || saved == 'zh-TW') {
    appLocale.value = saved!;
    return;
  }
  appLocale.value = PlatformDispatcher.instance.locale.languageCode == 'en'
      ? 'en'
      : 'zh-TW';
}

Future<void> setAppLocale(String locale) async {
  final normalized = locale == 'en' ? 'en' : 'zh-TW';
  appLocale.value = normalized;
  final preferences = await SharedPreferences.getInstance();
  await preferences.setString(_localePreferenceKey, normalized);
}

/// Translates a native-app source string. Keeping the Chinese source text as
/// the key makes it possible to migrate screens incrementally without opaque
/// generated identifiers, while still providing a single translation source.
String tr(String source) {
  if (!isEnglish) return source;
  return _en[source] ?? _translateDynamic(source) ?? source;
}

String trPair(String chinese, String english) => isEnglish ? english : chinese;

String? _translateDynamic(String source) {
  Match? match;
  if ((match = RegExp(r'^(\d+) 號$').firstMatch(source)) != null) {
    return 'Day ${match![1]}';
  }
  if ((match = RegExp(r'^上次寄送 (.+)$').firstMatch(source)) != null) {
    return 'Last sent ${match![1]}';
  }
  if ((match = RegExp(r'^目前版本 v(.+)$').firstMatch(source)) != null) {
    return 'Current version v${match![1]}';
  }
  if ((match = RegExp(r'^有新版本 v(.+) 可更新$').firstMatch(source)) != null) {
    return 'Version v${match![1]} is available';
  }
  if ((match = RegExp(r'^每月 (.+) 號$').firstMatch(source)) != null) {
    return 'Monthly on day ${match![1]}';
  }
  if ((match = RegExp(r'^每週(.+)$').firstMatch(source)) != null) {
    return 'Every ${match![1]}';
  }
  if ((match = RegExp(r'^星期(.+)$').firstMatch(source)) != null) {
    return '${match![1]}';
  }
  if ((match = RegExp(r'^建立於 (.+)$').firstMatch(source)) != null) {
    return 'Created ${match![1]}';
  }
  if ((match = RegExp(r'^已更新語言：(.+)$').firstMatch(source)) != null) {
    return 'Language updated: ${match![1]}';
  }
  if ((match = RegExp(r'^載入失敗：(.+)$').firstMatch(source)) != null) {
    return 'Failed to load: ${match![1]}';
  }
  if ((match = RegExp(r'^發生未預期的錯誤：(.+)$').firstMatch(source)) != null) {
    return 'Unexpected error: ${match![1]}';
  }
  if ((match = RegExp(r'^(.+) 登入失敗：(.+)$').firstMatch(source)) != null) {
    return '${match![1]} sign-in failed: ${match![2]}';
  }
  if ((match = RegExp(r'^更新股價失敗：(.+)$').firstMatch(source)) != null) {
    return 'Failed to update prices: ${match![1]}';
  }
  if ((match = RegExp(r'^同步股利失敗：(.+)$').firstMatch(source)) != null) {
    return 'Failed to sync dividends: ${match![1]}';
  }
  if ((match = RegExp(r'^照片上傳失敗：(.+)$').firstMatch(source)) != null) {
    return 'Photo upload failed: ${match![1]}';
  }
  if ((match = RegExp(r'^請求失敗（HTTP (.+)）$').firstMatch(source)) != null) {
    return 'Request failed (HTTP ${match![1]})';
  }
  if ((match = RegExp(r'^登入失敗（HTTP (.+)）$').firstMatch(source)) != null) {
    return 'Sign-in failed (HTTP ${match![1]})';
  }
  if ((match = RegExp(r'^無法連線到後端（(.+)）：(.+)$').firstMatch(source)) != null) {
    return 'Unable to connect to the server (${match![1]}): ${match![2]}';
  }
  return null;
}

const Map<String, String> _en = {
  '首頁': 'Home',
  '記帳': 'Transactions',
  '股票': 'Stocks',
  '更多': 'More',
  '登入': 'Sign in',
  '註冊': 'Sign up',
  '電子郵件': 'Email',
  '密碼': 'Password',
  '顯示名稱': 'Display name',
  '使用 Google 登入': 'Sign in with Google',
  '使用 LINE 登入': 'Sign in with LINE',
  '使用 Passkey 登入': 'Sign in with Passkey',
  '還沒有帳號？註冊': "Don't have an account? Sign up",
  '資產管理 · 安卓客戶端': 'Personal finance · Android app',
  '請輸入有效的電子郵件': 'Enter a valid email address',
  '請輸入密碼': 'Enter your password',
  '請先完成下方的真人驗證': 'Complete the verification below first',
  '註冊並登入': 'Sign up and sign in',
  '請輸入顯示名稱': 'Enter a display name',
  '密碼長度至少 8 字元': 'Password must be at least 8 characters',
  '至少 8 字元，含大小寫、數字與特殊符號':
      'At least 8 characters with uppercase, lowercase, numbers, and symbols',
  '需含大寫、小寫、數字與特殊符號': 'Include uppercase, lowercase, numbers, and symbols',
  '歡迎使用 AssetPilot': 'Welcome to AssetPilot',
  '你的個人資產管家——記帳、預算、台股投資與統計報表，一個 App 全部搞定。花一分鐘快速認識主要功能。':
      'Your personal finance companion for transactions, budgets, Taiwan stocks, and reports. Take a minute to see the essentials.',
  '掌握收支全貌': 'See your complete cash flow',
  '「首頁」依月份顯示收入、支出、淨額與支出分類圓餅圖，左右切換月份，一眼看懂錢花到哪裡。':
      'Home shows monthly income, expenses, net cash flow, and spending categories. Swipe between months to see where your money goes.',
  '隨手記一筆': 'Log transactions in seconds',
  '在底部「記帳」分頁點右下角的「＋」即可新增收入或支出，支援多幣別與帳戶轉帳。交易往左滑可刪除、點一下可編輯。':
      'Tap + on the Transactions tab to add income or expenses. Multiple currencies and account transfers are supported. Swipe left to delete or tap to edit.',
  '追蹤台股投資': 'Track Taiwan stocks',
  '在「股票」分頁輸入股票代號（例如 2330）即可追蹤即時股價、未實現與已實現損益，系統還會自動同步除權息。':
      'Add a ticker such as 2330 on the Stocks tab to track prices, unrealized and realized returns, and automatically sync dividends.',
  '預算、報表與更多': 'Budgets, reports, and more',
  '到「更多」設定每月預算、查看統計報表、管理帳戶與分類，還能設定固定收支與報表通知。準備好了，開始記錄吧！':
      'Use More to set monthly budgets, view reports, manage accounts and categories, schedule recurring transactions, and configure report notifications.',
  '下一步': 'Next',
  '跳過': 'Skip',
  '開始使用': 'Get started',
  '使用教學': 'Getting started',
  '帳戶': 'Accounts',
  '分類': 'Categories',
  '預算': 'Budgets',
  '固定收支': 'Recurring transactions',
  '統計報表': 'Reports',
  '設定': 'Settings',
  '驗證 Sentry 設定（測試用）': 'Test Sentry configuration',
  '收入': 'Income',
  '支出': 'Expenses',
  '本月淨額': 'Net this month',
  '銀行餘額': 'Bank balance',
  '股票市值': 'Stock market value',
  '支出分類': 'Expense categories',
  '最近交易': 'Recent transactions',
  '本月尚無交易': 'No transactions this month',
  '未分類': 'Uncategorized',
  '全部': 'All',
  '清除篩選': 'Clear filters',
  '篩選': 'Filter',
  '記一筆': 'Add transaction',
  '找不到符合篩選的交易': 'No transactions match these filters',
  '尚無交易，點右下角記一筆': 'No transactions yet. Tap Add transaction to begin.',
  '刪除交易': 'Delete transaction',
  '轉帳請於網頁版編輯': 'Edit transfers in the web app',
  '國外刷卡手續費由原交易自動產生，請編輯對應的國外交易':
      'Foreign card fees are generated automatically. Edit the related foreign transaction instead.',
  '篩選交易': 'Filter transactions',
  '起始日': 'Start date',
  '結束日': 'End date',
  '清除日期': 'Clear dates',
  '全部帳戶': 'All accounts',
  '全部分類': 'All categories',
  '備註關鍵字': 'Note keyword',
  '套用': 'Apply',
  '新增交易': 'Add transaction',
  '編輯交易': 'Edit transaction',
  '轉帳': 'Transfer',
  '金額': 'Amount',
  '請輸入大於 0 的金額': 'Enter an amount greater than 0',
  '日期': 'Date',
  '轉出帳戶': 'From account',
  '轉入帳戶': 'To account',
  '請選擇轉入帳戶': 'Select a destination account',
  '轉出與轉入不可相同': 'The source and destination accounts must differ',
  '父分類': 'Parent category',
  '子分類': 'Subcategory',
  '請選擇父分類': 'Select a parent category',
  '請先選擇父分類': 'Select a parent category first',
  '請選擇子分類': 'Select a subcategory',
  '請選擇帳戶': 'Select an account',
  '幣別': 'Currency',
  '留空則使用系統匯率': 'Leave blank to use the system exchange rate',
  '匯率須大於 0': 'Exchange rate must be greater than 0',
  '備註（選填）': 'Note (optional)',
  '海外手續費 TWD（選填）': 'Foreign transaction fee in TWD (optional)',
  '不計入統計': 'Exclude from reports',
  '新增照片（選填）': 'Add photos (optional)',
  '單筆交易最多上傳 5 張照片': 'Up to 5 photos per transaction',
  '從相簿選擇': 'Choose from gallery',
  '拍照': 'Take photo',
  '刪除照片': 'Delete photo',
  '確定要刪除這張已上傳的照片嗎？此動作無法復原。':
      'Delete this uploaded photo? This cannot be undone.',
  '照片載入失敗': 'Failed to load photo',
  '刪除': 'Delete',
  '取消': 'Cancel',
  '儲存': 'Save',
  '帳戶名稱': 'Account name',
  '類型': 'Type',
  '銀行': 'Bank',
  '現金': 'Cash',
  '信用卡': 'Credit card',
  '電子錢包': 'E-wallet',
  '初始餘額': 'Opening balance',
  '不計入總資產': 'Exclude from total assets',
  '海外手續費率（%）': 'Foreign transaction fee (%)',
  '例：1.5 代表 1.5%，外幣刷卡時自動計算手續費':
      'Example: 1.5 means 1.5%; fees are calculated automatically for foreign purchases',
  '結帳日（每月幾號，1~31）': 'Statement closing day (1–31)',
  '設定後帳戶卡片會顯示本期帳單消費，留空則不統計':
      'When set, the account card shows spending for the current statement period',
  '新增帳戶': 'Add account',
  '編輯帳戶': 'Edit account',
  '刪除帳戶': 'Delete account',
  '尚無帳戶': 'No accounts yet',
  '總資產（換算 TWD）': 'Total assets (in TWD)',
  '本期': 'Current period',
  '上期帳單 ': 'Previous statement ',
  '每期帳單明細': 'Statement details',
  '信用卡還款': 'Credit card payment',
  '需至少一張信用卡與一個非信用卡帳戶才能還款':
      'A credit card and a non-credit-card account are required',
  '付款帳戶': 'Payment account',
  '各卡還款金額（以卡片幣別計）': 'Payment amount for each card (in card currency)',
  '0＝不還': '0 = no payment',
  '請至少填一張卡的還款金額': 'Enter a payment for at least one card',
  '確認還款': 'Confirm payment',
  '還款已記錄': 'Payment recorded',
  '尚無資料': 'No data',
  '「繳款」已對應回它所清償的帳單（結帳後下一期繳清的金額算回該期）。':
      'Payments are assigned to the statement they settle, including payments made in the following period.',
  '請輸入名稱': 'Enter a name',
  '請輸入 1~31': 'Enter a value from 1 to 31',
  '新增分類': 'Add category',
  '編輯分類': 'Edit category',
  '刪除分類': 'Delete category',
  '尚無分類': 'No categories yet',
  '分類名稱': 'Category name',
  '父分類（不選＝建立父分類）': 'Parent category (none creates a parent)',
  '（無，作為父分類）': '(None — create as parent)',
  '顏色': 'Color',
  '月度總預算': 'Monthly budget',
  '新增預算': 'Add budget',
  '本月尚無預算': 'No budget this month',
  '未知分類': 'Unknown category',
  '預算金額': 'Budget amount',
  '請輸入正整數': 'Enter a positive whole number',
  '新增固定收支': 'Add recurring transaction',
  '編輯固定收支': 'Edit recurring transaction',
  '尚無固定收支': 'No recurring transactions',
  '每日': 'Daily',
  '每週': 'Weekly',
  '每月': 'Monthly',
  '每年': 'Yearly',
  '週期': 'Frequency',
  '起始日期': 'Start date',
  '請選擇分類': 'Select a category',
  '此區間無資料': 'No data for this period',
  '報表通知': 'Report notifications',
  '新增排程': 'Add schedule',
  '新增報表排程': 'Add report schedule',
  '編輯報表排程': 'Edit report schedule',
  '刪除排程': 'Delete schedule',
  '確定刪除此報表通知排程？': 'Delete this report notification schedule?',
  '尚無排程，點右下角新增\n可設定每日／每週／每月定時收到收支報表':
      'No schedules yet. Tap Add to receive daily, weekly, or monthly reports.',
  'Email 通知': 'Email notifications',
  'LINE 通知': 'LINE notifications',
  '需已綁定 LINE': 'Requires a linked LINE account',
  '啟用': 'Enabled',
  '星期': 'Day of week',
  '日': 'Day',
  '一': 'Mon',
  '二': 'Tue',
  '三': 'Wed',
  '四': 'Thu',
  '五': 'Fri',
  '六': 'Sat',
  '時間': 'Time',
  '每月最後一天': 'Last day of each month',
  '尚未寄送': 'Not sent yet',
  '請至少選擇一種通知方式': 'Select at least one notification method',
  '股票設定': 'Stock settings',
  '更新股價': 'Update prices',
  '同步股利': 'Sync dividends',
  '持股': 'Holdings',
  '交易': 'Transactions',
  '股利': 'Dividends',
  '損益': 'Returns',
  '尚無持股': 'No holdings yet',
  '總市值': 'Market value',
  '未實現損益': 'Unrealized P/L',
  '報酬率': 'Return',
  '下市': 'Delisted',
  '新增股票': 'Add stock',
  '編輯股票': 'Edit stock',
  '刪除股票': 'Delete stock',
  '股票代號（如 2330）': 'Ticker (e.g. 2330)',
  '名稱': 'Name',
  '名稱（選填，留空自動帶入）': 'Name (optional; filled automatically)',
  '類型（影響證交稅率）': 'Type (affects transaction tax)',
  '一般股票': 'Stock',
  '權證': 'Warrant',
  '請輸入代號': 'Enter a ticker',
  '尚無股票交易': 'No stock transactions',
  '新增股票交易': 'Add stock transaction',
  '編輯股票交易': 'Edit stock transaction',
  '買': 'Buy',
  '賣': 'Sell',
  '買進': 'Buy',
  '賣出': 'Sell',
  '股數': 'Shares',
  '價格': 'Price',
  '手續費（選填）': 'Fee (optional)',
  '證交稅（選填）': 'Transaction tax (optional)',
  '自動': 'Automatic',
  '手續費／證交稅留空則由後端自動計算':
      'Leave fee and tax blank to calculate them automatically',
  '正整數': 'Positive whole number',
  '請先到「持股」分頁新增股票': 'Add a stock on the Holdings tab first',
  '請選擇股票': 'Select a stock',
  '尚無股利紀錄': 'No dividend records',
  '新增股利': 'Add dividend',
  '編輯股利': 'Edit dividend',
  '刪除股利': 'Delete dividend',
  '現金股利（總額，選填）': 'Cash dividend (total, optional)',
  '配股股數（選填）': 'Stock dividend shares (optional)',
  '入款帳戶（含現金股利時必填）': 'Deposit account (required for cash dividends)',
  '未指定': 'Not specified',
  '現金股利與配股至少填一項': 'Enter a cash or stock dividend',
  '含現金股利時，入款帳戶為必填': 'A deposit account is required for cash dividends',
  '尚無已實現損益': 'No realized returns',
  '已實現損益合計': 'Total realized P/L',
  '沒有可更新的股價': 'No prices to update',
  '沒有新的股利可同步': 'No new dividends to sync',
  '手續費': 'Commission',
  '手續費率（%）': 'Commission rate (%)',
  '折讓（0~1）': 'Discount (0–1)',
  '例：0.6 代表 6 折': 'Example: 0.6 means a 40% discount',
  '整股最低手續費': 'Minimum board-lot commission',
  '零股最低手續費': 'Minimum odd-lot commission',
  '證交稅（賣出）': 'Transaction tax (sell)',
  '一般股票（%）': 'Stocks (%)',
  '權證（%）': 'Warrants (%)',
  '最低證交稅': 'Minimum transaction tax',
  '券商公定 0.1425%': 'Standard brokerage rate: 0.1425%',
  '公定 0.3%': 'Standard rate: 0.3%',
  '公定 0.1%': 'Standard rate: 0.1%',
  '請輸入 ≥ 0 的數字': 'Enter a number greater than or equal to 0',
  '修改顯示名稱': 'Change display name',
  '已更新': 'Updated',
  '管理員': 'Admin',
  '主題': 'Theme',
  '淺色': 'Light',
  '深色': 'Dark',
  '跟隨系統': 'Use system setting',
  '選擇主題': 'Choose theme',
  '幣別設定': 'Currency settings',
  '預設幣別與常用幣別': 'Default and frequently used currencies',
  '語言': 'Language',
  '語言（APP、通知與網頁版）': 'App, notification, and web language',
  '繁體中文': 'Traditional Chinese',
  '繁體中文 / English': 'Traditional Chinese / English',
  '自訂定期收支報表寄送時間': 'Customize scheduled cash-flow reports',
  '帳號安全': 'Account security',
  '修改密碼': 'Change password',
  '設定密碼': 'Set password',
  'Passkey 管理': 'Manage passkeys',
  '帳號綁定': 'Linked accounts',
  '登入裝置': 'Signed-in devices',
  '登入紀錄': 'Sign-in history',
  '版本資訊': 'Version information',
  '查看目前版本與更新內容': 'View the current version and release notes',
  '登出': 'Sign out',
  '刪除帳號': 'Delete account',
  '永久刪除帳號與所有資料，無法復原': 'Permanently delete your account and all data',
  '此操作將永久刪除您的帳號與所有資料（交易、帳戶、股票與設定），且無法復原。':
      'This permanently deletes your account and all data, including transactions, accounts, stocks, and settings. This cannot be undone.',
  '請輸入密碼以確認': 'Enter your password to confirm',
  '請輸入帳號電子信箱以確認': 'Enter the account email to confirm',
  '請輸入密碼以確認刪除': 'Enter your password to confirm deletion',
  '請輸入正確的帳號電子信箱以確認刪除': 'Enter the correct account email to confirm deletion',
  '永久刪除': 'Delete permanently',
  '帳號已刪除': 'Account deleted',
  '目前密碼': 'Current password',
  '新密碼': 'New password',
  '至少 8 字元': 'At least 8 characters',
  '需含大小寫、數字與特殊符號': 'Include uppercase, lowercase, numbers, and symbols',
  '變更後其他裝置將被登出。': 'Other devices will be signed out after this change.',
  '密碼已更新': 'Password updated',
  '請輸入目前密碼': 'Enter your current password',
  '新增 Passkey': 'Add passkey',
  '未命名 Passkey': 'Unnamed passkey',
  '尚未註冊任何 Passkey': 'No passkeys registered',
  '重新命名': 'Rename',
  '刪除 Passkey': 'Delete passkey',
  '於瀏覽器完成註冊（需裝置生物辨識）':
      'Complete registration in the browser (device biometrics required)',
  '無法開啟瀏覽器': 'Unable to open browser',
  '已儲存': 'Saved',
  '綁定需於瀏覽器完成授權；解除綁定前請確認仍可用其他方式登入。':
      'Linking is completed in the browser. Before unlinking, make sure another sign-in method is available.',
  '已綁定': 'Linked',
  '未綁定': 'Not linked',
  '綁定': 'Link',
  '解除': 'Unlink',
  '已解除綁定': 'Unlinked',
  '目前裝置': 'Current device',
  '未知裝置': 'Unknown device',
  '尚無登入裝置紀錄': 'No signed-in device records',
  '尚無登入紀錄': 'No sign-in history',
  '已登出該裝置': 'Device signed out',
  '預設幣別': 'Default currency',
  '常用幣別': 'Frequently used currencies',
  'TWD 一律包含。勾選的幣別會出現在交易/固定收支的幣別清單前段。':
      'TWD is always included. Selected currencies appear first in transaction and recurring-transaction lists.',
  '目前沒有更新內容': 'No release notes available',
  '已是最新版本': 'Up to date',
  '可更新內容': "What's new",
  '最近更新內容': 'Recent updates',
  '重新檢查': 'Check again',
  '新增': 'Added',
  '改進': 'Improved',
  '修正': 'Fixed',
  '更新': 'Updated',
  '移除': 'Removed',
  '注意': 'Notice',
  '重試': 'Retry',
  '已刪除': 'Deleted',
  '無法建立 Google 登入狀態': 'Unable to create Google sign-in state',
  '無法建立 LINE 登入狀態': 'Unable to create LINE sign-in state',
  '無法開啟瀏覽器進行 Google 登入': 'Unable to open the browser for Google sign-in',
  '無法開啟瀏覽器進行 LINE 登入': 'Unable to open the browser for LINE sign-in',
  '無法開啟瀏覽器進行 Passkey 登入': 'Unable to open the browser for passkey sign-in',
  'Google 登入逾時或已取消': 'Google sign-in timed out or was cancelled',
  'LINE 登入逾時或已取消': 'LINE sign-in timed out or was cancelled',
  'Passkey 登入逾時或已取消': 'Passkey sign-in timed out or was cancelled',
  'Google 登入狀態不符，請重試': 'Google sign-in state mismatch. Try again.',
  'LINE 登入狀態不符，請重試': 'LINE sign-in state mismatch. Try again.',
  '登入已過期，請重新登入': 'Your session expired. Sign in again.',
  '登入失敗': 'Sign-in failed',
  '登入成功': 'Signed in',
  '登入請求連線失敗': 'Sign-in request connection failed',
  '電子郵件或密碼錯誤': 'Incorrect email or password',
  '登入回應未包含認證 Cookie，請確認後端設定':
      'The sign-in response did not include an authentication cookie',
  '註冊回應未包含認證 Cookie，請確認後端設定':
      'The sign-up response did not include an authentication cookie',
  'Google 登入回應未包含認證 Cookie':
      'The Google sign-in response did not include an authentication cookie',
  'LINE 登入回應未包含認證 Cookie':
      'The LINE sign-in response did not include an authentication cookie',
  'App 登入回應未包含認證 Cookie':
      'The app sign-in response did not include an authentication cookie',
  'API 請求連線失敗': 'API request connection failed',
  'API 回應 401，工作階段已過期並清除本機登入':
      'API returned 401; the expired local session was cleared',
  'API 請求失敗': 'API request failed',
  '使用者登出，已清除本機登入': 'Signed out and cleared the local session',
  '股利同步完成': 'Dividend sync completed',
};

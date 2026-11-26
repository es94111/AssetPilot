type SourceGroup = 'payment' | 'bank';

function source(id: string, name: string, group: SourceGroup, ...appNames: string[]) {
  return { id, name, group, appNames, availability: appNames.length ? 'unverified' : 'unavailable' } as const;
}

// Use exact aliases from iOS app labels and listings. A brand in notification
// text is not a substitute for the source App selected in Shortcuts.
export const notificationSources = [
  source('line-pay', 'LINE Pay', 'payment', 'LINE Pay', 'LINE Pay - 支付體驗 煥然一新'),
  source('jko-pay', '街口支付', 'payment', '街口支付', '街口支付 JKOPAY', 'JKOPAY'),
  source('px-pay-plus', '全支付', 'payment', '全支付', '全支付 PXPay Plus', 'PXPay Plus'),
  source('ipass-money', '一卡通 iPASS MONEY', 'payment', '一卡通 iPASS MONEY', 'iPASS MONEY', '一卡通MONEY'),
  source('easy-wallet', '悠遊付', 'payment', '悠遊付', '悠遊付 Easy Wallet', 'Easy Wallet', 'EasyWallet'),
  source('esun-wallet', '玉山 Wallet', 'payment', '玉山Wallet', 'E.SUN Wallet'),
  source('icash-pay', 'icash Pay', 'payment', 'icash Pay'),
  source('plus-pay', '全盈+PAY', 'payment', '全盈+PAY', '全盈支付'),
  source('taiwan-pay', '台灣 Pay', 'payment', '台灣Pay', '台灣行動支付', '臺灣行動支付', 'Taiwan Pay'),
  source('google-wallet', 'Google 錢包', 'payment'),
  source('samsung-pay', 'Samsung Pay', 'payment'),
  source('px-pay', 'PX Pay', 'payment', '全聯福利中心', 'PX Pay', '全聯PX Pay', '全聯福利中心 - 集點、支付、小時達、印花'),
  source('ctbc', '中國信託', 'bank', '中國信託行動銀行', '中國信託', '中信行動銀行', 'Home Bank', 'HomeBank'),
  source('cathay', '國泰世華', 'bank', '國泰世華網路銀行CUBE', '國泰世華CUBE', 'CUBE', '國泰世華'),
  source('esun-bank', '玉山銀行', 'bank', '玉山行動銀行', '玉山銀行', 'E.SUN Mobile Banking'),
  source('fubon', '台北富邦', 'bank', 'Fubon+ 台北富邦行動銀行', 'Fubon+', '富邦行動銀行', '台北富邦行動銀行'),
  source('taishin', '台新銀行', 'bank', '台新銀行【行動銀行】', '台新行動銀行', '台新銀行', 'Richart'),
  source('sinopac', '永豐銀行', 'bank', '永豐銀行行動銀行', '永豐銀行行動銀行-新版', '永豐行動銀行', '永豐銀行大戶DAWHO', 'DAWHO', '大戶DAWHO'),
  source('ubot', '聯邦銀行', 'bank', '聯邦行動銀行', '聯邦銀行', '聯邦銀行信用卡', '聯邦信用卡', '新New Bank'),
  source('first-bank', '第一銀行', 'bank', '第e行動', '第一銀行', '第一銀行第e行動', 'iLEO'),
  source('tcb', '合作金庫', 'bank', '合作金庫銀行', '合作金庫', '合庫行動銀行', '合庫行動網銀'),
  source('hncb', '華南銀行', 'bank', '華南銀行+', '華南銀行', '華南銀行行動銀行', 'SnY'),
  source('mega', '兆豐銀行', 'bank', '兆豐銀行', '兆豐銀行行動銀行', '兆豐行動銀行', '兆豐銀行信用卡'),
  source('bank-of-taiwan', '臺灣銀行', 'bank', '臺灣銀行 臺銀行動+', '臺銀行動+', '台銀行動+', '臺灣銀行', '台灣銀行', '臺灣銀行行動銀行'),
  source('chb', '彰化銀行', 'bank', '彰銀行動網', '彰化銀行', '彰銀行動銀行'),
  source('land-bank', '土地銀行', 'bank', '土銀行動銀行', '土地銀行', '土地銀行行動銀行'),
  source('line-bank', 'LINE Bank', 'bank', 'LINE Bank Taiwan', 'LINE Bank', 'LINE Bank 連線銀行'),
  source('next-bank', '將來銀行', 'bank', '將來銀行', 'NEXT BANK 將來銀行', 'NEXT BANK'),
  source('feib', '遠東商銀', 'bank', '遠東商銀行動銀行APP2.0', '遠東商銀行動銀行', '遠東商銀', 'Bankee+', 'Bankee'),
  source('dbs', '星展銀行', 'bank', '星展行動銀行', '星展 digibank', 'DBS digibank TW', '星展Card+', 'DBS Card+ TW', '星展銀行'),
  source('hsbc', '滙豐銀行', 'bank', '滙豐（台灣）', '匯豐（台灣）', '滙豐(台灣)信用卡', '匯豐(台灣)信用卡', 'HSBC Taiwan', '滙豐銀行'),
  source('standard-chartered', '渣打銀行', 'bank', '渣打行動銀行', '渣打銀行', 'SC Mobile Taiwan', 'SC Mobile 台灣'),
  source('rakuten-card', '樂天信用卡', 'bank', '樂天信用卡', '台灣樂天信用卡', '台灣樂天Card', '樂天卡'),
  source('kgi', '凱基銀行', 'bank', '凱基銀行', '凱基行動銀行', '凱基銀行行動銀行', 'KGI Bank', '凱基銀行信用卡'),
] as const;

export function findNotificationSource(id: string) {
  return notificationSources.find((entry) => entry.id === id && entry.availability !== 'unavailable');
}

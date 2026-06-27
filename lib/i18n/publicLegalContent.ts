import type { Locale } from './config';
import type { TranslateFn } from './translate';
import type { LegalDocumentContent } from '@/components/public/LegalDocument';

type LegalKind = 'terms' | 'privacy';

function links(t: TranslateFn) {
  return [
    { href: '/privacy', icon: 'fa-shield-halved', label: t('public.common.privacy') },
    { href: '/terms', icon: 'fa-file-contract', label: t('public.common.terms') },
    { href: '/api-credits', icon: 'fa-plug', label: t('public.common.apiCredits') },
    { href: '/', icon: 'fa-house', label: t('public.common.backHome') },
  ];
}

const zhTermsSections: LegalDocumentContent['sections'] = [
  {
    icon: 'fa-circle-info',
    title: '服務說明',
    blocks: [
      { type: 'p', text: '「AssetPilot」是一款個人財務管理應用程式，提供記帳、預算管理、股票紀錄、報表分析等功能，並以網頁及 Android 行動應用程式形式提供。' },
      { type: 'p', text: '本服務提供官方版本與開放原始碼的自行部署（Self-hosted）兩種選項。官方版本由 AssetPilot 營運，預設後端為 asset.shao.one；自行部署情境則由您的部署管理者負責維運。' },
      { type: 'note', text: '本服務僅供個人財務記錄與管理用途，不提供任何投資建議、財務諮詢或金融服務。' },
    ],
  },
  {
    icon: 'fa-user-lock',
    title: '帳號與存取',
    blocks: [
      { type: 'h3', text: '帳號建立' },
      { type: 'p', text: '使用本服務須建立帳號。您可透過電子郵件與密碼，或管理員啟用的 Google、LINE、Passkey 等登入方式完成註冊或登入。' },
      { type: 'h3', text: '帳號安全' },
      { type: 'ul', items: ['您有責任妥善保管帳號密碼，不得與他人共用。', '請使用足夠強度的密碼，避免與其他服務共用相同密碼。', '若發現帳號遭未授權使用，請立即變更密碼並通知管理員。', '您對以您帳號名義發生的所有操作負完全責任。'] },
      { type: 'h3', text: '帳號資格' },
      { type: 'p', text: '本服務由管理員決定是否開放公開註冊。管理員有權在任何時候停用或刪除任何帳號。' },
    ],
  },
  {
    icon: 'fa-user-check',
    title: '使用者責任',
    blocks: [
      { type: 'p', text: '使用本服務時，您同意：' },
      { type: 'ul', items: ['輸入真實、準確的財務資料，並自行負責輸入資料的正確性。', '定期備份重要資料，可透過設定頁的資料匯出功能匯出 CSV。', '遵守適用法律法規，不將本服務用於任何非法目的。', '不干擾其他使用者的正常使用。'] },
    ],
  },
  {
    icon: 'fa-ban',
    title: '禁止行為',
    blocks: [
      { type: 'p', text: '使用本服務時，嚴格禁止以下行為：' },
      { type: 'ul', items: ['嘗試未授權存取系統、資料庫或其他使用者資料。', '未經管理員書面授權進行滲透測試、漏洞掃描或安全測試。', '發送超出正常使用範圍的大量自動化請求。', '繞過身份驗證、速率限制或其他安全機制。', '上傳含惡意程式碼、病毒或有害內容的資料。', '使用本服務從事洗錢、逃稅或任何違法財務活動紀錄。', '冒充他人身份建立帳號。'] },
      { type: 'warning', text: '違反上述禁止行為將導致帳號立即終止，情節嚴重者管理員保留追究法律責任的權利。' },
    ],
  },
  {
    icon: 'fa-database',
    title: '資料所有權',
    blocks: [
      { type: 'h3', text: '您的資料' },
      { type: 'p', text: '您輸入至本服務的所有財務資料均屬於您個人所有。本服務不主張對您的資料擁有任何所有權。' },
      { type: 'h3', text: '資料可攜性' },
      { type: 'p', text: '您可以隨時透過資料匯出匯入功能將資料匯出為 CSV 格式，以確保資料的可攜性與備份。' },
      { type: 'h3', text: '資料刪除' },
      { type: 'p', text: '刪除帳號時，您的所有資料將被永久刪除，且無法復原。請在刪除帳號前務必先完成資料匯出。' },
      { type: 'h3', text: '伺服器儲存' },
      { type: 'p', text: '您的資料儲存於管理員提供的伺服器上。管理員有義務採取合理措施保護資料安全，但不對因不可抗力、硬體故障或其他意外情況造成的資料遺失負責。' },
    ],
  },
  {
    icon: 'fa-server',
    title: '服務可用性',
    blocks: [
      { type: 'p', text: '本服務以「現狀」提供，不保證服務的持續可用性。伺服器維護、網路故障、系統更新或不可抗力事件都可能導致服務中斷。' },
      { type: 'h3', text: '外部服務依賴' },
      { type: 'p', text: '本服務部分功能依賴第三方 API，例如 TWSE 股價、匯率 API、登入服務等。相關功能可能因第三方服務中斷而暫時無法使用。' },
    ],
  },
  {
    icon: 'fa-circle-exclamation',
    title: '免責聲明',
    blocks: [
      { type: 'warning', text: '本服務不提供投資建議。股票價格、損益計算、資產報表等資料僅作為個人記帳與追蹤用途，不構成任何投資建議或財務諮詢意見。' },
      { type: 'p', text: '本服務不承擔因投資決策、第三方資料準確性、稅務合規、資料遺失或間接損失所造成的責任。' },
    ],
  },
  {
    icon: 'fa-scale-balanced',
    title: '責任限制',
    blocks: [
      { type: 'p', text: '在適用法律允許的最大範圍內，本服務管理員對因使用或無法使用本服務所造成的任何直接、間接、附帶、特殊或懲罰性損害不承擔責任。' },
      { type: 'p', text: '管理員的總體責任在任何情況下均不超過您在過去十二個月內為使用本服務所支付的費用；若本服務為免費提供，則責任上限為新臺幣一元。' },
    ],
  },
  {
    icon: 'fa-file-pen',
    title: '條款修改',
    blocks: [
      { type: 'p', text: '管理員保留隨時修改本服務條款的權利。重大變更將透過版本更新資訊或應用程式內通知告知使用者。' },
      { type: 'p', text: '修改後繼續使用本服務，視為您接受更新後的條款；若您不同意，請停止使用本服務並刪除帳號。' },
    ],
  },
  {
    icon: 'fa-power-off',
    title: '終止服務',
    blocks: [
      { type: 'h3', text: '使用者終止' },
      { type: 'p', text: '您可以隨時於帳號設定刪除帳號以終止使用本服務。建議刪除前先匯出所有資料。' },
      { type: 'h3', text: '管理員終止' },
      { type: 'p', text: '管理員有權在違反服務條款、長期未使用、伺服器資源限制或服務整體關閉等情況終止帳號存取。' },
    ],
  },
  {
    icon: 'fa-envelope',
    title: '聯絡方式',
    blocks: [
      { type: 'p', text: '若您對本服務條款有任何疑問，請透過帳號設定頁面中的意見回饋功能，或直接聯絡您的系統管理員。' },
    ],
  },
];

const enTermsSections: LegalDocumentContent['sections'] = [
  {
    icon: 'fa-circle-info',
    title: 'Service Description',
    blocks: [
      { type: 'p', text: 'AssetPilot is a personal finance management application that provides bookkeeping, budgeting, stock records, reports, and analysis through web and Android app experiences.' },
      { type: 'p', text: 'The service is available as an official hosted service and as open-source self-hosted software. The official service is operated by AssetPilot with asset.shao.one as the default backend; self-hosted deployments are operated by your deployment administrator.' },
      { type: 'note', text: 'The service is for personal financial recordkeeping and management only. It does not provide investment advice, financial consulting, or financial services.' },
    ],
  },
  {
    icon: 'fa-user-lock',
    title: 'Accounts and Access',
    blocks: [
      { type: 'h3', text: 'Account creation' },
      { type: 'p', text: 'You must create an account to use the service. Depending on administrator configuration, you may sign up or sign in with email and password, Google, LINE, or Passkey.' },
      { type: 'h3', text: 'Account security' },
      { type: 'ul', items: ['You are responsible for safeguarding your account credentials and must not share them.', 'Use a strong password and avoid reusing passwords from other services.', 'If you discover unauthorized account use, change your password and notify the administrator immediately.', 'You are responsible for all activity performed under your account.'] },
      { type: 'h3', text: 'Account eligibility' },
      { type: 'p', text: 'The administrator decides whether public registration is available and may disable or delete accounts at any time.' },
    ],
  },
  {
    icon: 'fa-user-check',
    title: 'User Responsibilities',
    blocks: [
      { type: 'p', text: 'When using the service, you agree to:' },
      { type: 'ul', items: ['Enter truthful and accurate financial data and remain responsible for its correctness.', 'Back up important data regularly by using the export features.', 'Comply with applicable laws and not use the service for unlawful purposes.', 'Avoid interfering with normal use by other users.'] },
    ],
  },
  {
    icon: 'fa-ban',
    title: 'Prohibited Conduct',
    blocks: [
      { type: 'p', text: 'The following conduct is strictly prohibited:' },
      { type: 'ul', items: ['Attempting unauthorized access to systems, databases, or other users’ data.', 'Performing penetration tests, vulnerability scans, or security testing without written administrator authorization.', 'Sending excessive automated requests outside normal use.', 'Bypassing authentication, rate limits, or other security controls.', 'Uploading malicious code, viruses, or harmful content.', 'Using the service to record money laundering, tax evasion, or illegal financial activity.', 'Impersonating another person to create an account.'] },
      { type: 'warning', text: 'Violations may result in immediate account termination. For serious violations, the administrator reserves the right to pursue legal remedies.' },
    ],
  },
  {
    icon: 'fa-database',
    title: 'Data Ownership',
    blocks: [
      { type: 'h3', text: 'Your data' },
      { type: 'p', text: 'All financial data you enter into the service belongs to you. The service does not claim ownership of your data.' },
      { type: 'h3', text: 'Portability' },
      { type: 'p', text: 'You may export your data as CSV through the export/import features for portability and backup.' },
      { type: 'h3', text: 'Deletion' },
      { type: 'p', text: 'When you delete your account, your data is permanently deleted and cannot be recovered. Export your data before deletion.' },
      { type: 'h3', text: 'Server storage' },
      { type: 'p', text: 'Your data is stored on servers provided by the administrator. The administrator must take reasonable security measures, but is not responsible for loss caused by force majeure, hardware failures, or other unexpected events.' },
    ],
  },
  {
    icon: 'fa-server',
    title: 'Service Availability',
    blocks: [
      { type: 'p', text: 'The service is provided “as is” and continuous availability is not guaranteed. Maintenance, network failures, updates, urgent fixes, or force majeure events may interrupt service.' },
      { type: 'h3', text: 'External dependencies' },
      { type: 'p', text: 'Some features rely on third-party APIs, such as TWSE market data, exchange-rate APIs, and sign-in services. These features may become temporarily unavailable if third-party services are interrupted.' },
    ],
  },
  {
    icon: 'fa-circle-exclamation',
    title: 'Disclaimer',
    blocks: [
      { type: 'warning', text: 'The service does not provide investment advice. Stock prices, profit/loss calculations, and asset reports are for personal tracking only and are not investment or financial advice.' },
      { type: 'p', text: 'The service is not responsible for investment decisions, third-party data accuracy, tax compliance, data loss, or indirect losses arising from service use.' },
    ],
  },
  {
    icon: 'fa-scale-balanced',
    title: 'Limitation of Liability',
    blocks: [
      { type: 'p', text: 'To the maximum extent permitted by law, the administrator is not liable for direct, indirect, incidental, special, or punitive damages arising from using or being unable to use the service.' },
      { type: 'p', text: 'The administrator’s aggregate liability will not exceed the amount you paid for the service in the previous twelve months; if the service is free, liability is capped at NT$1.' },
    ],
  },
  {
    icon: 'fa-file-pen',
    title: 'Changes to Terms',
    blocks: [
      { type: 'p', text: 'The administrator may update these terms at any time. Material changes will be announced through changelog information or in-app notices.' },
      { type: 'p', text: 'Continuing to use the service after changes means you accept the updated terms. If you disagree, stop using the service and delete your account.' },
    ],
  },
  {
    icon: 'fa-power-off',
    title: 'Termination',
    blocks: [
      { type: 'h3', text: 'User termination' },
      { type: 'p', text: 'You may delete your account in account settings at any time to stop using the service. Export your data first.' },
      { type: 'h3', text: 'Administrator termination' },
      { type: 'p', text: 'The administrator may terminate account access for terms violations, long inactivity, resource constraints, or shutdown of the service.' },
    ],
  },
  {
    icon: 'fa-envelope',
    title: 'Contact',
    blocks: [
      { type: 'p', text: 'If you have questions about these terms, use the feedback option in account settings or contact your system administrator directly.' },
    ],
  },
];

const zhPrivacySections: LegalDocumentContent['sections'] = [
  {
    icon: 'fa-globe',
    title: '適用範圍',
    blocks: [
      { type: 'p', text: '本隱私權政策由 AssetPilot 發布，適用於 AssetPilot 應用程式與網頁服務的所有使用者。當您存取或使用本服務時，即表示您同意本政策所描述的資料處理方式。' },
      { type: 'p', text: '官方版本由 AssetPilot 營運；自行部署版本由您的伺服器環境負責，AssetPilot 不會接觸您自架實例中的資料。' },
      { type: 'p', text: '本服務並非針對 13 歲以下兒童設計，我們不會在知情的情況下收集兒童的個人資料。' },
    ],
  },
  {
    icon: 'fa-database',
    title: '收集的資料',
    blocks: [
      { type: 'h3', text: '帳號資料' },
      { type: 'ul', items: ['電子信箱、顯示名稱、bcrypt 雜湊後的密碼。', 'Google 帳號資料（僅 Google SSO 登入時）。', 'LINE 使用者識別碼（僅 LINE 登入或綁定時）。', 'Passkey 公開金鑰資料（僅啟用 Passkey 時）。'] },
      { type: 'h3', text: '財務資料' },
      { type: 'ul', items: ['交易記錄、帳戶資訊、預算設定、固定收支設定。', '股票買賣紀錄、股利紀錄、分類與標籤資料。'] },
      { type: 'h3', text: '交易附件（選配）' },
      { type: 'p', text: '您可自行選擇附加收據相片或檔案；若未使用此功能，本服務不會存取您的相片或檔案。' },
      { type: 'h3', text: '系統日誌' },
      { type: 'ul', items: ['登入紀錄（時間、來源 IP、裝置類型）用於安全稽核。', 'API 請求錯誤日誌，不含個人財務內容。', '行動版當機與診斷資料，僅用於問題修復，且已遮罩敏感畫面內容。'] },
      { type: 'note', text: '本服務不收集廣告識別碼、行為追蹤資料或任何與財務管理無關的個人資料。' },
    ],
  },
  {
    icon: 'fa-bullseye',
    title: '資料使用目的',
    blocks: [
      { type: 'ul', items: ['提供服務：顯示財務資料、計算報表與統計分析。', '帳號驗證：確認身份以保護帳號安全。', '功能運作：固定收支、股價同步、匯率更新等自動化功能。', '安全防護：偵測異常登入行為。', '資料匯出：依您的請求產生 CSV 匯出檔案。'] },
      { type: 'p', text: '我們不會將您的資料用於廣告投放、行銷分析或任何與服務無關的商業目的。' },
    ],
  },
  {
    icon: 'fa-lock',
    title: '資料儲存與安全',
    blocks: [
      { type: 'h3', text: '加密儲存' },
      { type: 'p', text: '資料庫採用 ChaCha20-Poly1305 對稱加密演算法進行落地加密。' },
      { type: 'h3', text: '密碼安全' },
      { type: 'p', text: '使用者密碼以 bcrypt 雜湊後才儲存，系統不保存明文密碼。' },
      { type: 'h3', text: '傳輸安全' },
      { type: 'p', text: '官方服務一律透過 HTTPS 傳輸；JWT 令牌儲存於 HttpOnly Cookie。' },
      { type: 'h3', text: '安全防護措施' },
      { type: 'ul', items: ['HTTP 安全標頭、登入速率限制、CORS 來源控制。', '外部 CDN 資源 SRI 驗證。', '輸入資料的 XSS 防護處理。'] },
    ],
  },
  {
    icon: 'fa-share-nodes',
    title: '資料分享',
    blocks: [
      { type: 'p', text: '本服務不會將您的個人資料或財務資料出售、出租或分享給第三方，除非有您的明確同意、法律要求，或為完成您啟用的功能而必要。' },
      { type: 'ul', items: ['查詢股價時會向 TWSE 發送股票代號。', '匯率同步時會向 exchangerate-api.com 查詢匯率。', '登入稽核可能將 IP 傳送至 IPinfo 查詢國家／地區。', '通知郵件可能透過 SMTP、Zeabur Email 或 Resend 寄送。', '管理員備份可能上傳至 MEGA S4 物件儲存。', '行動版診斷資料可能傳送至 Sentry。'] },
    ],
  },
  {
    icon: 'fa-cookie-bite',
    title: 'Cookie 與本地儲存',
    blocks: [
      { type: 'p', text: '本服務使用 auth_token（HttpOnly, Secure）儲存 JWT 身份驗證令牌，並使用 locale cookie 儲存語言偏好。' },
      { type: 'p', text: 'LocalStorage 僅用於儲存深色模式、側邊欄狀態、每頁筆數等本機 UI 偏好，不會傳送至伺服器。' },
    ],
  },
  {
    icon: 'fa-plug',
    title: '第三方服務整合',
    blocks: [
      { type: 'ul', items: ['Google Identity Services、LINE Login、Passkey 相關服務用於登入或帳號綁定。', 'TWSE、exchangerate-api.com、IPinfo 用於市場資料、匯率與登入位置查詢。', 'SMTP / Zeabur Email / Resend 用於寄送通知郵件。', 'MEGA S4 用於管理員備份。', 'Google Play Integrity API 用於 Android App 完整性驗證。', 'Sentry 用於行動版當機與診斷監控。', 'Google Fonts、Font Awesome CDN、Chart.js CDN 用於前端資源。'] },
    ],
  },
  {
    icon: 'fa-user-shield',
    title: '您的權利',
    blocks: [
      { type: 'ul', items: ['查閱權：可在帳號設定中查閱帳號資料與登入紀錄。', '資料可攜權：可匯出財務資料。', '更正權：可直接編輯交易記錄或帳號資訊。', '刪除權：可在帳號設定中刪除帳號；無法登入時可寄信至 assetpilot@shao.one 提出刪除請求。'] },
      { type: 'warning', text: '刪除帳號後，所有交易、帳戶、分類與股票紀錄等資料將永久刪除且無法復原。建議刪除前先匯出資料。' },
    ],
  },
  {
    icon: 'fa-clock-rotate-left',
    title: '資料保留期限',
    blocks: [
      { type: 'p', text: '您的資料將保留至您主動刪除帳號、管理員依維運需要刪除帳號，或服務終止運作為止。登入稽核紀錄預設保留最近 100 筆。' },
    ],
  },
  {
    icon: 'fa-file-pen',
    title: '政策更新',
    blocks: [
      { type: 'p', text: '我們可能因應法規調整或功能更新而修訂本隱私權政策。重大變更時，將透過版本更新資訊通知使用者。' },
      { type: 'p', text: '繼續使用本服務即視為接受最新版本的隱私權政策。' },
    ],
  },
  {
    icon: 'fa-envelope',
    title: '聯絡我們',
    blocks: [
      { type: 'p', text: '若您對本隱私權政策有任何疑問，或需要行使資料權利，請透過 assetpilot@shao.one、帳號設定頁面中的意見回饋功能，或您的系統管理員聯絡我們。' },
    ],
  },
];

const enPrivacySections: LegalDocumentContent['sections'] = [
  {
    icon: 'fa-globe',
    title: 'Scope',
    blocks: [
      { type: 'p', text: 'This Privacy Policy is issued by AssetPilot and applies to all users of the AssetPilot application and web service. By accessing or using the service, you agree to the data practices described here.' },
      { type: 'p', text: 'The official service is operated by AssetPilot. If you use a self-hosted deployment, data is controlled by your own server environment and AssetPilot does not access data inside your self-hosted instance.' },
      { type: 'p', text: 'The service is not designed for children under 13, and we do not knowingly collect personal data from children.' },
    ],
  },
  {
    icon: 'fa-database',
    title: 'Data We Collect',
    blocks: [
      { type: 'h3', text: 'Account data' },
      { type: 'ul', items: ['Email, display name, and bcrypt-hashed password.', 'Google account data when using Google SSO.', 'LINE user identifier when using LINE sign-in or linking.', 'Passkey public-key data when Passkey is enabled.'] },
      { type: 'h3', text: 'Financial data' },
      { type: 'ul', items: ['Transactions, accounts, budgets, and recurring transaction settings.', 'Stock transactions, dividend records, categories, and tags.'] },
      { type: 'h3', text: 'Transaction attachments (optional)' },
      { type: 'p', text: 'You may optionally attach receipt photos or files to transactions. If you do not use this feature, the service does not access your photos or files.' },
      { type: 'h3', text: 'System logs' },
      { type: 'ul', items: ['Sign-in records such as time, source IP, and device type for security audit.', 'API error logs that do not include personal financial content.', 'Mobile crash and diagnostic data used only for troubleshooting, with sensitive screen content masked.'] },
      { type: 'note', text: 'The service does not collect advertising identifiers, behavioral tracking data, or personal data unrelated to financial management.' },
    ],
  },
  {
    icon: 'fa-bullseye',
    title: 'How We Use Data',
    blocks: [
      { type: 'ul', items: ['Provide the service, display financial data, and calculate reports.', 'Authenticate accounts and protect account security.', 'Run automation such as recurring transactions, stock sync, and exchange-rate updates.', 'Detect unusual sign-in activity.', 'Generate CSV exports at your request.'] },
      { type: 'p', text: 'We do not use your data for advertising, marketing analytics, or unrelated commercial purposes.' },
    ],
  },
  {
    icon: 'fa-lock',
    title: 'Storage and Security',
    blocks: [
      { type: 'h3', text: 'Encryption at rest' },
      { type: 'p', text: 'The database uses ChaCha20-Poly1305 symmetric encryption for encryption at rest.' },
      { type: 'h3', text: 'Password security' },
      { type: 'p', text: 'Passwords are stored only after bcrypt hashing. Plaintext passwords are not stored.' },
      { type: 'h3', text: 'Transport security' },
      { type: 'p', text: 'The official service uses HTTPS. JWT authentication tokens are stored in HttpOnly cookies.' },
      { type: 'h3', text: 'Security controls' },
      { type: 'ul', items: ['HTTP security headers, sign-in rate limits, and CORS origin controls.', 'SRI validation for external CDN resources.', 'XSS protection for input data.'] },
    ],
  },
  {
    icon: 'fa-share-nodes',
    title: 'Data Sharing',
    blocks: [
      { type: 'p', text: 'The service does not sell, rent, or share your personal or financial data with third parties unless you consent, the law requires it, or it is necessary for a feature you enable.' },
      { type: 'ul', items: ['Stock symbol queries may be sent to TWSE.', 'Exchange-rate sync queries exchangerate-api.com.', 'Sign-in audits may send IP addresses to IPinfo for country lookup.', 'Notification emails may be sent through SMTP, Zeabur Email, or Resend.', 'Administrator backups may be uploaded to MEGA S4 object storage.', 'Mobile diagnostics may be sent to Sentry.'] },
    ],
  },
  {
    icon: 'fa-cookie-bite',
    title: 'Cookies and Local Storage',
    blocks: [
      { type: 'p', text: 'The service uses an auth_token cookie (HttpOnly, Secure) for JWT authentication and a locale cookie for language preference.' },
      { type: 'p', text: 'LocalStorage is used only for local UI preferences such as dark mode, sidebar state, and page size. These preferences are not sent to the server.' },
    ],
  },
  {
    icon: 'fa-plug',
    title: 'Third-Party Services',
    blocks: [
      { type: 'ul', items: ['Google Identity Services, LINE Login, and Passkey-related services for sign-in and account linking.', 'TWSE, exchangerate-api.com, and IPinfo for market data, exchange rates, and sign-in location lookup.', 'SMTP, Zeabur Email, and Resend for notification email delivery.', 'MEGA S4 for administrator backups.', 'Google Play Integrity API for Android app integrity checks.', 'Sentry for mobile crash and diagnostic monitoring.', 'Google Fonts, Font Awesome CDN, and Chart.js CDN for frontend resources.'] },
    ],
  },
  {
    icon: 'fa-user-shield',
    title: 'Your Rights',
    blocks: [
      { type: 'ul', items: ['Access: view account data and sign-in records in account settings.', 'Portability: export financial data.', 'Correction: edit transactions or account information directly.', 'Deletion: delete your account in account settings; if you cannot sign in, contact assetpilot@shao.one to request deletion.'] },
      { type: 'warning', text: 'After account deletion, transactions, accounts, categories, stock records, and related data are permanently deleted and cannot be recovered. Export your data first.' },
    ],
  },
  {
    icon: 'fa-clock-rotate-left',
    title: 'Retention',
    blocks: [
      { type: 'p', text: 'Your data is retained until you delete your account, the administrator deletes it for operational reasons, or the service ends. Sign-in audit records keep the most recent 100 records by default.' },
    ],
  },
  {
    icon: 'fa-file-pen',
    title: 'Policy Updates',
    blocks: [
      { type: 'p', text: 'We may update this Privacy Policy for legal or product changes. Material changes will be announced through changelog information.' },
      { type: 'p', text: 'Continuing to use the service means you accept the latest version of this Privacy Policy.' },
    ],
  },
  {
    icon: 'fa-envelope',
    title: 'Contact Us',
    blocks: [
      { type: 'p', text: 'For questions about this policy or to exercise data rights, contact assetpilot@shao.one, use the feedback option in account settings, or contact your system administrator.' },
    ],
  },
];

export function getLegalContent(kind: LegalKind, locale: Locale, t: TranslateFn): LegalDocumentContent {
  const useEnglishLegalText = locale !== 'zh-TW' && locale !== 'zh-CN';
  if (kind === 'terms') {
    return {
      title: t('public.common.terms'),
      subtitle: useEnglishLegalText
        ? 'Please read these terms carefully before using the service. Continuing to use the service means you agree to them.'
        : '使用本服務前，請詳細閱讀以下條款。繼續使用即表示您同意本條款之內容。',
      icon: 'fa-file-contract',
      heroClass: 'bg-gradient-to-br from-slate-800 to-slate-700',
      tocTitle: useEnglishLegalText ? 'Contents' : '目錄',
      updatedLabel: t('public.common.lastUpdated', { date: t('public.common.dates.terms') }),
      sections: useEnglishLegalText ? enTermsSections : zhTermsSections,
      links: links(t).filter((link) => link.href !== '/terms'),
    };
  }

  return {
    title: t('public.common.privacy'),
    subtitle: useEnglishLegalText
      ? 'This policy explains how we collect, use, and protect your personal data.'
      : '本政策說明我們如何收集、使用及保護您的個人資料，請詳細閱讀。',
    icon: 'fa-shield-halved',
    heroClass: 'bg-gradient-to-br from-indigo-600 to-indigo-400',
    tocTitle: useEnglishLegalText ? 'Contents' : '目錄',
    updatedLabel: t('public.common.lastUpdated', { date: t('public.common.dates.privacy') }),
    sections: useEnglishLegalText ? enPrivacySections : zhPrivacySections,
    links: links(t).filter((link) => link.href !== '/privacy'),
  };
}

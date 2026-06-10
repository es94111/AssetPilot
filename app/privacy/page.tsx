export const dynamic = 'force-static';

export const metadata = {
  title: '隱私權政策 — AssetPilot',
};

export default function PrivacyPage() {
  return (
    <div className="public-info-page min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-14 w-full max-w-[900px] items-center justify-between px-6">
          <a href="/" className="inline-flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-slate-100">
            <img src="/logo.svg" alt="AssetPilot" className="h-7 w-7" />
            AssetPilot
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500 px-3.5 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:text-indigo-400">
            <i className="fas fa-arrow-left" /> 返回首頁
          </a>
        </div>
      </nav>

      <div className="bg-gradient-to-br from-indigo-600 to-indigo-400 px-6 py-14 text-center text-white">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl"><i className="fas fa-shield-halved" /></div>
        <h1 className="mb-2.5 text-3xl font-extrabold md:text-4xl">隱私權政策</h1>
        <p className="mx-auto max-w-[520px] text-sm/7 text-white/85">本政策說明我們如何收集、使用及保護您的個人資料，請詳細閱讀。</p>
      </div>

      <main className="mx-auto w-full max-w-[900px] px-6 py-10 pb-20">
        <div className="mb-10 rounded-2xl border border-slate-200 bg-white px-7 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-400"><i className="fas fa-list-ul" /> &nbsp;目錄</h2>
          <ol className="grid list-decimal gap-x-6 gap-y-1 pl-5 text-sm text-slate-600 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] dark:text-slate-300">
            <li><a href="#s1" className="text-indigo-600 hover:underline dark:text-indigo-400">適用範圍</a></li>
            <li><a href="#s2" className="text-indigo-600 hover:underline dark:text-indigo-400">收集的資料</a></li>
            <li><a href="#s3" className="text-indigo-600 hover:underline dark:text-indigo-400">資料使用目的</a></li>
            <li><a href="#s4" className="text-indigo-600 hover:underline dark:text-indigo-400">資料儲存與安全</a></li>
            <li><a href="#s5" className="text-indigo-600 hover:underline dark:text-indigo-400">資料分享</a></li>
            <li><a href="#s6" className="text-indigo-600 hover:underline dark:text-indigo-400">Cookie 與本地儲存</a></li>
            <li><a href="#s7" className="text-indigo-600 hover:underline dark:text-indigo-400">第三方服務</a></li>
            <li><a href="#s8" className="text-indigo-600 hover:underline dark:text-indigo-400">您的權利</a></li>
            <li><a href="#s9" className="text-indigo-600 hover:underline dark:text-indigo-400">資料保留</a></li>
            <li><a href="#s10" className="text-indigo-600 hover:underline dark:text-indigo-400">政策更新</a></li>
            <li><a href="#s11" className="text-indigo-600 hover:underline dark:text-indigo-400">聯絡我們</a></li>
          </ol>
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s1">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-globe" /></span>1. 適用範圍</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本隱私權政策由 <strong>AssetPilot</strong>（以下簡稱「我們」）發布，適用於「AssetPilot」應用程式與網頁服務（以下簡稱「本服務」）的所有使用者。當您存取或使用本服務時，即表示您同意本政策所描述的資料處理方式。</p>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務的官方版本由 AssetPilot 營運並負責所收集資料的處理；官方服務的預設後端為 <strong>asset.shao.one</strong>。本服務同時提供開放原始碼的自行架設（自架）選項，屬進階選配——若您改用自架部署，該部署所收集的資料將由您自身的伺服器環境負責，AssetPilot 不會接觸您自架實例中的資料。</p>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務並非針對 13 歲以下兒童設計，我們不會在知情的情況下收集兒童的個人資料。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s2">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-database" /></span>2. 收集的資料</div>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">帳號資料</h3>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>電子信箱（Email）：用於帳號識別與登入</li>
            <li>使用者名稱（暱稱）</li>
            <li>加密後的密碼（使用 bcrypt 雜湊，原始密碼不存於資料庫）</li>
            <li>Google 帳號資料（僅使用 Google SSO 登入時）：透過 Google 登入取得您的電子信箱、顯示名稱與 Google 帳號 ID，僅用於建立與識別帳號</li>
            <li>LINE 使用者識別碼（僅使用 LINE 登入或綁定時）</li>
            <li>Passkey 公開金鑰資料（僅啟用 Passkey 登入時）</li>
          </ul>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">財務資料</h3>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>交易記錄（日期、金額、分類、帳戶、備註）</li>
            <li>帳戶資訊（名稱、餘額、幣別）</li>
            <li>預算設定</li>
            <li>固定收支設定</li>
            <li>股票買賣紀錄與股利紀錄</li>
            <li>分類與標籤資料</li>
          </ul>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">系統日誌</h3>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>登入紀錄（時間、來源 IP、裝置類型）：用於安全稽核，可於帳號設定中查閱</li>
            <li>API 請求錯誤日誌（不含個人財務內容）</li>
          </ul>
          <div className="my-4 flex gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm/7 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-info-circle mt-0.5 shrink-0" /><span>本服務不收集廣告識別碼、行為追蹤資料或任何與財務管理無關的個人資料。</span></div>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s3">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-bullseye" /></span>3. 資料使用目的</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">我們收集的資料僅用於以下目的：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li><strong>提供服務</strong>：顯示您的財務資料、計算報表與統計分析</li>
            <li><strong>帳號驗證</strong>：確認您的身份以保護帳號安全</li>
            <li><strong>功能運作</strong>：固定收支自動化、股價同步、匯率更新等自動化功能</li>
            <li><strong>安全防護</strong>：偵測異常登入行為，保護您的帳號不被未授權存取</li>
            <li><strong>資料匯出</strong>：依您的請求產生 CSV 匯出檔案</li>
          </ul>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">我們不會將您的資料用於廣告投放、行銷分析或任何商業目的。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s4">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-lock" /></span>4. 資料儲存與安全</div>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">加密儲存</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">資料庫採用 <strong>ChaCha20-Poly1305</strong> 對稱加密演算法進行落地加密（Encryption at Rest）。即使資料庫檔案遭到未授權存取，資料內容仍受到加密保護。</p>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">密碼安全</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">使用者密碼透過 <strong>bcrypt</strong> 演算法進行雜湊處理後才儲存，系統不保存任何明文密碼，亦無法還原原始密碼。</p>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">傳輸安全</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">官方服務一律透過 <strong>HTTPS</strong> 進行加密傳輸（自架部署亦強烈建議啟用 HTTPS）。JWT 身份驗證令牌儲存於 HttpOnly Cookie，防止 XSS 攻擊竊取認證資訊。</p>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">安全防護措施</h3>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>HTTP 安全標頭（HSTS、X-Content-Type-Options、Referrer-Policy）</li>
            <li>登入介面速率限制（Rate Limiting）防止暴力破解</li>
            <li>CORS 來源控制</li>
            <li>外部 CDN 資源的 SRI（子資源完整性）驗證</li>
            <li>輸入資料的 XSS 防護處理</li>
          </ul>
          <div className="my-4 flex gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm/7 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-info-circle mt-0.5 shrink-0" /><span>官方服務由 AssetPilot 營運並負責資料的安全維護。若您改用自架部署，資料的實際儲存位置取決於您的伺服器環境，該環境的安全性由您自行負責。</span></div>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s5">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-share-nodes" /></span>5. 資料分享</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務<strong>不會</strong>將您的個人資料或財務資料出售、出租或分享給任何第三方，除非符合下列情形：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li><strong>您的明確同意</strong>：在您主動執行資料匯出等操作時</li>
            <li><strong>法律要求</strong>：依法律規定或主管機關的合法命令</li>
            <li><strong>第三方 API 查詢</strong>：查詢股價時會向 TWSE 發送股票代號查詢請求（不含個人資訊）；匯率同步時向 exchangerate-api.com 查詢匯率（不含個人資訊）</li>
          </ul>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s6">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-cookie-bite" /></span>6. Cookie 與本地儲存</div>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">Cookie</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務僅使用一個 Cookie：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li><strong>auth_token</strong>（HttpOnly, Secure）：儲存 JWT 身份驗證令牌，有效期限與您設定的登入期限相同（預設 7 天），在目前裝置登出後立即清除。</li>
          </ul>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">LocalStorage</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務使用瀏覽器 LocalStorage 儲存以下偏好設定（僅限本機）：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>深色模式偏好（dark-mode）</li>
            <li>側邊欄收合狀態</li>
            <li>每頁顯示筆數等 UI 偏好</li>
          </ul>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">以上本地設定資料不會傳送至伺服器，清除瀏覽器資料時會一併刪除。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s7">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-plug" /></span>7. 第三方服務整合</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務整合以下第三方服務，各服務均有其獨立的隱私權政策：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li><strong>Google Identity Services（選配）</strong>：提供 Google SSO 登入功能。</li>
            <li><strong>LINE Login（選配）</strong>：提供 LINE 登入與帳號綁定功能。</li>
            <li><strong>TWSE 臺灣證券交易所 OpenAPI</strong>：查詢股票即時/收盤價及除權息資料時使用。僅傳送股票代號，不含任何個人資訊。</li>
            <li><strong>exchangerate-api.com</strong>：匯率自動同步功能使用。</li>
            <li><strong>Google Fonts</strong>：載入字型資源。</li>
            <li><strong>Font Awesome CDN</strong>：載入圖示資源，使用 SRI 驗證確保檔案完整性。</li>
            <li><strong>Chart.js CDN</strong>：載入圖表函式庫，使用 SRI 驗證確保檔案完整性。</li>
          </ul>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s8">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-user-shield" /></span>8. 您的權利</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">您對自己的個人資料擁有以下權利：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li><strong>查閱權</strong>：您可以在「設定 &gt; 帳號設定」中查閱您的帳號資料與登入紀錄</li>
            <li><strong>資料可攜權</strong>：您可以在「設定 &gt; 資料匯出匯入」將所有財務資料匯出為 CSV 格式</li>
            <li><strong>更正權</strong>：您可以直接編輯任何交易記錄或帳號資訊</li>
            <li><strong>刪除權</strong>：您可以在「設定 &gt; 帳號設定」申請刪除帳號，這將永久刪除您的所有資料，此操作不可復原。若您無法登入而需要刪除帳號與相關資料，可寄信至 <a href="mailto:assetpilot@shao.one" className="text-indigo-600 hover:underline dark:text-indigo-400">assetpilot@shao.one</a> 提出刪除請求，我們將於核實身份後處理</li>
          </ul>
          <div className="my-4 flex gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm/7 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-triangle-exclamation mt-0.5 shrink-0" /><span>刪除帳號後，所有交易記錄、帳戶、分類、股票紀錄等資料將被永久刪除，且無法復原。建議刪除前先執行資料匯出。</span></div>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s9">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-clock-rotate-left" /></span>9. 資料保留期限</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">您的資料將保留至以下情況發生為止：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>您主動刪除帳號</li>
            <li>管理員依維運需要刪除帳號</li>
            <li>服務終止運作</li>
          </ul>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">登入稽核紀錄預設保留最近 <strong>100 筆</strong>，超過後自動捨棄最舊的記錄。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s10">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-file-pen" /></span>10. 政策更新</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">我們可能因應法規調整或功能更新而修訂本隱私權政策。重大變更時，將透過版本更新資訊（Changelog）通知使用者。</p>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">繼續使用本服務即視為接受最新版本的隱私權政策。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s11">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-envelope" /></span>11. 聯絡我們</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">若您對本隱私權政策有任何疑問，或需要行使上述資料權利（包含查閱、更正、刪除等），請透過以下方式聯絡我們：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>隱私聯絡信箱：<a href="mailto:assetpilot@shao.one" className="text-indigo-600 hover:underline dark:text-indigo-400">assetpilot@shao.one</a></li>
            <li>或透過「設定 &gt; 帳號設定」頁面中的意見回饋功能</li>
            <li>若您使用自架部署，亦可聯絡您的系統管理員</li>
          </ul>
        </section>

        <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-400 dark:border-slate-800">
          <p>最後更新日期：2026 年 6 月 10 日</p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-5">
            <a href="/terms" className="text-indigo-600 dark:text-indigo-400"><i className="fas fa-file-contract" /> 服務條款</a>
            <a href="/api-credits" className="text-indigo-600 dark:text-indigo-400"><i className="fas fa-plug" /> API 使用與授權</a>
            <a href="/" className="text-indigo-600 dark:text-indigo-400"><i className="fas fa-house" /> 返回首頁</a>
          </div>
        </div>
      </main>
    </div>
  );
}

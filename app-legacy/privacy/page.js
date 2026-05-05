export const dynamic = 'force-static';

export const metadata = {
  title: '隱私權政策 — AssetPilot',
};

const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--primary:#4f6ef7;--bg:#f4f6fa;--surface:#ffffff;--text:#1a1d26;--text-secondary:#5c6370;--text-muted:#94a3b8;--border:#e4e7ec;--radius:14px;--shadow:0 1px 2px rgba(0,0,0,.04),0 2px 8px rgba(0,0,0,.04)}
@media(prefers-color-scheme:dark){:root{--bg:#0c0f16;--surface:#151922;--text:#e8eaef;--text-secondary:#9ca3b4;--text-muted:#6b7280;--border:#252a36}}
html{scroll-behavior:smooth}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--text);line-height:1.7;min-height:100vh}
.pp-nav{position:sticky;top:0;z-index:100;background:var(--surface);border-bottom:1px solid var(--border);box-shadow:var(--shadow)}
.pp-nav-inner{max-width:900px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between}
.pp-brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px;color:var(--text);text-decoration:none}
.pp-brand img{width:28px;height:28px}
.pp-back{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--primary);text-decoration:none;padding:6px 14px;border:1px solid var(--primary);border-radius:8px;transition:background 150ms,color 150ms}
.pp-back:hover{background:var(--primary);color:#fff}
.pp-hero{background:linear-gradient(135deg,#4f6ef7 0%,#7b93fa 100%);color:#fff;padding:56px 24px 48px;text-align:center}
.pp-hero-icon{width:56px;height:56px;background:rgba(255,255,255,.15);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:16px}
.pp-hero h1{font-size:clamp(24px,4vw,36px);font-weight:800;margin-bottom:10px}
.pp-hero p{font-size:15px;opacity:.85;max-width:520px;margin:0 auto}
.pp-main{max-width:900px;margin:0 auto;padding:40px 24px 80px}
.pp-toc{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px 28px;margin-bottom:40px;box-shadow:var(--shadow)}
.pp-toc h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:14px}
.pp-toc ol{padding-left:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px 24px}
.pp-toc li{font-size:14px}
.pp-toc a{color:var(--primary);text-decoration:none}
.pp-toc a:hover{text-decoration:underline}
.pp-section{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:32px 36px;margin-bottom:20px;box-shadow:var(--shadow)}
@media(max-width:600px){.pp-section{padding:24px 20px}}
.pp-section-title{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:700;color:var(--text);margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border)}
.pp-section-title .icon{width:36px;height:36px;border-radius:10px;background:#eef2ff;color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
@media(prefers-color-scheme:dark){.pp-section-title .icon{background:#1e2540}}
.pp-section h3{font-size:15px;font-weight:600;color:var(--text);margin:18px 0 8px}
.pp-section p{font-size:14px;color:var(--text-secondary);margin-bottom:12px}
.pp-section p:last-child{margin-bottom:0}
.pp-section ul,.pp-section ol{padding-left:20px;margin-bottom:12px}
.pp-section li{font-size:14px;color:var(--text-secondary);margin-bottom:6px;line-height:1.6}
.pp-notice{display:flex;gap:12px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px 16px;margin:16px 0;font-size:14px;color:#3730a3;line-height:1.6}
.pp-notice i{flex-shrink:0;margin-top:2px}
@media(prefers-color-scheme:dark){.pp-notice{background:#1a1f3c;border-color:#2d3875;color:#818cf8}}
.pp-meta{text-align:center;font-size:13px;color:var(--text-muted);margin-top:32px;padding-top:24px;border-top:1px solid var(--border)}
.pp-meta a{color:var(--primary);text-decoration:none}
`;

export default function PrivacyPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <nav className="pp-nav">
        <div className="pp-nav-inner">
          <a href="/" className="pp-brand">
            <img src="/logo.svg" alt="AssetPilot" />
            AssetPilot
          </a>
          <a href="/" className="pp-back">
            <i className="fas fa-arrow-left" /> 返回首頁
          </a>
        </div>
      </nav>

      <div className="pp-hero">
        <div className="pp-hero-icon"><i className="fas fa-shield-halved" /></div>
        <h1>隱私權政策</h1>
        <p>本政策說明我們如何收集、使用及保護您的個人資料，請詳細閱讀。</p>
      </div>

      <main className="pp-main">
        <div className="pp-toc">
          <h2><i className="fas fa-list-ul" /> &nbsp;目錄</h2>
          <ol>
            <li><a href="#s1">適用範圍</a></li>
            <li><a href="#s2">收集的資料</a></li>
            <li><a href="#s3">資料使用目的</a></li>
            <li><a href="#s4">資料儲存與安全</a></li>
            <li><a href="#s5">資料分享</a></li>
            <li><a href="#s6">Cookie 與本地儲存</a></li>
            <li><a href="#s7">第三方服務</a></li>
            <li><a href="#s8">您的權利</a></li>
            <li><a href="#s9">資料保留</a></li>
            <li><a href="#s10">政策更新</a></li>
            <li><a href="#s11">聯絡我們</a></li>
          </ol>
        </div>

        <section className="pp-section" id="s1">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-globe" /></span>1. 適用範圍</div>
          <p>本隱私權政策適用於「AssetPilot」網頁應用程式（以下簡稱「本服務」）的所有使用者。當您存取或使用本服務時，即表示您同意本政策所描述的資料處理方式。</p>
          <p>本服務為個人私有部署應用程式，預設僅供帳號持有人使用。若您是自行架設本服務的管理員，請確保您的使用者了解本政策內容。</p>
        </section>

        <section className="pp-section" id="s2">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-database" /></span>2. 收集的資料</div>
          <h3>帳號資料</h3>
          <ul>
            <li>電子信箱（Email）：用於帳號識別與登入</li>
            <li>使用者名稱（暱稱）</li>
            <li>加密後的密碼（使用 bcrypt 雜湊，原始密碼不存於資料庫）</li>
            <li>Google 帳號 ID（僅使用 Google SSO 登入時）</li>
          </ul>
          <h3>財務資料</h3>
          <ul>
            <li>交易記錄（日期、金額、分類、帳戶、備註）</li>
            <li>帳戶資訊（名稱、餘額、幣別）</li>
            <li>預算設定</li>
            <li>固定收支設定</li>
            <li>股票買賣紀錄與股利紀錄</li>
            <li>分類與標籤資料</li>
          </ul>
          <h3>系統日誌</h3>
          <ul>
            <li>登入紀錄（時間、來源 IP、裝置類型）：用於安全稽核，可於帳號設定中查閱</li>
            <li>API 請求錯誤日誌（不含個人財務內容）</li>
          </ul>
          <div className="pp-notice"><i className="fas fa-info-circle" /><span>本服務不收集廣告識別碼、行為追蹤資料或任何與財務管理無關的個人資料。</span></div>
        </section>

        <section className="pp-section" id="s3">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-bullseye" /></span>3. 資料使用目的</div>
          <p>我們收集的資料僅用於以下目的：</p>
          <ul>
            <li><strong>提供服務</strong>：顯示您的財務資料、計算報表與統計分析</li>
            <li><strong>帳號驗證</strong>：確認您的身份以保護帳號安全</li>
            <li><strong>功能運作</strong>：固定收支自動化、股價同步、匯率更新等自動化功能</li>
            <li><strong>安全防護</strong>：偵測異常登入行為，保護您的帳號不被未授權存取</li>
            <li><strong>資料匯出</strong>：依您的請求產生 CSV 匯出檔案</li>
          </ul>
          <p>我們不會將您的資料用於廣告投放、行銷分析或任何商業目的。</p>
        </section>

        <section className="pp-section" id="s4">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-lock" /></span>4. 資料儲存與安全</div>
          <h3>加密儲存</h3>
          <p>資料庫採用 <strong>ChaCha20-Poly1305</strong> 對稱加密演算法進行落地加密（Encryption at Rest）。即使資料庫檔案遭到未授權存取，資料內容仍受到加密保護。</p>
          <h3>密碼安全</h3>
          <p>使用者密碼透過 <strong>bcrypt</strong> 演算法進行雜湊處理後才儲存，系統不保存任何明文密碼，亦無法還原原始密碼。</p>
          <h3>傳輸安全</h3>
          <p>建議透過 HTTPS 存取本服務。JWT 身份驗證令牌儲存於 HttpOnly Cookie，防止 XSS 攻擊竊取認證資訊。</p>
          <h3>安全防護措施</h3>
          <ul>
            <li>HTTP 安全標頭（HSTS、X-Content-Type-Options、Referrer-Policy）</li>
            <li>登入介面速率限制（Rate Limiting）防止暴力破解</li>
            <li>CORS 來源控制</li>
            <li>外部 CDN 資源的 SRI（子資源完整性）驗證</li>
            <li>輸入資料的 XSS 防護處理</li>
          </ul>
          <div className="pp-notice"><i className="fas fa-info-circle" /><span>本服務為自行部署架構，資料實際儲存位置取決於您的伺服器環境。管理員有責任確保伺服器本身的安全性。</span></div>
        </section>

        <section className="pp-section" id="s5">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-share-nodes" /></span>5. 資料分享</div>
          <p>本服務<strong>不會</strong>將您的個人資料或財務資料出售、出租或分享給任何第三方，除非符合下列情形：</p>
          <ul>
            <li><strong>您的明確同意</strong>：在您主動執行資料匯出等操作時</li>
            <li><strong>法律要求</strong>：依法律規定或主管機關的合法命令</li>
            <li><strong>第三方 API 查詢</strong>：查詢股價時會向 TWSE 發送股票代號查詢請求（不含個人資訊）；匯率同步時向 exchangerate-api.com 查詢匯率（不含個人資訊）</li>
          </ul>
        </section>

        <section className="pp-section" id="s6">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-cookie-bite" /></span>6. Cookie 與本地儲存</div>
          <h3>Cookie</h3>
          <p>本服務僅使用一個 Cookie：</p>
          <ul>
            <li><strong>auth_token</strong>（HttpOnly, Secure）：儲存 JWT 身份驗證令牌，有效期限與您設定的登入期限相同（預設 7 天），登出後立即失效。</li>
          </ul>
          <h3>LocalStorage</h3>
          <p>本服務使用瀏覽器 LocalStorage 儲存以下偏好設定（僅限本機）：</p>
          <ul>
            <li>深色模式偏好（dark-mode）</li>
            <li>側邊欄收合狀態</li>
            <li>每頁顯示筆數等 UI 偏好</li>
          </ul>
          <p>以上本地設定資料不會傳送至伺服器，清除瀏覽器資料時會一併刪除。</p>
        </section>

        <section className="pp-section" id="s7">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-plug" /></span>7. 第三方服務整合</div>
          <p>本服務整合以下第三方服務，各服務均有其獨立的隱私權政策：</p>
          <ul>
            <li><strong>Google Identity Services（選配）</strong>：提供 Google SSO 登入功能。</li>
            <li><strong>TWSE 臺灣證券交易所 OpenAPI</strong>：查詢股票即時/收盤價及除權息資料時使用。僅傳送股票代號，不含任何個人資訊。</li>
            <li><strong>exchangerate-api.com</strong>：匯率自動同步功能使用。</li>
            <li><strong>Google Fonts</strong>：載入字型資源。</li>
            <li><strong>Font Awesome CDN</strong>：載入圖示資源，使用 SRI 驗證確保檔案完整性。</li>
            <li><strong>Chart.js CDN</strong>：載入圖表函式庫，使用 SRI 驗證確保檔案完整性。</li>
          </ul>
        </section>

        <section className="pp-section" id="s8">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-user-shield" /></span>8. 您的權利</div>
          <p>您對自己的個人資料擁有以下權利：</p>
          <ul>
            <li><strong>查閱權</strong>：您可以在「設定 &gt; 帳號設定」中查閱您的帳號資料與登入紀錄</li>
            <li><strong>資料可攜權</strong>：您可以在「設定 &gt; 資料匯出匯入」將所有財務資料匯出為 CSV 格式</li>
            <li><strong>更正權</strong>：您可以直接編輯任何交易記錄或帳號資訊</li>
            <li><strong>刪除權</strong>：您可以在「設定 &gt; 帳號設定」申請刪除帳號，這將永久刪除您的所有資料，此操作不可復原</li>
          </ul>
          <div className="pp-notice"><i className="fas fa-triangle-exclamation" /><span>刪除帳號後，所有交易記錄、帳戶、分類、股票紀錄等資料將被永久刪除，且無法復原。建議刪除前先執行資料匯出。</span></div>
        </section>

        <section className="pp-section" id="s9">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-clock-rotate-left" /></span>9. 資料保留期限</div>
          <p>您的資料將保留至以下情況發生為止：</p>
          <ul>
            <li>您主動刪除帳號</li>
            <li>管理員依維運需要刪除帳號</li>
            <li>服務終止運作</li>
          </ul>
          <p>登入稽核紀錄預設保留最近 <strong>100 筆</strong>，超過後自動捨棄最舊的記錄。</p>
        </section>

        <section className="pp-section" id="s10">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-file-pen" /></span>10. 政策更新</div>
          <p>我們可能因應法規調整或功能更新而修訂本隱私權政策。重大變更時，將透過版本更新資訊（Changelog）通知使用者。</p>
          <p>繼續使用本服務即視為接受最新版本的隱私權政策。</p>
        </section>

        <section className="pp-section" id="s11">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-envelope" /></span>11. 聯絡我們</div>
          <p>若您對本隱私權政策有任何疑問，或需要行使上述資料權利，請透過以下方式聯絡服務管理員：</p>
          <ul>
            <li>透過「設定 &gt; 帳號設定」頁面中的意見回饋功能</li>
            <li>或聯絡您的系統管理員</li>
          </ul>
        </section>

        <div className="pp-meta">
          <p>最後更新日期：2026 年 4 月 10 日</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
            <a href="/terms"><i className="fas fa-file-contract" /> 服務條款</a>
            <a href="/"><i className="fas fa-house" /> 返回首頁</a>
          </div>
        </div>
      </main>
    </>
  );
}

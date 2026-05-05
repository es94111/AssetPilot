export const dynamic = 'force-static';

export const metadata = {
  title: '服務條款 — AssetPilot',
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
.pp-hero{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff;padding:56px 24px 48px;text-align:center}
.pp-hero-icon{width:56px;height:56px;background:rgba(255,255,255,.12);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:16px}
.pp-hero h1{font-size:clamp(24px,4vw,36px);font-weight:800;margin-bottom:10px}
.pp-hero p{font-size:15px;opacity:.8;max-width:520px;margin:0 auto}
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
.pp-section-title .icon{width:36px;height:36px;border-radius:10px;background:#f1f5f9;color:#475569;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
@media(prefers-color-scheme:dark){.pp-section-title .icon{background:#1e2530;color:#94a3b8}}
.pp-section h3{font-size:15px;font-weight:600;color:var(--text);margin:18px 0 8px}
.pp-section p{font-size:14px;color:var(--text-secondary);margin-bottom:12px}
.pp-section p:last-child{margin-bottom:0}
.pp-section ul,.pp-section ol{padding-left:20px;margin-bottom:12px}
.pp-section li{font-size:14px;color:var(--text-secondary);margin-bottom:6px;line-height:1.6}
.pp-notice{display:flex;gap:12px;border-radius:10px;padding:14px 16px;margin:16px 0;font-size:14px;line-height:1.6}
.pp-notice i{flex-shrink:0;margin-top:2px}
.pp-notice.info{background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3}
.pp-notice.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e}
@media(prefers-color-scheme:dark){.pp-notice.info{background:#1a1f3c;border-color:#2d3875;color:#818cf8}.pp-notice.warn{background:#2a1f0a;border-color:#78350f;color:#fbbf24}}
.pp-meta{text-align:center;font-size:13px;color:var(--text-muted);margin-top:32px;padding-top:24px;border-top:1px solid var(--border)}
.pp-meta a{color:var(--primary);text-decoration:none}
.pp-meta-links{display:flex;justify-content:center;gap:20px;margin-top:10px;flex-wrap:wrap}
`;

export default function TermsPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <nav className="pp-nav">
        <div className="pp-nav-inner">
          <a href="/" className="pp-brand"><img src="/logo.svg" alt="AssetPilot" />AssetPilot</a>
          <a href="/" className="pp-back"><i className="fas fa-arrow-left" /> 返回首頁</a>
        </div>
      </nav>

      <div className="pp-hero">
        <div className="pp-hero-icon"><i className="fas fa-file-contract" /></div>
        <h1>服務條款</h1>
        <p>使用本服務前，請詳細閱讀以下條款。繼續使用即表示您同意本條款之內容。</p>
      </div>

      <main className="pp-main">
        <div className="pp-toc">
          <h2><i className="fas fa-list-ul" /> &nbsp;目錄</h2>
          <ol>
            <li><a href="#s1">服務說明</a></li>
            <li><a href="#s2">帳號與存取</a></li>
            <li><a href="#s3">使用者責任</a></li>
            <li><a href="#s4">禁止行為</a></li>
            <li><a href="#s5">資料所有權</a></li>
            <li><a href="#s6">服務可用性</a></li>
            <li><a href="#s7">免責聲明</a></li>
            <li><a href="#s8">責任限制</a></li>
            <li><a href="#s9">條款修改</a></li>
            <li><a href="#s10">終止服務</a></li>
            <li><a href="#s11">聯絡方式</a></li>
          </ol>
        </div>

        <section className="pp-section" id="s1">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-circle-info" /></span>1. 服務說明</div>
          <p>「AssetPilot」（以下簡稱「本服務」）是一款個人財務管理網頁應用程式，提供記帳、預算管理、股票紀錄、報表分析等功能。</p>
          <p>本服務採用自行部署（Self-hosted）架構，由管理員架設於自有伺服器上，供授權使用者存取使用。</p>
          <div className="pp-notice info"><i className="fas fa-info-circle" /><span>本服務僅供個人財務記錄與管理用途，不提供任何投資建議、財務諮詢或金融服務。</span></div>
        </section>

        <section className="pp-section" id="s2">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-user-lock" /></span>2. 帳號與存取</div>
          <h3>帳號建立</h3>
          <p>使用本服務須建立帳號。您可透過電子郵件與密碼，或 Google SSO（若管理員已啟用）完成註冊。</p>
          <h3>帳號安全</h3>
          <ul>
            <li>您有責任妥善保管您的帳號密碼，不得與他人共用</li>
            <li>請使用足夠強度的密碼，避免與其他服務共用相同密碼</li>
            <li>若發現帳號遭未授權使用，請立即變更密碼並通知管理員</li>
            <li>您對以您帳號名義發生的所有操作負完全責任</li>
          </ul>
          <h3>帳號資格</h3>
          <p>本服務由管理員決定是否開放公開註冊。管理員有權在任何時候停用或刪除任何帳號。</p>
        </section>

        <section className="pp-section" id="s3">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-user-check" /></span>3. 使用者責任</div>
          <p>使用本服務時，您同意：</p>
          <ul>
            <li>輸入真實、準確的財務資料（本服務僅作為個人記帳工具，輸入資料的正確性由您自行負責）</li>
            <li>定期備份重要資料，可透過「設定 &gt; 資料匯出」匯出 CSV 備份</li>
            <li>遵守適用的法律法規，不將本服務用於任何非法目的</li>
            <li>不干擾其他使用者的正常使用</li>
          </ul>
        </section>

        <section className="pp-section" id="s4">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-ban" /></span>4. 禁止行為</div>
          <p>使用本服務時，嚴格禁止以下行為：</p>
          <ul>
            <li>嘗試未授權存取系統、資料庫或其他使用者的資料</li>
            <li>對本服務進行滲透測試、漏洞掃描或任何安全測試（未經管理員明確書面授權前）</li>
            <li>發送超出正常使用範圍的大量自動化請求（DDoS 或爬蟲行為）</li>
            <li>試圖繞過身份驗證、速率限制或其他安全機制</li>
            <li>上傳含有惡意程式碼、病毒或任何有害內容的資料</li>
            <li>使用本服務從事洗錢、逃稅或任何違法財務活動的記錄</li>
            <li>冒充他人身份建立帳號</li>
          </ul>
          <div className="pp-notice warn"><i className="fas fa-triangle-exclamation" /><span>違反上述禁止行為將導致帳號立即終止，情節嚴重者管理員保留追究法律責任的權利。</span></div>
        </section>

        <section className="pp-section" id="s5">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-database" /></span>5. 資料所有權</div>
          <h3>您的資料</h3>
          <p>您輸入至本服務的所有財務資料均屬於您個人所有。本服務不主張對您的資料擁有任何所有權。</p>
          <h3>資料可攜性</h3>
          <p>您可以隨時透過「設定 &gt; 資料匯出匯入」將您的資料匯出為 CSV 格式，以確保資料的可攜性與備份。</p>
          <h3>資料刪除</h3>
          <p>刪除帳號時，您的所有資料將被永久刪除，且無法復原。請在刪除帳號前務必先完成資料匯出。</p>
          <h3>伺服器儲存</h3>
          <p>您的資料儲存於管理員提供的伺服器上。管理員有義務採取合理措施保護資料安全，但不對因不可抗力、硬體故障或其他意外情況造成的資料遺失負責。</p>
        </section>

        <section className="pp-section" id="s6">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-server" /></span>6. 服務可用性</div>
          <p>本服務以「現狀」（As-Is）提供，不保證服務的持續可用性。以下情況可能導致服務中斷：</p>
          <ul>
            <li>伺服器維護或升級</li>
            <li>網路故障或基礎設施問題</li>
            <li>系統更新或緊急修復</li>
            <li>不可抗力事件（天災、停電等）</li>
          </ul>
          <h3>外部服務依賴</h3>
          <p>本服務部分功能依賴第三方 API（TWSE 股價、匯率 API 等）。這些外部服務的可用性不在本服務控制範圍內，相關功能可能因第三方服務中斷而暫時無法使用。</p>
        </section>

        <section className="pp-section" id="s7">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-circle-exclamation" /></span>7. 免責聲明</div>
          <div className="pp-notice warn"><i className="fas fa-triangle-exclamation" /><span><strong>本服務不提供投資建議。</strong>本服務呈現的股票價格、損益計算、資產報表等資料，僅作為個人記帳與追蹤用途，不構成任何投資建議或財務諮詢意見。</span></div>
          <p>本服務明確聲明不承擔以下責任：</p>
          <ul>
            <li><strong>投資決策</strong>：因使用本服務的資料做出投資決策所造成的任何損失</li>
            <li><strong>資料準確性</strong>：股票價格、匯率等第三方資料的準確性或即時性</li>
            <li><strong>稅務合規</strong>：本服務計算的損益或報表不構成稅務申報依據，請諮詢專業稅務顧問</li>
            <li><strong>資料遺失</strong>：因技術故障、使用者操作或其他原因造成的資料遺失</li>
            <li><strong>間接損失</strong>：因使用或無法使用本服務所造成的任何間接、附帶或衍生損失</li>
          </ul>
        </section>

        <section className="pp-section" id="s8">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-scale-balanced" /></span>8. 責任限制</div>
          <p>在適用法律允許的最大範圍內，本服務管理員對因使用或無法使用本服務所造成的任何直接、間接、附帶、特殊或懲罰性損害不承擔責任，即使已被告知此類損害的可能性。</p>
          <p>管理員的總體責任在任何情況下均不超過您在過去十二（12）個月內為使用本服務所支付的費用（若本服務為免費提供，則責任上限為新臺幣一元）。</p>
        </section>

        <section className="pp-section" id="s9">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-file-pen" /></span>9. 條款修改</div>
          <p>管理員保留隨時修改本服務條款的權利。重大變更將透過版本更新資訊（Changelog）或應用程式內通知告知使用者。</p>
          <p>修改後繼續使用本服務，視為您接受更新後的條款。若您不同意修改後的條款，請停止使用本服務並刪除您的帳號。</p>
        </section>

        <section className="pp-section" id="s10">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-power-off" /></span>10. 終止服務</div>
          <h3>使用者終止</h3>
          <p>您可以隨時於「設定 &gt; 帳號設定」刪除您的帳號以終止使用本服務。建議刪除前先匯出所有資料。</p>
          <h3>管理員終止</h3>
          <p>管理員有權在以下情況終止您的帳號存取：</p>
          <ul>
            <li>違反本服務條款</li>
            <li>長期未使用（管理員自行決定標準）</li>
            <li>伺服器資源限制需要</li>
            <li>服務整體關閉</li>
          </ul>
          <p>在可能的情況下，管理員將提前通知帳號終止，並給予合理的資料匯出時間。</p>
        </section>

        <section className="pp-section" id="s11">
          <div className="pp-section-title"><span className="icon"><i className="fas fa-envelope" /></span>11. 聯絡方式</div>
          <p>若您對本服務條款有任何疑問，請透過以下方式聯絡：</p>
          <ul>
            <li>透過「設定 &gt; 帳號設定」頁面中的意見回饋功能</li>
            <li>或直接聯絡您的系統管理員</li>
          </ul>
        </section>

        <div className="pp-meta">
          <p>最後更新日期：2026 年 4 月 10 日</p>
          <div className="pp-meta-links">
            <a href="/privacy"><i className="fas fa-shield-halved" /> 隱私權政策</a>
            <a href="/"><i className="fas fa-house" /> 返回首頁</a>
          </div>
        </div>
      </main>
    </>
  );
}

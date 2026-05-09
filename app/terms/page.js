export const dynamic = 'force-static';

export const metadata = {
  title: '服務條款 — AssetPilot',
};

export default function TermsPage() {
  return (
    <div className="public-info-page min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-14 w-full max-w-[900px] items-center justify-between px-6">
          <a href="/" className="inline-flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-slate-100"><img src="/logo.svg" alt="AssetPilot" className="h-7 w-7" />AssetPilot</a>
          <a href="/" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500 px-3.5 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:text-indigo-400"><i className="fas fa-arrow-left" /> 返回首頁</a>
        </div>
      </nav>

      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-6 py-14 text-center text-white">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl"><i className="fas fa-file-contract" /></div>
        <h1 className="mb-2.5 text-3xl font-extrabold md:text-4xl">服務條款</h1>
        <p className="mx-auto max-w-[520px] text-sm/7 text-white/80">使用本服務前，請詳細閱讀以下條款。繼續使用即表示您同意本條款之內容。</p>
      </div>

      <main className="mx-auto w-full max-w-[900px] px-6 py-10 pb-20">
        <div className="mb-10 rounded-2xl border border-slate-200 bg-white px-7 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-400"><i className="fas fa-list-ul" /> &nbsp;目錄</h2>
          <ol className="grid list-decimal gap-x-6 gap-y-1 pl-5 text-sm text-slate-600 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] dark:text-slate-300">
            <li><a href="#s1" className="text-indigo-600 hover:underline dark:text-indigo-400">服務說明</a></li>
            <li><a href="#s2" className="text-indigo-600 hover:underline dark:text-indigo-400">帳號與存取</a></li>
            <li><a href="#s3" className="text-indigo-600 hover:underline dark:text-indigo-400">使用者責任</a></li>
            <li><a href="#s4" className="text-indigo-600 hover:underline dark:text-indigo-400">禁止行為</a></li>
            <li><a href="#s5" className="text-indigo-600 hover:underline dark:text-indigo-400">資料所有權</a></li>
            <li><a href="#s6" className="text-indigo-600 hover:underline dark:text-indigo-400">服務可用性</a></li>
            <li><a href="#s7" className="text-indigo-600 hover:underline dark:text-indigo-400">免責聲明</a></li>
            <li><a href="#s8" className="text-indigo-600 hover:underline dark:text-indigo-400">責任限制</a></li>
            <li><a href="#s9" className="text-indigo-600 hover:underline dark:text-indigo-400">條款修改</a></li>
            <li><a href="#s10" className="text-indigo-600 hover:underline dark:text-indigo-400">終止服務</a></li>
            <li><a href="#s11" className="text-indigo-600 hover:underline dark:text-indigo-400">聯絡方式</a></li>
          </ol>
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s1">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-circle-info" /></span>1. 服務說明</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">「AssetPilot」（以下簡稱「本服務」）是一款個人財務管理網頁應用程式，提供記帳、預算管理、股票紀錄、報表分析等功能。</p>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務採用自行部署（Self-hosted）架構，由管理員架設於自有伺服器上，供授權使用者存取使用。</p>
          <div className="my-4 flex gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm/7 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"><i className="fas fa-info-circle mt-0.5 shrink-0" /><span>本服務僅供個人財務記錄與管理用途，不提供任何投資建議、財務諮詢或金融服務。</span></div>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s2">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-user-lock" /></span>2. 帳號與存取</div>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">帳號建立</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">使用本服務須建立帳號。您可透過電子郵件與密碼，或 Google SSO（若管理員已啟用）完成註冊。</p>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">帳號安全</h3>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>您有責任妥善保管您的帳號密碼，不得與他人共用</li>
            <li>請使用足夠強度的密碼，避免與其他服務共用相同密碼</li>
            <li>若發現帳號遭未授權使用，請立即變更密碼並通知管理員</li>
            <li>您對以您帳號名義發生的所有操作負完全責任</li>
          </ul>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">帳號資格</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務由管理員決定是否開放公開註冊。管理員有權在任何時候停用或刪除任何帳號。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s3">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-user-check" /></span>3. 使用者責任</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">使用本服務時，您同意：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>輸入真實、準確的財務資料（本服務僅作為個人記帳工具，輸入資料的正確性由您自行負責）</li>
            <li>定期備份重要資料，可透過「設定 &gt; 資料匯出」匯出 CSV 備份</li>
            <li>遵守適用的法律法規，不將本服務用於任何非法目的</li>
            <li>不干擾其他使用者的正常使用</li>
          </ul>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s4">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-ban" /></span>4. 禁止行為</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">使用本服務時，嚴格禁止以下行為：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>嘗試未授權存取系統、資料庫或其他使用者的資料</li>
            <li>對本服務進行滲透測試、漏洞掃描或任何安全測試（未經管理員明確書面授權前）</li>
            <li>發送超出正常使用範圍的大量自動化請求（DDoS 或爬蟲行為）</li>
            <li>試圖繞過身份驗證、速率限制或其他安全機制</li>
            <li>上傳含有惡意程式碼、病毒或任何有害內容的資料</li>
            <li>使用本服務從事洗錢、逃稅或任何違法財務活動的記錄</li>
            <li>冒充他人身份建立帳號</li>
          </ul>
          <div className="my-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm/7 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"><i className="fas fa-triangle-exclamation mt-0.5 shrink-0" /><span>違反上述禁止行為將導致帳號立即終止，情節嚴重者管理員保留追究法律責任的權利。</span></div>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s5">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-database" /></span>5. 資料所有權</div>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">您的資料</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">您輸入至本服務的所有財務資料均屬於您個人所有。本服務不主張對您的資料擁有任何所有權。</p>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">資料可攜性</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">您可以隨時透過「設定 &gt; 資料匯出匯入」將您的資料匯出為 CSV 格式，以確保資料的可攜性與備份。</p>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">資料刪除</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">刪除帳號時，您的所有資料將被永久刪除，且無法復原。請在刪除帳號前務必先完成資料匯出。</p>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">伺服器儲存</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">您的資料儲存於管理員提供的伺服器上。管理員有義務採取合理措施保護資料安全，但不對因不可抗力、硬體故障或其他意外情況造成的資料遺失負責。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s6">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-server" /></span>6. 服務可用性</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務以「現狀」（As-Is）提供，不保證服務的持續可用性。以下情況可能導致服務中斷：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>伺服器維護或升級</li>
            <li>網路故障或基礎設施問題</li>
            <li>系統更新或緊急修復</li>
            <li>不可抗力事件（天災、停電等）</li>
          </ul>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">外部服務依賴</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務部分功能依賴第三方 API（TWSE 股價、匯率 API 等）。這些外部服務的可用性不在本服務控制範圍內，相關功能可能因第三方服務中斷而暫時無法使用。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s7">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-circle-exclamation" /></span>7. 免責聲明</div>
          <div className="my-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm/7 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"><i className="fas fa-triangle-exclamation mt-0.5 shrink-0" /><span><strong>本服務不提供投資建議。</strong>本服務呈現的股票價格、損益計算、資產報表等資料，僅作為個人記帳與追蹤用途，不構成任何投資建議或財務諮詢意見。</span></div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">本服務明確聲明不承擔以下責任：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li><strong>投資決策</strong>：因使用本服務的資料做出投資決策所造成的任何損失</li>
            <li><strong>資料準確性</strong>：股票價格、匯率等第三方資料的準確性或即時性</li>
            <li><strong>稅務合規</strong>：本服務計算的損益或報表不構成稅務申報依據，請諮詢專業稅務顧問</li>
            <li><strong>資料遺失</strong>：因技術故障、使用者操作或其他原因造成的資料遺失</li>
            <li><strong>間接損失</strong>：因使用或無法使用本服務所造成的任何間接、附帶或衍生損失</li>
          </ul>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s8">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-scale-balanced" /></span>8. 責任限制</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">在適用法律允許的最大範圍內，本服務管理員對因使用或無法使用本服務所造成的任何直接、間接、附帶、特殊或懲罰性損害不承擔責任，即使已被告知此類損害的可能性。</p>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">管理員的總體責任在任何情況下均不超過您在過去十二（12）個月內為使用本服務所支付的費用（若本服務為免費提供，則責任上限為新臺幣一元）。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s9">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-file-pen" /></span>9. 條款修改</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">管理員保留隨時修改本服務條款的權利。重大變更將透過版本更新資訊（Changelog）或應用程式內通知告知使用者。</p>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">修改後繼續使用本服務，視為您接受更新後的條款。若您不同意修改後的條款，請停止使用本服務並刪除您的帳號。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s10">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-power-off" /></span>10. 終止服務</div>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">使用者終止</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">您可以隨時於「設定 &gt; 帳號設定」刪除您的帳號以終止使用本服務。建議刪除前先匯出所有資料。</p>
          <h3 className="mb-2 mt-4 text-[15px] font-semibold">管理員終止</h3>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">管理員有權在以下情況終止您的帳號存取：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>違反本服務條款</li>
            <li>長期未使用（管理員自行決定標準）</li>
            <li>伺服器資源限制需要</li>
            <li>服務整體關閉</li>
          </ul>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">在可能的情況下，管理員將提前通知帳號終止，並給予合理的資料匯出時間。</p>
        </section>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8" id="s11">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400"><i className="fas fa-envelope" /></span>11. 聯絡方式</div>
          <p className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">若您對本服務條款有任何疑問，請透過以下方式聯絡：</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
            <li>透過「設定 &gt; 帳號設定」頁面中的意見回饋功能</li>
            <li>或直接聯絡您的系統管理員</li>
          </ul>
        </section>

        <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-400 dark:border-slate-800">
          <p>最後更新日期：2026 年 4 月 10 日</p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-5">
            <a href="/privacy" className="text-indigo-600 dark:text-indigo-400"><i className="fas fa-shield-halved" /> 隱私權政策</a>
            <a href="/" className="text-indigo-600 dark:text-indigo-400"><i className="fas fa-house" /> 返回首頁</a>
          </div>
        </div>
      </main>
    </div>
  );
}

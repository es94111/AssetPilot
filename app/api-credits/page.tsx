export const dynamic = 'force-dynamic';

import externalApisData from '../../lib/external-apis.json';

export const metadata = {
  title: 'API 使用與授權 — AssetPilot',
};

const usageNotes = [
  {
    icon: 'fa-money-bill-trend-up',
    title: '匯率同步',
    text: '只查詢公開匯率資料，不會送出個人財務明細。',
  },
  {
    icon: 'fa-chart-line',
    title: '台股資料',
    text: '僅帶股票代號與市場資料，不包含帳戶、持股成本或交易紀錄。',
  },
  {
    icon: 'fa-location-dot',
    title: '登入稽核',
    text: 'IPinfo 僅用於登入紀錄中的國家資訊顯示。',
  },
  {
    icon: 'fa-user-check',
    title: '第三方登入',
    text: 'Google Identity Services 僅在主動登入或綁定時啟用。',
  },
];

const serviceKinds = [
  { label: '資料查詢', count: 3, icon: 'fa-database' },
  { label: '身份驗證', count: 1, icon: 'fa-key' },
  { label: 'Email 通道', count: 3, icon: 'fa-envelope' },
];

export default async function ApiCreditsPage() {
  const freeServices = externalApisData.filter((api) => api.supportsFree).length;
  const paidServices = externalApisData.filter((api) => api.supportsPaid).length;
  const attributionServices = externalApisData.filter((api) => api.attribution).length;

  return (
    <div className="public-info-page min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
          <a href="/" className="inline-flex items-center gap-2.5 text-base font-bold text-white">
            <img src="/logo.svg" alt="AssetPilot" className="h-7 w-7" />
            AssetPilot
          </a>
          <a
            href="/"
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-sky-300/30 px-3.5 text-xs font-semibold text-sky-200 transition hover:border-sky-200/50 hover:bg-white/5 hover:text-white"
          >
            <i className="fas fa-arrow-left" />
            返回首頁
          </a>
        </div>
      </nav>

      <header className="mx-auto w-full max-w-6xl px-5 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <i className="fas fa-plug" />
              外部 API 透明揭露
            </div>
            <h1 className="max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              API 使用與授權
            </h1>
            <p className="mt-4 max-w-2xl text-sm/7 text-slate-300 sm:text-base/8">
              AssetPilot 僅在功能需要時連線至外部資料來源。這裡列出各項 API 的用途、授權資訊與資料傳送範圍，方便自行部署時確認合規狀態。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '外部服務', value: externalApisData.length, icon: 'fa-layer-group' },
              { label: '支援免費', value: freeServices, icon: 'fa-circle-check' },
              { label: '需標示來源', value: attributionServices, icon: 'fa-copyright' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-4 text-center shadow-sm backdrop-blur">
                <i className={`fas ${item.icon} text-sm text-sky-200`} />
                <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-6">
        <section className="mb-5 grid gap-4 md:grid-cols-3">
          {serviceKinds.map((kind) => (
            <div key={kind.label} className="rounded-xl border border-white/10 bg-white/[0.05] p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400">{kind.label}</p>
                  <p className="mt-1 text-2xl font-bold text-white">{kind.count}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-300/10 text-sky-200">
                  <i className={`fas ${kind.icon}`} />
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="mb-5 rounded-xl border border-white/10 bg-white/[0.05] p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">資料透明度</h2>
              <p className="mt-2 max-w-2xl text-sm/7 text-slate-300">
                下列情境只傳送完成該功能所需的最小資料，不會把你的財務明細交給第三方服務。
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <i className="fas fa-shield-halved" />
              最小必要資料原則
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {usageNotes.map((note) => (
              <div key={note.title} className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-300/10 text-sky-200">
                  <i className={`fas ${note.icon}`} />
                </div>
                <h3 className="text-sm font-bold text-white">{note.title}</h3>
                <p className="mt-2 text-sm/6 text-slate-300">{note.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-5 rounded-xl border border-white/10 bg-white/[0.05] p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">外部服務清單</h2>
              <p className="mt-2 text-sm/7 text-slate-300">
                共 {externalApisData.length} 項服務，其中 {freeServices} 項支援免費方案，{paidServices} 項可使用付費方案。
              </p>
            </div>
            <a
              href="/privacy"
              className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-sky-300/25 px-3.5 text-xs font-semibold text-sky-200 transition hover:border-sky-200/50 hover:bg-white/5 hover:text-white"
            >
              <i className="fas fa-shield-halved" />
              隱私權政策
            </a>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {externalApisData.map((api) => (
              <article key={api.name} className="rounded-xl border border-white/10 bg-slate-950/35 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-white">{api.name}</h3>
                    <p className="mt-2 text-sm/7 text-slate-300">{api.description}</p>
                  </div>
                  <a
                    href={api.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-sky-200 transition hover:border-sky-200/50 hover:bg-white/5 hover:text-white"
                  >
                    官方網站
                    <i className="fas fa-arrow-up-right-from-square text-[10px]" />
                  </a>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-300/10 px-2.5 py-1.5 text-emerald-200">
                    <i className={`fas ${api.supportsFree ? 'fa-check' : 'fa-minus'}`} />
                    免費方案 {api.supportsFree ? '支援' : '未提供'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-300/10 px-2.5 py-1.5 text-sky-200">
                    <i className={`fas ${api.supportsPaid ? 'fa-check' : 'fa-minus'}`} />
                    付費方案 {api.supportsPaid ? '支援' : '未提供'}
                  </span>
                </div>

                {api.attribution && (
                  <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm/6 text-amber-100">
                    <i className="fas fa-circle-info mr-2" />
                    {api.attribution}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/10 pt-6 text-center text-xs text-slate-400">
          <p>最後更新日期：2026 年 5 月 11 日</p>
          <div className="mt-3 flex flex-wrap justify-center gap-5">
            <a href="/privacy" className="inline-flex items-center gap-1.5 text-sky-200">
              <i className="fas fa-shield-halved" />
              隱私權政策
            </a>
            <a href="/terms" className="inline-flex items-center gap-1.5 text-sky-200">
              <i className="fas fa-file-contract" />
              服務條款
            </a>
            <a href="/" className="inline-flex items-center gap-1.5 text-sky-200">
              <i className="fas fa-house" />
              返回首頁
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

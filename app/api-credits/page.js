export const dynamic = 'force-dynamic';

import externalApisData from '../../lib/external-apis.json';

export default async function ApiCreditsPage() {
  const usageNotes = [
    '匯率同步只會查公開匯率資料，不會送出個人財務明細。',
    'TWSE 相關查詢只會帶股票代號與市場資料，不會包含你的帳戶或持股成本。',
    'IPinfo 僅用於登入稽核顯示國家資訊。',
    'Google Identity Services 僅在你主動使用 Google 登入或綁定時才會啟用。',
  ];

  return (
    <div className="public-info-page min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-14 w-full max-w-[1000px] items-center justify-between px-6">
          <a href="/" className="inline-flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-slate-100">
            <img src="/logo.svg" alt="AssetPilot" className="h-7 w-7" />
            AssetPilot
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500 px-3.5 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:text-indigo-400">
            返回首頁
          </a>
        </div>
      </nav>

      <div className="bg-gradient-to-br from-sky-700 to-indigo-500 px-6 py-14 text-center text-white">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">API</div>
        <h1 className="mb-2.5 text-3xl font-extrabold md:text-4xl">API 使用與授權</h1>
        <p className="mx-auto max-w-[620px] text-sm/7 text-white/85">
          首頁補回舊版公開入口後，這個頁面也一起恢復成未登入可查看，讓使用者先知道外部資料來源、授權與用途。
        </p>
      </div>

      <main className="mx-auto w-full max-w-[1000px] px-6 py-10 pb-20">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-7 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">外部服務清單</h2>
          <p className="mt-2 text-sm/7 text-slate-600 dark:text-slate-300">
            AssetPilot 僅在特定功能需要時呼叫以下外部服務，例如股價、匯率、登入或寄信。這些來源不直接保存您的財務明細。
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">資料透明度</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
              {usageNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">合規與授權</h2>
            <div className="mt-3 space-y-2 text-sm/7 text-slate-600 dark:text-slate-300">
              <p>頁面會列出每個外部來源的官方網站、用途、是否支援免費/付費方案，以及需要保留的授權標示。</p>
              <p>如果某服務要求顯示 attribution，例如 IPinfo，這裡會明確列出，避免遷移後把授權資訊弄丟。</p>
            </div>
          </section>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {externalApisData.map((api) => (
            <section key={api.name} className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{api.name}</h3>
                  <p className="mt-2 text-sm/7 text-slate-600 dark:text-slate-300">{api.description}</p>
                </div>
                <a href={api.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  官方網站
                </a>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  免費方案: {api.supportsFree ? '支援' : '不支援'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  付費方案: {api.supportsPaid ? '支援' : '不支援'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  用途: {api.description}
                </span>
              </div>

              {api.attribution && (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {api.attribution}
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

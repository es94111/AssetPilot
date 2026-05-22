import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

const FEATURE_PILLARS = [
  {
    title: '收支與預算管理',
    tag: '記帳核心',
    accent: 'from-sky-500/20 to-blue-500/5 border-sky-400/20',
    items: ['多帳戶餘額追蹤與跨帳戶轉帳', '月度與分類預算進度條控管', '固定收支自動產生交易', '批次調整分類、日期與刪除'],
  },
  {
    title: '台股投資追蹤',
    tag: '股票模組',
    accent: 'from-emerald-500/20 to-green-500/5 border-emerald-400/20',
    items: ['TWSE 股價查詢與除權息同步', 'FIFO 全精度實現損益計算', '股利紀錄與帳戶入款追蹤', '定期定額與下市標記管理'],
  },
  {
    title: '安全與資料治理',
    tag: '治理能力',
    accent: 'from-violet-500/20 to-fuchsia-500/5 border-violet-400/20',
    items: ['ChaCha20-Poly1305 落地加密', '帳密、Google、Passkey 三種登入', '匯出匯入、備份還原與稽核日誌', 'Rate limit、CSP 與 CSV 防注入保護'],
  },
  {
    title: '自架部署與契約',
    tag: 'Self-hosted',
    accent: 'from-amber-500/20 to-yellow-500/5 border-amber-400/20',
    items: ['Docker 一行啟動', '支援 amd64 與 arm64', 'OpenAPI 3.2 契約文件', 'URL-first 路由，可直接書籤與重整'],
  },
];

const STATS = [
  { value: '6+', label: '核心模組', sublabel: '記帳、股票、報表、治理' },
  { value: 'ChaCha20', label: '資料加密', sublabel: 'Poly1305 AEAD + PBKDF2' },
  { value: 'TWSE', label: '股價來源', sublabel: '盤中、盤後、備援策略' },
  { value: 'FIFO', label: '精度計算', sublabel: 'decimal.js 逐筆損益' },
];

const STACK = ['Next.js 15', 'React 19', 'Tailwind CSS v4', 'PostgreSQL', 'JWT + WebAuthn', 'OpenAPI 3.2.0', 'Chart.js', 'Docker multi-arch'];

export default async function Home() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.14),transparent_24%)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="AssetPilot" className="h-11 w-11 rounded-2xl bg-white p-1.5" />
            <div>
              <div className="text-xl font-semibold tracking-tight">AssetPilot</div>
              <div className="text-sm text-slate-300">個人財務指揮中心</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-400">立即登入</Link>
            <Link href="/login?mode=register" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5">建立帳號</Link>
          </div>
        </header>

        <section className="grid gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">自托管、資料加密、AGPL v3</div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              你的財務指揮中心，
              <span className="text-sky-300">從首頁就能先看清楚。</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              整合台股投資、收支記帳、預算追蹤、報表分析與資料稽核。所有財務資料以<strong className="text-white"> ChaCha20-Poly1305 </strong>加密落地，不綁雲端、不靠訂閱，先理解產品，再決定是否登入。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-2xl bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-200">開始使用</Link>
              <Link href="/login?mode=register" className="rounded-2xl border border-white/15 px-5 py-3 font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5">先建立帳號</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
              <li className="rounded-full border border-white/10 px-3 py-1.5">開源 AGPL v3</li>
              <li className="rounded-full border border-white/10 px-3 py-1.5">本地加密儲存</li>
              <li className="rounded-full border border-white/10 px-3 py-1.5">不綁外部雲端</li>
              <li className="rounded-full border border-white/10 px-3 py-1.5">Docker 一行部署</li>
              <li className="rounded-full border border-white/10 px-3 py-1.5">OpenAPI 3.2</li>
            </ul>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-2">
              {STATS.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="text-2xl font-semibold text-white">{stat.value}</div>
                  <div className="mt-1 text-sm font-medium text-slate-100">{stat.label}</div>
                  <div className="mt-1 text-sm text-slate-400">{stat.sublabel}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm leading-7 text-slate-200">
              未登入也能先了解 AssetPilot 的功能、資料處理方式與部署特性，再選擇登入或建立帳號。
            </div>
          </div>
        </section>

        <section className="py-6">
          <div className="mb-8">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Why AssetPilot</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">把日常記帳、投資追蹤與資料掌控放在同一個地方</h2>
            <p className="mt-3 max-w-3xl text-slate-300">AssetPilot 專為自主管理個人財務而設計，從收支、預算到台股投資都能集中整理，並保留資料匯出、稽核與自架部署的彈性。</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {FEATURE_PILLARS.map((pillar) => (
              <article key={pillar.title} className={`rounded-3xl border bg-gradient-to-br p-6 ${pillar.accent}`}>
                <div className="text-sm font-medium text-slate-300">{pillar.tag}</div>
                <h3 className="mt-2 text-2xl font-semibold text-white">{pillar.title}</h3>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-200">
                  {pillar.items.map((item) => (
                    <li key={item} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 py-14 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Quick Start</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">60 秒跑在你自己的伺服器</h2>
            <p className="mt-4 max-w-2xl text-slate-300">使用 Docker 快速啟動，首次執行會自動產生 JWT 與資料庫加密金鑰。支援 amd64、arm64，適合部署在 NAS、VPS 或自己的 Docker 主機上。</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-200">
              <span className="rounded-full border border-white/10 px-3 py-1.5">約 180 MB 映像</span>
              <span className="rounded-full border border-white/10 px-3 py-1.5">amd64 + arm64</span>
              <span className="rounded-full border border-white/10 px-3 py-1.5">內建健康檢查</span>
              <span className="rounded-full border border-white/10 px-3 py-1.5">金鑰首次啟動自動產生</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-300" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <div className="text-xs text-slate-400">docker run</div>
            </div>
            <pre className="overflow-x-auto px-5 py-5 text-sm leading-7 text-slate-200"><code>{`docker run -d \
  --name assetpilot \
  -p 3000:3000 \
  -v assetpilot-data:/app/data \
  es94111/assetpilot:latest`}</code></pre>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Tech Stack</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">技術堆疊與公開資訊入口</h2>
          <p className="mt-4 max-w-3xl text-slate-300">清楚列出主要技術、外部資料來源與授權資訊，讓使用者在開始使用前就能掌握服務如何運作。</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {STACK.map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-black/10 px-3 py-2 text-sm text-slate-200">{item}</span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/api-credits" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5">API 使用與授權</Link>
            <Link href="/privacy" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5">隱私權政策</Link>
            <Link href="/terms" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5">服務條款</Link>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/10 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>GNU AGPL v3，個人資產管理，自架、自控、自備份。</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="transition hover:text-white">隱私權政策</Link>
            <Link href="/terms" className="transition hover:text-white">服務條款</Link>
            <Link href="/api-credits" className="transition hover:text-white">API 使用與授權</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

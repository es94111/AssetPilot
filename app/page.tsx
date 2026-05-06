import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

const FEATURE_GROUPS = [
  {
    title: '收支與預算',
    items: ['儀表板總覽', '交易管理', '預算管理', '帳戶管理', '分類管理', '固定收支'],
  },
  {
    title: '股票投資',
    items: ['持股總覽', '股票交易', '股利紀錄', '實現損益', '股票設定'],
  },
  {
    title: '系統功能',
    items: ['統計報表', '資料匯出匯入', '帳號設定', '管理員功能', 'API 使用與授權'],
  },
];

export default async function Home() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="AssetPilot" className="h-10 w-10 rounded-xl bg-white p-1" />
            <div>
              <div className="text-xl font-semibold">AssetPilot</div>
              <div className="text-sm text-slate-300">未登入也能先看首頁與產品功能</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/terms"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:bg-white/5"
            >
              服務條款
            </Link>
            <Link
              href="/privacy"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:bg-white/5"
            >
              隱私權政策
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400"
            >
              登入 / 註冊
            </Link>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
              自托管個人資產管理
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              首頁現在對未登入使用者公開，先了解功能，再決定是否登入。
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              AssetPilot 提供記帳、預算、股票紀錄、統計報表與資料治理功能。新版目前頁面路由已改成 Next.js，首頁不該再直接把訪客送去登入頁。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-200"
              >
                開始登入
              </Link>
              <Link
                href="/api-credits"
                className="rounded-xl border border-white/15 px-5 py-3 font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5"
              >
                查看 API 使用與授權
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-slate-300">
              功能總覽
            </div>
            <div className="space-y-5">
              {FEATURE_GROUPS.map((group) => (
                <section key={group.title}>
                  <h2 className="text-base font-semibold text-white">{group.title}</h2>
                  <ul className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    {group.items.map((item) => (
                      <li key={item} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

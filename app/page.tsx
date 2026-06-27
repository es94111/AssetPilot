import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PublicLanguageSwitcher } from '@/components/i18n/PublicLanguageSwitcher';
import { getSession } from '@/lib/auth';
import { getTranslator } from '@/lib/i18n/getDictionary';
import { resolveLocale } from '@/lib/i18n/resolveLocale';

type T = ReturnType<typeof getTranslator>;

function getFeaturePillars(t: T) {
  return [
    {
      title: t('public.home.pillars.finance.title'),
      tag: t('public.home.pillars.finance.tag'),
      accent: 'from-sky-500/20 to-blue-500/5 border-sky-400/20',
      items: [
        t('public.home.pillars.finance.items.one'),
        t('public.home.pillars.finance.items.two'),
        t('public.home.pillars.finance.items.three'),
        t('public.home.pillars.finance.items.four'),
      ],
    },
    {
      title: t('public.home.pillars.stocks.title'),
      tag: t('public.home.pillars.stocks.tag'),
      accent: 'from-emerald-500/20 to-green-500/5 border-emerald-400/20',
      items: [
        t('public.home.pillars.stocks.items.one'),
        t('public.home.pillars.stocks.items.two'),
        t('public.home.pillars.stocks.items.three'),
        t('public.home.pillars.stocks.items.four'),
      ],
    },
    {
      title: t('public.home.pillars.security.title'),
      tag: t('public.home.pillars.security.tag'),
      accent: 'from-violet-500/20 to-fuchsia-500/5 border-violet-400/20',
      items: [
        t('public.home.pillars.security.items.one'),
        t('public.home.pillars.security.items.two'),
        t('public.home.pillars.security.items.three'),
        t('public.home.pillars.security.items.four'),
      ],
    },
    {
      title: t('public.home.pillars.selfHosted.title'),
      tag: t('public.home.pillars.selfHosted.tag'),
      accent: 'from-amber-500/20 to-yellow-500/5 border-amber-400/20',
      items: [
        t('public.home.pillars.selfHosted.items.one'),
        t('public.home.pillars.selfHosted.items.two'),
        t('public.home.pillars.selfHosted.items.three'),
        t('public.home.pillars.selfHosted.items.four'),
      ],
    },
  ];
}

function getStats(t: T) {
  return [
    { value: t('public.home.stats.modules.value'), label: t('public.home.stats.modules.label'), sublabel: t('public.home.stats.modules.sublabel') },
    { value: t('public.home.stats.encryption.value'), label: t('public.home.stats.encryption.label'), sublabel: t('public.home.stats.encryption.sublabel') },
    { value: t('public.home.stats.stockSource.value'), label: t('public.home.stats.stockSource.label'), sublabel: t('public.home.stats.stockSource.sublabel') },
    { value: t('public.home.stats.precision.value'), label: t('public.home.stats.precision.label'), sublabel: t('public.home.stats.precision.sublabel') },
  ];
}

const STACK = ['Next.js 15', 'React 19', 'Tailwind CSS v4', 'PostgreSQL', 'JWT + WebAuthn', 'OpenAPI 3.2.0', 'Chart.js', 'Docker multi-arch'];

export default async function Home() {
  const session = await getSession();
  const locale = await resolveLocale();
  const t = getTranslator(locale);
  const featurePillars = getFeaturePillars(t);
  const stats = getStats(t);

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
              <div className="text-sm text-slate-300">{t('public.home.tagline')}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <PublicLanguageSwitcher compact />
            <Link href="/login" className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-400">{t('public.home.login')}</Link>
            <Link href="/login?mode=register" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5">{t('public.home.register')}</Link>
          </div>
        </header>

        <section className="grid gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">{t('public.home.badge')}</div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {t('public.home.headline1')}
              <br />
              <span className="text-sky-300">{t('public.home.headline2')}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              {t('public.home.leadBefore')}<strong className="text-white">{t('public.home.leadStrong')}</strong>{t('public.home.leadAfter')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-2xl bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-200">{t('public.home.startUsing')}</Link>
              <Link href="/login?mode=register" className="rounded-2xl border border-white/15 px-5 py-3 font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5">{t('public.home.createFirst')}</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
              <li className="rounded-full border border-white/10 px-3 py-1.5">{t('public.home.chips.openSource')}</li>
              <li className="rounded-full border border-white/10 px-3 py-1.5">{t('public.home.chips.encrypted')}</li>
              <li className="rounded-full border border-white/10 px-3 py-1.5">{t('public.home.chips.noCloudLock')}</li>
              <li className="rounded-full border border-white/10 px-3 py-1.5">{t('public.home.chips.docker')}</li>
              <li className="rounded-full border border-white/10 px-3 py-1.5">{t('public.home.chips.openapi')}</li>
            </ul>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-2">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="text-2xl font-semibold text-white">{stat.value}</div>
                  <div className="mt-1 text-sm font-medium text-slate-100">{stat.label}</div>
                  <div className="mt-1 text-sm text-slate-400">{stat.sublabel}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm leading-7 text-slate-200">
              {t('public.home.preLoginNote')}
            </div>
          </div>
        </section>

        <section className="py-6">
          <div className="mb-8">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">{t('public.home.whyLabel')}</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{t('public.home.whyTitle')}</h2>
            <p className="mt-3 max-w-3xl text-slate-300">{t('public.home.whyDescription')}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {featurePillars.map((pillar) => (
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
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">{t('public.home.quickStartLabel')}</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{t('public.home.quickStartTitle')}</h2>
            <p className="mt-4 max-w-2xl text-slate-300">{t('public.home.quickStartDescription')}</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-200">
              <span className="rounded-full border border-white/10 px-3 py-1.5">{t('public.home.quickStartChips.image')}</span>
              <span className="rounded-full border border-white/10 px-3 py-1.5">{t('public.home.quickStartChips.arch')}</span>
              <span className="rounded-full border border-white/10 px-3 py-1.5">{t('public.home.quickStartChips.health')}</span>
              <span className="rounded-full border border-white/10 px-3 py-1.5">{t('public.home.quickStartChips.keys')}</span>
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
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">{t('public.home.techLabel')}</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{t('public.home.techTitle')}</h2>
          <p className="mt-4 max-w-3xl text-slate-300">{t('public.home.techDescription')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {STACK.map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-black/10 px-3 py-2 text-sm text-slate-200">{item}</span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/api-credits" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5">{t('public.common.apiCredits')}</Link>
            <Link href="/privacy" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5">{t('public.common.privacy')}</Link>
            <Link href="/terms" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/5">{t('public.common.terms')}</Link>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/10 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('public.home.footer')}</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="transition hover:text-white">{t('public.common.privacy')}</Link>
            <Link href="/terms" className="transition hover:text-white">{t('public.common.terms')}</Link>
            <Link href="/api-credits" className="transition hover:text-white">{t('public.common.apiCredits')}</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

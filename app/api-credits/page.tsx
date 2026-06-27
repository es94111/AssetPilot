import externalApisData from '../../lib/external-apis.json';
import { PublicLanguageSwitcher } from '@/components/i18n/PublicLanguageSwitcher';
import { getTranslator } from '@/lib/i18n/getDictionary';
import { resolveLocale } from '@/lib/i18n/resolveLocale';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const locale = await resolveLocale();
  const t = getTranslator(locale);
  return {
    title: t('public.apiCreditsPage.metadataTitle'),
  };
}

type T = ReturnType<typeof getTranslator>;

function getUsageNotes(t: T) {
  return [
    { icon: 'fa-money-bill-trend-up', title: t('public.apiCreditsPage.usageNotes.fx.title'), text: t('public.apiCreditsPage.usageNotes.fx.text') },
    { icon: 'fa-chart-line', title: t('public.apiCreditsPage.usageNotes.stock.title'), text: t('public.apiCreditsPage.usageNotes.stock.text') },
    { icon: 'fa-location-dot', title: t('public.apiCreditsPage.usageNotes.audit.title'), text: t('public.apiCreditsPage.usageNotes.audit.text') },
    { icon: 'fa-user-check', title: t('public.apiCreditsPage.usageNotes.login.title'), text: t('public.apiCreditsPage.usageNotes.login.text') },
    { icon: 'fa-cloud-arrow-up', title: t('public.apiCreditsPage.usageNotes.backup.title'), text: t('public.apiCreditsPage.usageNotes.backup.text') },
  ];
}

function getServiceKinds(t: T) {
  return [
    { label: t('public.apiCreditsPage.serviceKinds.data'), count: 3, icon: 'fa-database' },
    { label: t('public.apiCreditsPage.serviceKinds.auth'), count: 2, icon: 'fa-key' },
    { label: t('public.apiCreditsPage.serviceKinds.email'), count: 3, icon: 'fa-envelope' },
    { label: t('public.apiCreditsPage.serviceKinds.backup'), count: 1, icon: 'fa-cloud-arrow-up' },
  ];
}

function translateApiDescription(name: string, fallback: string, t: T) {
  if (name === 'exchangerate-api.com') return t('public.apiCreditsPage.descriptions.exchangeRate');
  if (name === 'IPinfo') return t('public.apiCreditsPage.descriptions.ipinfo');
  if (name.startsWith('TWSE')) return t('public.apiCreditsPage.descriptions.twse');
  if (name === 'Google Identity Services') return t('public.apiCreditsPage.descriptions.google');
  if (name === 'LINE Login') return t('public.apiCreditsPage.descriptions.line');
  if (name.startsWith('SMTP')) return t('public.apiCreditsPage.descriptions.smtp');
  if (name.startsWith('Zeabur')) return t('public.apiCreditsPage.descriptions.zeabur');
  if (name === 'Resend') return t('public.apiCreditsPage.descriptions.resend');
  if (name === 'MEGA S4 Object Storage') return t('public.apiCreditsPage.descriptions.mega');
  return fallback;
}

export default async function ApiCreditsPage() {
  const locale = await resolveLocale();
  const t = getTranslator(locale);
  const usageNotes = getUsageNotes(t);
  const serviceKinds = getServiceKinds(t);
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
            {t('public.common.backHome')}
          </a>
          <PublicLanguageSwitcher compact />
        </div>
      </nav>

      <header className="mx-auto w-full max-w-6xl px-5 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <i className="fas fa-plug" />
              {t('public.apiCreditsPage.badge')}
            </div>
            <h1 className="max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              {t('public.apiCreditsPage.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-sm/7 text-slate-300 sm:text-base/8">
              {t('public.apiCreditsPage.description')}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('public.apiCreditsPage.stats.externalServices'), value: externalApisData.length, icon: 'fa-layer-group' },
              { label: t('public.apiCreditsPage.stats.freeSupported'), value: freeServices, icon: 'fa-circle-check' },
              { label: t('public.apiCreditsPage.stats.attributionRequired'), value: attributionServices, icon: 'fa-copyright' },
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
              <h2 className="text-xl font-bold text-white">{t('public.apiCreditsPage.transparencyTitle')}</h2>
              <p className="mt-2 max-w-2xl text-sm/7 text-slate-300">
                {t('public.apiCreditsPage.transparencyText')}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <i className="fas fa-shield-halved" />
              {t('public.apiCreditsPage.minNecessary')}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              <h2 className="text-xl font-bold text-white">{t('public.apiCreditsPage.serviceListTitle')}</h2>
              <p className="mt-2 text-sm/7 text-slate-300">
                {t('public.apiCreditsPage.serviceSummary', { total: externalApisData.length, free: freeServices, paid: paidServices })}
              </p>
            </div>
            <a
              href="/privacy"
              className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-sky-300/25 px-3.5 text-xs font-semibold text-sky-200 transition hover:border-sky-200/50 hover:bg-white/5 hover:text-white"
            >
              <i className="fas fa-shield-halved" />
              {t('public.common.privacy')}
            </a>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {externalApisData.map((api) => (
              <article key={api.name} className="rounded-xl border border-white/10 bg-slate-950/35 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-white">{api.name}</h3>
                    <p className="mt-2 text-sm/7 text-slate-300">{translateApiDescription(api.name, api.description, t)}</p>
                  </div>
                  <a
                    href={api.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-sky-200 transition hover:border-sky-200/50 hover:bg-white/5 hover:text-white"
                  >
                    {t('public.apiCreditsPage.officialSite')}
                    <i className="fas fa-arrow-up-right-from-square text-[10px]" />
                  </a>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-300/10 px-2.5 py-1.5 text-emerald-200">
                    <i className={`fas ${api.supportsFree ? 'fa-check' : 'fa-minus'}`} />
                    {t('public.apiCreditsPage.freePlan')} {api.supportsFree ? t('public.apiCreditsPage.supported') : t('public.apiCreditsPage.unavailable')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-300/10 px-2.5 py-1.5 text-sky-200">
                    <i className={`fas ${api.supportsPaid ? 'fa-check' : 'fa-minus'}`} />
                    {t('public.apiCreditsPage.paidPlan')} {api.supportsPaid ? t('public.apiCreditsPage.supported') : t('public.apiCreditsPage.unavailable')}
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
          <p>{t('public.common.lastUpdated', { date: t('public.common.dates.apiCredits') })}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-5">
            <a href="/privacy" className="inline-flex items-center gap-1.5 text-sky-200">
              <i className="fas fa-shield-halved" />
              {t('public.common.privacy')}
            </a>
            <a href="/terms" className="inline-flex items-center gap-1.5 text-sky-200">
              <i className="fas fa-file-contract" />
              {t('public.common.terms')}
            </a>
            <a href="/" className="inline-flex items-center gap-1.5 text-sky-200">
              <i className="fas fa-house" />
              {t('public.common.backHome')}
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

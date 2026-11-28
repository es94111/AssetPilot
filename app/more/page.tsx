import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import VersionInfoButton from '@/components/layout/VersionInfoButton';
import Disclosure from '@/components/ui/Disclosure';
import { getTranslator } from '@/lib/i18n/getDictionary';
import { resolveLocale } from '@/lib/i18n/resolveLocale';
import { requireServerAuth } from '@/lib/serverAuth';

const sections = [
  {
    label: 'ux.ledgerTools',
    links: [
      ['/settings/ledgers', 'nav.ledgers'],
      ['/finance/accounts', 'nav.accounts'],
      ['/finance/categories', 'nav.categories'],
      ['/finance/tags', 'nav.tags'],
      ['/finance/recurring', 'nav.recurring'],
      ['/finance/calendar', 'nav.calendar'],
      ['/finance/reconciliation', 'nav.reconciliation'],
    ],
  },
  {
    label: 'ux.budgetsAndReports',
    links: [
      ['/finance/budget', 'nav.budget'],
      ['/finance/goals', 'nav.goals'],
      ['/finance/reports', 'nav.reports'],
      ['/finance/info-board', 'nav.infoBoard'],
    ],
  },
  {
    label: 'ux.settingsAndHelp',
    links: [
      ['/settings/account', 'settings.title'],
      ['/api-credits', 'nav.apiCredits'],
    ],
  },
] as const;

export default async function MorePage() {
  const user = await requireServerAuth('/more');
  const t = getTranslator(await resolveLocale());

  return (
    <AppLayout user={user}>
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">{t('mobileLegacy.more')}</h1>
        {sections.map(({ label, links }) => (
          <Disclosure key={label} name="more-section" title={t(label)}>
            <ul className="[&>li+li]:border-t [&>li+li]:border-[var(--border)]">
              {links.map(([path, key]) => (
                <li key={path}>
                  <Link href={path} className="nav-link min-h-11">
                    <span className="min-w-0 flex-1">{t(key)}</span>
                    <ChevronRight size={16} aria-hidden="true" className="rtl:rotate-180" />
                  </Link>
                </li>
              ))}
              {label === 'ux.settingsAndHelp' && <li><VersionInfoButton /></li>}
            </ul>
          </Disclosure>
        ))}
      </div>
    </AppLayout>
  );
}

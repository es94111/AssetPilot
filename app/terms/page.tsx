import { LegalDocument } from '@/components/public/LegalDocument';
import { getTranslator } from '@/lib/i18n/getDictionary';
import { resolveLocale } from '@/lib/i18n/resolveLocale';
import { getLegalContent } from '@/lib/i18n/publicLegalContent';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const locale = await resolveLocale();
  const t = getTranslator(locale);
  const content = getLegalContent('terms', locale, t);
  return {
    title: `${content.title} — AssetPilot`,
  };
}

export default async function TermsPage() {
  const locale = await resolveLocale();
  const t = getTranslator(locale);
  return <LegalDocument content={getLegalContent('terms', locale, t)} />;
}

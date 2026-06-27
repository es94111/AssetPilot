import { getTranslator } from '@/lib/i18n/getDictionary';
import { resolveLocale } from '@/lib/i18n/resolveLocale';

export default async function MobileLineCallbackPage() {
  const locale = await resolveLocale();
  const t = getTranslator(locale);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>{t('public.appCallback.returningTitle')}</h1>
      <p>{t('public.appCallback.returningBody')}</p>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              var target = 'assetpilot://line-callback' + window.location.search;
              window.location.replace(target);
            })();
          `,
        }}
      />
    </main>
  );
}

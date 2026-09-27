import { getTranslator } from '@/lib/i18n/getDictionary';
import { resolveLocale } from '@/lib/i18n/resolveLocale';
import { AppCallbackStatus } from '@/components/public/AppCallbackStatus';

export default async function MobileLineCallbackPage() {
  const locale = await resolveLocale();
  const t = getTranslator(locale);

  return (
    <AppCallbackStatus title={t('public.appCallback.returningTitle')} message={t('public.appCallback.returningBody')}>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              var target = 'assetpilot://line-callback' + window.location.search;
              window.location.replace(target);
              // 見 app/app/google-callback/page.tsx 同段註解（AUTH-VULN-07）。
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', window.location.pathname);
              }
            })();
          `,
        }}
      />
    </AppCallbackStatus>
  );
}

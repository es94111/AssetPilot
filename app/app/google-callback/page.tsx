import { getTranslator } from '@/lib/i18n/getDictionary';
import { resolveLocale } from '@/lib/i18n/resolveLocale';

export default async function MobileGoogleCallbackPage() {
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
              var target = 'assetpilot://google-callback' + window.location.search;
              window.location.replace(target);
              // 自訂 scheme 交接常不觸發真正的頁面導覽（未安裝對應 App 時尤其明顯），
              // 帶有 code/state 的網址可能殘留在網址列/瀏覽紀錄，故立即清除查詢字串
              // （見安全報告 AUTH-VULN-07）。
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', window.location.pathname);
              }
            })();
          `,
        }}
      />
    </main>
  );
}

export default function MobileLineCallbackPage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>正在返回 AssetPilot App...</h1>
      <p>如果沒有自動返回，請確認已安裝最新版 AssetPilot Android App。</p>
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

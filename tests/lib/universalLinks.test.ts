// tests/lib/universalLinks.test.ts — Universal Links 的設定檢查
//
// 對應 docs/ios-app-development-plan.md 第 5.4 節與
// docs/ios-release-checklist.md 第 5.3 節。
//
// 為什麼需要這份檢查：Universal Links 的驗證檔必須放在
// `/.well-known/apple-app-site-association`，而且必須以
// `Content-Type: application/json` 提供。任何一項不合規，Apple 就會
// **靜默地**不開啟 App——沒有錯誤訊息，只會看到「點了網址沒反應」。
// 這類問題很難在開發時察覺，因此以自動化檢查守住。
//
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/universalLinks.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..');
const AASA_PATH = join(
  ROOT,
  'public',
  '.well-known',
  'apple-app-site-association',
);
const ENTITLEMENTS_PATH = join(
  ROOT,
  'mobile',
  'ios',
  'Runner',
  'Runner.entitlements',
);
const NEXT_CONFIG_PATH = join(ROOT, 'next.config.ts');

type AasaDetail = {
  appID?: string;
  components?: Array<{ '/': string; comment?: string }>;
};

type Aasa = {
  applinks?: {
    details?: AasaDetail[];
  };
};

function readAasa(): Aasa {
  return JSON.parse(readFileSync(AASA_PATH, 'utf8')) as Aasa;
}

test('apple-app-site-association 檔案存在且非空', () => {
  const raw = readFileSync(AASA_PATH, 'utf8');
  assert.ok(raw.length > 0, 'AASA 檔案不可為空');
});

test('AASA 是合法的 JSON，結構符合 Apple 規格', () => {
  const aasa = readAasa();
  const details = aasa.applinks?.details;
  assert.ok(Array.isArray(details), 'applinks.details 必須是陣列');
  assert.ok(details!.length > 0, 'applinks.details 不可為空');

  for (const detail of details!) {
    // appID 必須是「Team ID.bundle id」的形式。
    // TEAM_ID 是尚未填入的佔位符（見第 3 支測試），格式同樣符合。
    assert.match(
      detail.appID ?? '',
      /^[A-Z0-9_]+\.[A-Za-z0-9.]+$/,
      'appID 必須是「Team ID.bundle id」的形式',
    );
    assert.ok(detail.components, '每個 detail 都要有 components');
    assert.ok(detail.components!.length > 0, 'components 不可為空');
  }
});

test('appID 的 bundle id 與 iOS App 的 bundle id 一致', () => {
  for (const detail of readAasa().applinks!.details!) {
    assert.ok(
      detail.appID!.endsWith('.com.assetpilot.assetpilot'),
      `appID 必須以 .com.assetpilot.assetpilot 結尾（實際：${detail.appID}）`,
    );
  }
});

test('Team ID 仍是待填入的佔位符（需維護者替換）', () => {
  // 這不是缺陷，而是刻意的設計：Team ID 屬於 Apple Developer 帳號資訊，
  // 加入會員後才能確定，不應寫死在版本控制中。
  // 這支測試把「尚未填入」變成顯性狀態，避免被誤以為已完成。
  for (const detail of readAasa().applinks!.details!) {
    const teamId = detail.appID!.split('.')[0];
    assert.ok(
      teamId === 'TEAM_ID' || /^[A-Z0-9]{10}$/.test(teamId),
      'appID 的 Team ID 必須是 10 碼大寫英數，或保留 TEAM_ID 佔位符',
    );
  }
});

test('宣告的路徑涵蓋實際使用的分享帳本邀請路徑', () => {
  // 邀請連結由後端產生：/settings/ledgers?invite=…
  // （見 app/api/ledgers/[ledgerId]/members/route.ts）。
  // 若 AASA 沒涵蓋這個路徑，點邀請連結不會開啟 App。
  const patterns = readAasa().applinks!.details!.flatMap((d) =>
    (d.components ?? []).map((c) => c['/']),
  );
  assert.ok(
    patterns.some((p) => p.startsWith('/settings/ledgers')),
    `AASA 必須涵蓋 /settings/ledgers（實際：${patterns.join(', ')}）`,
  );
});

test('entitlements 宣告的網域與 AASA 檔案相符', () => {
  const entitlements = readFileSync(ENTITLEMENTS_PATH, 'utf8');
  assert.ok(
    entitlements.includes('applinks:asset.shao.one'),
    'entitlements 必須宣告 applinks:asset.shao.one',
  );
  assert.ok(
    entitlements.includes('com.apple.developer.associated-domains'),
    'entitlements 必須宣告 associated-domains',
  );
});

test('以 application/json 提供且不快取', () => {
  // 這兩項由 next.config.ts 的 headers() 設定。Apple 的要求：
  // - Content-Type 必須是 application/json（此檔沒有副檔名，不會被自動推導）。
  // - 不得轉址（headers source 用 exact path 直接命中靜態檔）。
  // - 不可長期快取，否則內容變更後 Apple 仍會使用舊的關聯資料。
  const config = readFileSync(NEXT_CONFIG_PATH, 'utf8');
  assert.ok(
    config.includes('/.well-known/apple-app-site-association'),
    'next.config.ts 必須為 AASA 設定 headers',
  );
  assert.ok(
    config.includes("value: 'application/json'"),
    'AASA 必須以 application/json 提供',
  );
  assert.ok(
    config.includes('must-revalidate'),
    'AASA 不可長期快取',
  );
});

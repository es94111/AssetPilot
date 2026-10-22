// tests/lib/describeDevice.test.ts — 工作階段／裝置標籤的解析檢查
//
// 對應 docs/ios-app-development-plan.md 第 4.1 節（安全設定、登入紀錄）與
// docs/ios-feature-matrix.md 的「安全設定」列。
//
// 為什麼需要這份檢查：
// iOS 與 Android 共用同一個後端。後端依 User-Agent 與 X-AssetPilot-Device-Id
// 產生「登入紀錄／Passkey」清單上的裝置名稱。若 iOS 的標記沒被認出來，
// 使用者只會看到「未知裝置」，分不出哪一台是自己的 iPhone，
// 也就無法放心撤銷其他裝置的登入。
// 這裡把 mobile/lib/api_client.dart 實際送出的標頭格式固定下來，
// 任何一端日後改動而讓標籤悄悄失效時，這份測試會立刻失敗。
//
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/describeDevice.test.ts

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';

// lib/loginHelpers 會匯入 lib/db，而 lib/db 在載入時會呼叫 ensureEnvSecrets()，
// 它會在 ENV_PATH 旁寫入自動產生的密鑰。指向暫存目錄，
// 才不會在儲存庫根目錄留下 .env 或 .env.generated-secrets。
const sandbox = mkdtempSync(join(tmpdir(), 'assetpilot-describe-device-'));
process.env.ENV_PATH = join(sandbox, '.env');

const { describeDevice, getAppDeviceIdFromHeaders, getUserAgentFromHeaders } = await import(
  '../../lib/loginHelpers.ts'
);

after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

// 與 mobile/lib/api_client.dart 的 _newAppDeviceId() 相同格式：16 位元組 → 32 個十六進位字元。
const DEVICE_ID = 'abcdef1234567890abcdef1234567890';

function appHeaders(platform: 'iOS' | 'Android', deviceId = DEVICE_ID): Headers {
  return new Headers({
    'User-Agent': `AssetPilotApp (${platform})`,
    'X-AssetPilot-Device-Id': deviceId,
  });
}

test('行動 App 的 User-Agent 會被辨識為 AssetPilot App（平台）', () => {
  assert.equal(describeDevice('AssetPilotApp (iOS)'), 'AssetPilot App（iOS）');
  assert.equal(describeDevice('AssetPilotApp (Android)'), 'AssetPilot App（Android）');
  assert.equal(describeDevice('AssetPilotApp'), 'AssetPilot App');
});

test('iOS 用戶端實際送出的標頭，登入紀錄會顯示 iOS 與裝置編號前 8 碼', () => {
  const userAgent = getUserAgentFromHeaders(appHeaders('iOS'));
  assert.equal(userAgent, `AssetPilotApp (iOS) AssetPilotDeviceId/${DEVICE_ID}`);
  assert.equal(describeDevice(userAgent), 'AssetPilot App（iOS） · ID abcdef12');
});

test('Android 用戶端同樣可辨識，且與 iOS 的標籤不同', () => {
  const ios = describeDevice(getUserAgentFromHeaders(appHeaders('iOS')));
  const android = describeDevice(getUserAgentFromHeaders(appHeaders('Android')));
  assert.equal(android, 'AssetPilot App（Android） · ID abcdef12');
  assert.notEqual(ios, android);
});

test('同一支手機的裝置編號固定，不同手機以編號區分', () => {
  const first = describeDevice(getUserAgentFromHeaders(appHeaders('iOS', DEVICE_ID)));
  const again = describeDevice(getUserAgentFromHeaders(appHeaders('iOS', DEVICE_ID)));
  const other = describeDevice(
    getUserAgentFromHeaders(appHeaders('iOS', '0123456789abcdef0123456789abcdef')),
  );
  assert.equal(first, again);
  assert.equal(other, 'AssetPilot App（iOS） · ID 01234567');
  assert.notEqual(first, other);
});

test('沒有裝置編號標頭時，只顯示平台', () => {
  const headers = new Headers({ 'User-Agent': 'AssetPilotApp (iOS)' });
  assert.equal(getAppDeviceIdFromHeaders(headers), '');
  assert.equal(getUserAgentFromHeaders(headers), 'AssetPilotApp (iOS)');
  assert.equal(describeDevice(getUserAgentFromHeaders(headers)), 'AssetPilot App（iOS）');
});

test('裝置編號標頭會清除不安全字元並限制在 64 碼內', () => {
  const sanitized = new Headers({ 'X-AssetPilot-Device-Id': 'ab cd!@#ef-12_34' });
  assert.equal(getAppDeviceIdFromHeaders(sanitized), 'abcdef-12_34');

  const tooLong = new Headers({ 'X-AssetPilot-Device-Id': 'a'.repeat(100) });
  assert.equal(getAppDeviceIdFromHeaders(tooLong), 'a'.repeat(64));
});

test('一般物件形式的標頭（小寫鍵）也能解析', () => {
  const headers = {
    'user-agent': 'AssetPilotApp (iOS)',
    'x-assetpilot-device-id': DEVICE_ID,
  };
  assert.equal(getAppDeviceIdFromHeaders(headers), DEVICE_ID);
  assert.equal(
    describeDevice(getUserAgentFromHeaders(headers)),
    'AssetPilot App（iOS） · ID abcdef12',
  );
});

test('User-Agent 組合結果最長 400 字元', () => {
  const headers = new Headers({ 'User-Agent': 'a'.repeat(500) });
  assert.equal(getUserAgentFromHeaders(headers).length, 400);
});

test('裝置編號少於 6 碼時不顯示 ID 後綴', () => {
  assert.equal(
    describeDevice('AssetPilotApp (iOS) AssetPilotDeviceId/abc'),
    'AssetPilot App（iOS）',
  );
});

test('Dart 預設的 User-Agent 視為 AssetPilot App', () => {
  assert.equal(describeDevice('Dart/3.13 (dart:io)'), 'AssetPilot App');
});

test('瀏覽器 User-Agent 顯示作業系統與瀏覽器', () => {
  const iphoneSafari =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const windowsChrome =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  assert.equal(describeDevice(iphoneSafari), 'iPhone · Safari');
  assert.equal(describeDevice(windowsChrome), 'Windows · Chrome');
  assert.equal(describeDevice(`${windowsChrome} Edg/120.0.0.0`), 'Windows · Edge');
});

test('無法辨識或空白的 User-Agent 顯示「未知裝置」', () => {
  assert.equal(describeDevice('curl/8.0'), '未知裝置');
  assert.equal(describeDevice(''), '未知裝置');
  assert.equal(describeDevice('   '), '未知裝置');
  assert.equal(describeDevice(null), '未知裝置');
  assert.equal(describeDevice(undefined), '未知裝置');
});

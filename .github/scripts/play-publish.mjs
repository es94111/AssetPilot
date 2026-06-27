// Publish a single .aab to multiple Google Play tracks in ONE edit.
//
// Why a custom script instead of r0adkll/upload-google-play: that action only
// updates one track per invocation and commits the edit, so a second run with
// the same .aab fails with "Version code N has already been used." Google Play
// uploads a bundle once and then *assigns* its versionCode to tracks. This
// script does exactly that — upload once, assign to every TRACKS entry inside a
// single edit, then commit (which sends closed/open tracks for review).
//
// Required env:
//   PACKAGE_NAME   com.assetpilot.assetpilot
//   AAB_PATH       absolute path to app-release.aab
//   SA_JSON_PATH   path to the service-account JSON key file
//   TRACKS         comma-separated track ids, e.g. "internal,alpha"
//   WHATSNEW_DIR   dir holding whatsnew-<locale> files (optional release notes)

import { setDefaultResultOrder } from 'node:dns';
import { readFileSync, createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { google } from 'googleapis';

// 此 runner 連 googleapis 的 IPv6 路徑會在回應傳完前中斷（ERR_STREAM_PREMATURE_CLOSE）。
// 強制 DNS 先回 IPv4，讓 OAuth token 取得與 AAB 上傳走可用的 IPv4 路徑。
// 與工作流程中的 NODE_OPTIONS=--dns-result-order=ipv4first 互為備援。
try {
  setDefaultResultOrder('ipv4first');
} catch (_) {
  // 舊版 Node 可能不支援；交由 NODE_OPTIONS 處理。
}

const packageName = requireEnv('PACKAGE_NAME');
const aabPath = requireEnv('AAB_PATH');
const saPath = requireEnv('SA_JSON_PATH');
const tracks = requireEnv('TRACKS')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const whatsNewDir = process.env.WHATSNEW_DIR || '';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

// Play release-notes locales must match Play-supported codes (zh-TW, en-US).
function loadReleaseNotes() {
  if (!whatsNewDir) return [];
  const notes = [];
  for (const language of ['zh-TW', 'en-US']) {
    const file = join(whatsNewDir, `whatsnew-${language}`);
    if (existsSync(file)) {
      // Google Play rejects release notes longer than 500 chars per language;
      // trim() also drops the trailing newline that would otherwise count.
      let text = readFileSync(file, 'utf8').trim();
      if (text.length > 500) text = `${text.slice(0, 499)}…`;
      if (text) notes.push({ language, text });
    }
  }
  return notes;
}

// Google 的 OAuth token 端點偶發以 "Premature close" / ECONNRESET 中斷連線
// （googleapis 內建的 gaxios 重試對這類 no-response 網路錯誤只重試 2 次就放棄）。
// 這類錯誤發生在實際上傳之前，整個流程重跑是安全的：未 commit 的 edit 不會佔用
// versionCode。因此對「短暫網路錯誤」做指數退避重試，真正的設定/權限錯誤仍會直接失敗。
function isTransientError(err) {
  const code = String(err?.code || err?.error?.code || err?.cause?.code || '');
  const msg = String(err?.message || err?.error?.message || err || '');
  return (
    code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    /premature close|socket hang ?up|ECONNRESET|ETIMEDOUT|network|timeout/i.test(msg)
  );
}

async function withRetry(fn, { attempts = 4, baseDelayMs = 3000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !isTransientError(err)) throw err;
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `Play publish attempt ${attempt}/${attempts} failed with transient network error ` +
          `(${err?.code || err?.message}); retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

async function main() {
  const credentials = JSON.parse(readFileSync(saPath, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const publisher = google.androidpublisher({ version: 'v3', auth });

  const { data: edit } = await publisher.edits.insert({ packageName });
  const editId = edit.id;

  const { data: bundle } = await publisher.edits.bundles.upload({
    packageName,
    editId,
    media: {
      mimeType: 'application/octet-stream',
      body: createReadStream(aabPath),
    },
  });
  const versionCode = bundle.versionCode;
  console.log(`Uploaded bundle: versionCode=${versionCode}`);

  const releaseNotes = loadReleaseNotes();
  for (const track of tracks) {
    await publisher.edits.tracks.update({
      packageName,
      editId,
      track,
      requestBody: {
        releases: [
          {
            versionCodes: [String(versionCode)],
            status: 'completed',
            releaseNotes,
          },
        ],
      },
    });
    console.log(`Assigned versionCode=${versionCode} → track=${track}`);
  }

  // Default changesNotSentForReview=false → closed/open tracks are sent for
  // review on commit; internal testing publishes immediately.
  await publisher.edits.commit({ packageName, editId });
  console.log(`Committed edit ${editId} (sent for review).`);
}

withRetry(main).catch((err) => {
  console.error('Play publish failed:', err?.response?.data || err);
  process.exit(1);
});

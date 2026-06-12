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

import { readFileSync, createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { google } from 'googleapis';

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

main().catch((err) => {
  console.error('Play publish failed:', err?.response?.data || err);
  process.exit(1);
});

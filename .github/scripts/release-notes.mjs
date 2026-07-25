// Render GitHub Release title + body from changelog.json.
//
// 產出格式刻意比照既有 Release（例如 v4.94.0）：依 tag 分組成 `### 新增` 之類的
// 小標，每條變更一個 bullet，內容直接沿用 changelog.json 的使用者導向文案，
// 不再另外撰寫。這樣自動建立的 Release 與先前手動發的看起來一致。
//
// Env:
//   VERSION     要產出的版本（不含前綴 v）；預設取 changelog.currentVersion
//   NOTES_FILE  Markdown 內文寫出的路徑（必填）
//   CHANGELOG   changelog.json 路徑（預設 changelog.json）
//
// stdout：Release 標題（供工作流程以 $(...) 取用）。

import { readFileSync, writeFileSync } from 'node:fs';

// 與 .claude/skills/update-docs 定義的 tag 集合一致；順序即 Release 內文的區塊順序。
const TAG_LABELS = [
  ['warning', '升級需注意'],
  ['new', '新增'],
  ['improved', '改進'],
  ['fixed', '修正'],
  ['removed', '移除'],
];

const changelogPath = process.env.CHANGELOG || 'changelog.json';
const notesFile = process.env.NOTES_FILE;
if (!notesFile) {
  console.error('Missing required env: NOTES_FILE');
  process.exit(1);
}

const changelog = JSON.parse(readFileSync(changelogPath, 'utf8'));
const version = String(process.env.VERSION || changelog.currentVersion || '').trim();
if (!version) {
  console.error('無法決定版本：VERSION 未給且 changelog.currentVersion 為空');
  process.exit(1);
}

const release = (changelog.releases || []).find((r) => String(r?.version) === version);

// 找不到對應版本時仍要產出可用的 Release（例如有人直接推了新 tag 但 changelog
// 還沒補），只是內文退回一行通用說明。
const changes = (release?.changes || []).filter((c) => String(c?.text || '').trim());

const groups = new Map();
for (const change of changes) {
  const tag = String(change?.tag || '').trim() || '其他';
  if (!groups.has(tag)) groups.set(tag, []);
  groups.get(tag).push(String(change.text).trim());
}

// 已知 tag 依固定順序輸出；未知 tag 依出現順序接在後面，內容不會被丟掉。
const orderedTags = [
  ...TAG_LABELS.map(([tag]) => tag).filter((tag) => groups.has(tag)),
  ...[...groups.keys()].filter((tag) => !TAG_LABELS.some(([known]) => known === tag)),
];
const labelOf = (tag) => TAG_LABELS.find(([known]) => known === tag)?.[1] || tag;

const sections = orderedTags.map(
  (tag) => `### ${labelOf(tag)}\n${groups.get(tag).map((text) => `- ${text}`).join('\n')}`,
);
const body = sections.length ? sections.join('\n\n') : `AssetPilot v${version} 版本更新`;

writeFileSync(notesFile, `${body}\n`, 'utf8');

const title = release?.title ? `v${version} — ${String(release.title).trim()}` : `v${version}`;
console.log(title);

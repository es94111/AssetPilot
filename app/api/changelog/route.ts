// @ts-nocheck
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

let remoteChangelogCache = null;
let remoteChangelogCacheTime = 0;
const REMOTE_CHANGELOG_TTL = 30 * 60 * 1000;
const REMOTE_BRANCHES = ['main', 'dev'];

function parseVersion(v) {
  return String(v).split('.').map(n => parseInt(n) || 0);
}

function compareVersions(a, b) {
  const pa = parseVersion(a), pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchChangelogFromBranch(branch) {
  try {
    const rawUrl = `https://raw.githubusercontent.com/es94111/AssetPilot/${branch}/changelog.json`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(rawUrl, { signal: ctrl.signal });
    clearTimeout(t);
    if (resp.ok) return await resp.json();
  } catch (_) {}
  return null;
}

async function fetchRemoteChangelog(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && remoteChangelogCache && (now - remoteChangelogCacheTime) < REMOTE_CHANGELOG_TTL) {
    return remoteChangelogCache;
  }
  const results = await Promise.all(REMOTE_BRANCHES.map(b => fetchChangelogFromBranch(b)));
  const valid = results.filter(r => r && Array.isArray(r.releases));
  if (valid.length === 0) return null;
  const versionMap = new Map();
  let latestVersion = '0.0';
  valid.forEach(data => {
    (data.releases || []).forEach(r => versionMap.set(r.version, r));
    if (data.currentVersion && compareVersions(data.currentVersion, latestVersion) > 0) {
      latestVersion = data.currentVersion;
    }
  });
  const merged = {
    currentVersion: latestVersion,
    releases: Array.from(versionMap.values()).sort((a, b) => compareVersions(b.version, a.version)),
  };
  remoteChangelogCache = merged;
  remoteChangelogCacheTime = now;
  return merged;
}

function mergeChangelogs(local, remote) {
  if (!remote?.releases) return local;
  const versionMap = new Map();
  (local.releases || []).forEach(r => versionMap.set(r.version, r));
  (remote.releases || []).forEach(r => versionMap.set(r.version, r));
  const merged = Array.from(versionMap.values()).sort((a, b) => compareVersions(b.version, a.version));
  const latestVersion = merged[0]?.version || local.currentVersion || '0.0';
  const currentVersion = compareVersions(latestVersion, remote.currentVersion || '0.0') > 0 ? latestVersion : remote.currentVersion;
  return { currentVersion, releases: merged };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === '1';

  let local;
  try {
    local = JSON.parse(readFileSync(path.join(process.cwd(), 'changelog.json'), 'utf8'));
  } catch (_) {
    local = { currentVersion: '0.0', releases: [] };
  }

  const remote = await fetchRemoteChangelog(forceRefresh);
  const result = mergeChangelogs(local, remote);

  const response = NextResponse.json(result);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

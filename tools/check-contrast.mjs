#!/usr/bin/env node
// Warm Console 配色的 WCAG 對比驗證。
// 以 app/globals.css 的 token 值為單一來源，驗證亮/暗兩主題各組合 ≥ 4.5:1（AA 一般文字）。
// 手動執行：npm run check:contrast
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cssPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'globals.css');
const css = readFileSync(cssPath, 'utf8');

// ── parse :root and .dark-mode token blocks ──
function extractBlock(selector) {
  const idx = css.indexOf(selector);
  if (idx === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', idx);
  let depth = 1, i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') depth--;
    i++;
  }
  const body = css.slice(open + 1, i - 1);
  const vars = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const light = extractBlock(':root {');
const dark = { ...light, ...extractBlock('.dark-mode {') };

function resolve(value, vars) {
  let v = value.trim();
  const seen = new Set();
  while (v.startsWith('var(') && !seen.has(v)) {
    seen.add(v);
    const name = v.slice(4, v.indexOf(')')).trim();
    const fallback = v.includes(',') ? v.slice(v.indexOf(',') + 1, v.lastIndexOf(')')).trim() : null;
    v = vars[name] ?? fallback;
    if (v == null) return null;
  }
  return v;
}

function alphaOver(fg, alpha, bg) {
  // composite rgba fg over solid bg
  const m = fg.match(/rgba?\(([^)]+)\)/);
  if (!m || !fg.includes('/')) return fg;
  // handle "rgba(r, g, b, a)" already composited by caller below
  return fg;
}

function parseColor(value) {
  let v = value.trim();
  if (v.startsWith('#')) {
    let hex = v.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  }
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a = 1] = m[1].split(',').map(s => parseFloat(s));
    return { r, g, b, a: a ?? 1 };
  }
  return null;
}

function composite(fgValue, vars, baseVar) {
  let v = resolve(fgValue, vars);
  const color = parseColor(v);
  if (!color) return null;
  if (color.a === undefined || color.a >= 1) return { r: color.r, g: color.g, b: color.b };
  const bg = resolve(vars[baseVar], vars);
  const base = parseColor(bg);
  if (!base) return null;
  return {
    r: Math.round(color.r * color.a + base.r * (1 - color.a)),
    g: Math.round(color.g * color.a + base.g * (1 - color.a)),
    b: Math.round(color.b * color.a + base.b * (1 - color.a)),
  };
}

function luminance({ r, g, b }) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg, bg) {
  const l1 = luminance(fg), l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// ── real-world combinations ──
// fg 欄位以 '--token' 命名；直接給 hex（如白字）也可以。
const COMBOS = [
  ['text / surface',        '--text',           '--surface'],
  ['text / bg',             '--text',           '--bg'],
  ['text-secondary / surface', '--text-secondary', '--surface'],
  ['text-muted / surface',  '--text-muted',     '--surface'],
  ['income / surface',      '--income',         '--surface'],
  ['expense / surface',     '--expense',        '--surface'],
  ['net / surface',         '--net',            '--surface'],
  ['today-text / today-bg', '--today-text',     '--today-bg'],
  ['today-text / surface',  '--today-text',     '--surface'],
  ['primary / surface',     '--primary',        '--surface'],
  ['danger / danger-bg',    '--danger',         '--danger-bg'],
  ['income on income-bg',   '--income',         '--income-bg'],
  ['expense on expense-bg', '--expense',        '--expense-bg'],
  ['white on primary-solid', '#ffffff',         '--primary-solid'],
  ['white on danger-dark',  '#ffffff',          '--danger-dark'],
];

const PASS = 4.5;
let failures = 0;
let total = 0;

for (const [name, vars] of [['light', light], ['dark (warm night)', dark]]) {
  console.log(`\n── ${name} ──`);
  for (const [label, fgVar, bgVar] of COMBOS) {
    const fgValue = fgVar.startsWith('--') ? vars[fgVar] : fgVar;
    if (!fgValue || !vars[bgVar]) {
      console.log(`  ✗ ${label}: token missing (${fgVar} / ${bgVar})`);
      failures++; total++;
      continue;
    }
    const fg = composite(fgValue, vars, bgVar);
    const bg = composite(vars[bgVar], vars, bgVar);
    if (!fg || !bg) {
      console.log(`  ✗ ${label}: unparseable color`);
      failures++; total++;
      continue;
    }
    const ratio = contrast(fg, bg);
    total++;
    const ok = ratio >= PASS;
    if (!ok) failures++;
    console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(28)} ${ratio.toFixed(2)}:1${ok ? '' : `  (needs ${PASS})`}`);
  }
}

console.log(`\n${total - failures}/${total} combinations ≥ ${PASS}:1`);
process.exit(failures ? 1 : 0);
// tests/setup/resolve-hooks.mjs — Node ESM 自訂解析 hook，僅供 DB 整合測試使用
// 補齊 Next.js（webpack）建置時才會處理的兩種解析：
//   1. tsconfig.json 的 "@/*" 路徑別名
//   2. 省略副檔名的相對匯入（webpack 預設支援，Node 原生 ESM 解析器不支援）
// 不修改任何production程式碼；僅在 `node --import tests/setup/register.mjs` 測試執行時生效。
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CANDIDATE_SUFFIXES = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '/index.ts', '/index.js'];

function resolveWithExtension(basePathNoExt) {
  if (existsSync(basePathNoExt)) return basePathNoExt;
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = basePathNoExt + suffix;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (['next/server', 'next/headers', 'next/navigation'].includes(specifier)) {
    return nextResolve(`${specifier}.js`, context);
  }

  if (specifier.startsWith('@/')) {
    const abs = resolveWithExtension(path.join(rootDir, specifier.slice(2)));
    if (abs) return nextResolve(pathToFileURL(abs).href, context);
  }

  if (specifier.endsWith('.json')) {
    // Node 原生 ESM 需要 `with { type: 'json' }`，但 Next/webpack 的既有 JSON 匯入
    // 不帶屬性；測試時改由下面的 load hook 直接回傳解析結果。
    return { url: new URL(specifier, context.parentURL).href, shortCircuit: true, format: 'json' };
  }

  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
      const basePath = fileURLToPath(new URL(specifier, context.parentURL));
      const abs = resolveWithExtension(basePath);
      if (abs) return nextResolve(pathToFileURL(abs).href, context);
      throw err;
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    JSON.parse(source);
    return { format: 'json', source, shortCircuit: true };
  }
  return nextLoad(url, context);
}

// sharp 0.35 的 package.json "exports" 未在 bundler 解析模式下正確曝露型別宣告，
// 導致 `import('sharp')` 觸發 TS7016（找不到宣告檔）使 production build 失敗。
// 比照 adm-zip.d.ts / sql.js.d.ts，以 ambient 宣告作為後備（執行期型別正常）。
declare module 'sharp';

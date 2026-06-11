// Shared Material 3 (dark) style + icon helpers for AssetPilot Play Store
// screenshots. Tokens replicate ColorScheme.fromSeed(seedColor:#2563EB,
// brightness:dark) as used by mobile/lib/app.dart.

const CSS = `
:root{
  --surface:#111318;
  --surfaceLow:#191c20;
  --surfaceContainer:#1d2024;
  --surfaceContainerHigh:#282a2f;
  --surfaceContainerHighest:#32353a;
  --onSurface:#e2e2e9;
  --onSurfaceVariant:#c4c6cf;
  --outline:#8e9099;
  --outlineVariant:#3c3f44;
  --primary:#aec6ff;
  --onPrimary:#002e69;
  --primaryContainer:#284777;
  --onPrimaryContainer:#d8e2ff;
  --secondaryContainer:#3b4858;
  --errorContainer:#8c0009;
  --onErrorContainer:#ffdad6;
  --green:#4caf50;
  --red:#f44336;
  --amber:#ffc107;
  --orange:#ff9800;
  --plProfit:#e25b58;   /* 漲紅（dark 可讀化的 #D32F2F） */
  --plLoss:#5fae63;     /* 跌綠（dark 可讀化的 #2E7D32） */
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased;}
html,body{background:#000;}
.phone{
  width:432px;height:768px;background:var(--surface);color:var(--onSurface);
  font-family:"Roboto","Microsoft JhengHei","Noto Sans TC","PingFang TC",sans-serif;
  position:relative;overflow:hidden;display:flex;flex-direction:column;
}
/* ── status bar ── */
.statusbar{height:26px;flex:0 0 auto;display:flex;align-items:center;
  justify-content:space-between;padding:0 16px;font-size:12px;font-weight:600;
  color:var(--onSurface);}
.statusbar .right{display:flex;align-items:center;gap:5px;}
.sigbars{display:flex;align-items:flex-end;gap:1.5px;height:11px;}
.sigbars i{width:2.5px;background:var(--onSurface);border-radius:1px;}
.sigbars i:nth-child(1){height:4px}.sigbars i:nth-child(2){height:6px}
.sigbars i:nth-child(3){height:8px}.sigbars i:nth-child(4){height:11px}
.batt{width:20px;height:11px;border:1.4px solid var(--onSurface);border-radius:3px;
  position:relative;padding:1.4px;}
.batt::after{content:"";position:absolute;right:-3px;top:3px;width:2px;height:5px;
  background:var(--onSurface);border-radius:0 1px 1px 0;}
.batt span{display:block;height:100%;width:80%;background:var(--onSurface);border-radius:1px;}
/* ── app bar ── */
.appbar{height:56px;flex:0 0 auto;display:flex;align-items:center;padding:0 4px 0 16px;
  font-size:20px;font-weight:600;background:var(--surface);gap:4px;}
.appbar .title{flex:1;}
.appbar .actions{display:flex;align-items:center;gap:0;}
.subbar{flex:0 0 auto;background:var(--surface);}
.iconbtn{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;color:var(--onSurfaceVariant);}
/* ── content ── */
.content{flex:1 1 auto;overflow:hidden;}
.scroll{padding:16px;}
.sectiontitle{font-size:15px;font-weight:700;margin:0 0 8px;}
/* ── cards ── */
.card{background:var(--surfaceContainerLow,#1c1f23);border-radius:12px;}
.card.low{background:#1c1f23;}
.statcard{background:var(--surfaceContainerHighest);border-radius:12px;padding:16px;}
.statcard .lbl{font-size:12px;color:var(--onSurfaceVariant);}
.statcard .val{font-size:18px;font-weight:700;margin-top:4px;}
.assetcard{background:var(--primaryContainer);color:var(--onPrimaryContainer);
  border-radius:12px;padding:20px;}
.assetcard .lbl{font-size:14px;}
.assetcard .big{font-size:28px;font-weight:700;margin-top:4px;}
.hr{height:1px;background:rgba(216,226,255,.25);margin:18px 0;}
.assetcard .mini .l{font-size:12px;}
.assetcard .mini .v{font-size:16px;font-weight:700;}
/* ── list tile ── */
.tile{display:flex;align-items:center;gap:16px;padding:12px 16px;}
.tile .av{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;flex:0 0 auto;font-weight:700;font-size:14px;}
.tile .mid{flex:1;min-width:0;}
.tile .mid .t{font-size:15px;color:var(--onSurface);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
.tile .mid .s{font-size:12px;color:var(--onSurfaceVariant);margin-top:2px;}
.tile .tr{text-align:right;font-weight:700;font-size:15px;flex:0 0 auto;}
.tile .tr .sub{font-size:11px;font-weight:600;margin-top:2px;}
.divider{height:1px;background:var(--outlineVariant);}
.menutile{display:flex;align-items:center;gap:20px;padding:16px;}
.menutile .ic{color:var(--onSurfaceVariant);}
.menutile .lab{flex:1;font-size:16px;}
/* ── segmented button ── */
.segmented{display:flex;border:1px solid var(--outline);border-radius:20px;overflow:hidden;height:40px;}
.segmented .seg{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;
  font-size:13px;font-weight:600;color:var(--onSurface);border-right:1px solid var(--outline);}
.segmented .seg:last-child{border-right:none;}
.segmented .seg.on{background:var(--secondaryContainer);color:#dbe2f9;}
/* ── tabs ── */
.tabbar{display:flex;gap:0;border-bottom:1px solid var(--outlineVariant);background:var(--surface);}
.tabbar .tab{padding:14px 22px;font-size:14px;font-weight:600;color:var(--onSurfaceVariant);
  position:relative;}
.tabbar .tab.on{color:var(--primary);}
.tabbar .tab.on::after{content:"";position:absolute;left:14px;right:14px;bottom:0;height:3px;
  background:var(--primary);border-radius:3px 3px 0 0;}
/* ── FAB ── */
.fab{position:absolute;right:16px;bottom:92px;height:56px;border-radius:16px;
  background:var(--primaryContainer);color:var(--onPrimaryContainer);display:flex;
  align-items:center;gap:8px;padding:0 20px;font-size:15px;font-weight:600;
  box-shadow:0 3px 8px rgba(0,0,0,.45);}
/* ── bottom nav ── */
.bottomnav{height:80px;flex:0 0 auto;background:#1f2228;display:flex;
  align-items:center;justify-content:space-around;padding-bottom:6px;}
.navitem{display:flex;flex-direction:column;align-items:center;gap:4px;width:64px;}
.navitem .pill{width:64px;height:32px;border-radius:16px;display:flex;align-items:center;
  justify-content:center;color:var(--onSurfaceVariant);}
.navitem.on .pill{background:var(--secondaryContainer);color:#dbe2f9;}
.navitem .lbl{font-size:12px;color:var(--onSurfaceVariant);font-weight:500;}
.navitem.on .lbl{color:var(--onSurface);font-weight:700;}
/* ── budget / progress ── */
.bar{height:10px;border-radius:6px;overflow:hidden;}
.bar > i{display:block;height:100%;border-radius:6px;}
/* ── pie legend ── */
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:12px;}
.legend .it{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--onSurfaceVariant);}
.dot{width:12px;height:12px;border-radius:50%;flex:0 0 auto;}
.center{display:flex;align-items:center;justify-content:center;}
/* ── login ── */
.field{display:flex;align-items:center;gap:12px;border:1px solid var(--outline);
  border-radius:6px;padding:0 14px;height:56px;color:var(--onSurfaceVariant);
  font-size:15px;}
.field .ph{flex:1;color:var(--onSurfaceVariant);}
.filledbtn{height:52px;border-radius:26px;background:var(--primary);color:var(--onPrimary);
  display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;}
.outlinedbtn{height:50px;border-radius:25px;border:1px solid var(--outline);
  color:var(--primary);display:flex;align-items:center;justify-content:center;gap:10px;
  font-size:15px;font-weight:600;}
.svgicon{display:inline-flex;}
`;

const ICONS = {
  add:'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  chevron_left:'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  chevron_right:'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  north_east:'M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z',
  south_west:'M15 19v-2H8.41L20 5.41 18.59 4 7 15.59V9H5v10z',
  swap_horiz:'M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z',
  dashboard:'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  receipt_long:'M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14H3v3c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V2l-1.5 1.5zM15 20H6c-.55 0-1-.45-1-1v-1h10v2zm4-1c0 .55-.45 1-1 1s-1-.45-1-1v-2H8V4h11v15z',
  trending_up:'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
  menu:'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  account_balance_wallet:'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  lock:'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  email:'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  visibility:'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  bar_chart:'M5 9.2h3V19H5zM10.5 5h3v14h-3zm5.5 8H19v6h-3z',
  settings:'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  repeat:'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
  category:'M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z',
  savings:'M19.83 7.5l-2.27-2.27c.07-.42.18-.81.32-1.15.16-.4.39-.74.66-1.02L18 2.25c-.51.51-.92 1.13-1.2 1.84C16.18 4.03 15.61 4 15 4c-2.49 0-4.74.99-6.39 2.59l-2.05-2.05-1.41 1.41 1.95 1.95C6.43 8.62 6 9.76 6 11c0 .14.01.27.02.41C4.27 11.95 3 13.31 3 15v3c0 .55.45 1 1 1h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 1.66 1.34 3 3 3s3-1.34 3-3h1c.55 0 1-.45 1-1v-6.5c0-1.93-1.57-3.5-3.5-3.5h-.67zM18 12c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z',
  delete:'M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z',
  date_range:'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z',
  google:'M21.35 11.1h-9.18v2.96h5.27c-.23 1.48-1.7 4.35-5.27 4.35-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.8 3.6 14.7 2.7 12.17 2.7 7.03 2.7 2.87 6.86 2.87 12s4.16 9.3 9.3 9.3c5.37 0 8.92-3.78 8.92-9.1 0-.61-.07-1.08-.16-1.55z',
};

function icon(name, size = 24, color = 'currentColor') {
  const p = ICONS[name] || '';
  return `<span class="svgicon" style="width:${size}px;height:${size}px;color:${color}">`
    + `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="${p}"/></svg></span>`;
}

function statusbar() {
  return `<div class="statusbar"><div class="left">9:41</div>`
    + `<div class="right"><span class="sigbars"><i></i><i></i><i></i><i></i></span>`
    + `<span class="batt"><span></span></span></div></div>`;
}

// Build a donut pie via conic-gradient. segs:[{pct,color}]
function donut(segs, size, hole) {
  let acc = 0; const stops = [];
  for (const s of segs) { const a = acc, b = acc + s.pct; stops.push(`${s.color} ${a}% ${b}%`); acc = b; }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;`
    + `background:conic-gradient(${stops.join(',')});`
    + `-webkit-mask:radial-gradient(circle ${hole}px at center,transparent ${hole}px,#000 ${hole + 1}px);`
    + `mask:radial-gradient(circle ${hole}px at center,transparent ${hole}px,#000 ${hole + 1}px);"></div>`;
}

// Canvas dimensions (logical px) + render zoom. Default = phone (rendered at
// DSF 2.5). Tablet uses CSS `zoom` instead of device-scale-factor because Edge
// headless mis-rasterises tall pages under --force-device-scale-factor (a faint
// duplicated band appears); zoom + DSF 1 produces a single clean raster.
let DIM = { w: 432, h: 768, zoom: 1 };
function setDim(w, h, zoom = 1) { DIM = { w, h, zoom }; }

function page(bodyHtml) {
  const z = DIM.zoom !== 1 ? `body{zoom:${DIM.zoom};}` : '';
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">`
    + `<style>${CSS}${z}</style></head><body>`
    + `<div class="phone" style="width:${DIM.w}px;height:${DIM.h}px">${bodyHtml}</div>`
    + `</body></html>`;
}

module.exports = { CSS, ICONS, icon, statusbar, donut, page, setDim };

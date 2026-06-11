// Generates 8 AssetPilot Play Store screenshot HTML files (Material 3 dark).
// Layout, colours, copy and icons mirror mobile/lib/screens/*.dart.
// All data is fictional test data — no real PII / holdings.
const fs = require('fs');
const path = require('path');
const { icon, statusbar, donut, page, setDim } = require('./style');

// Form factor (arg 1):
//   phone    → 432x768  logical, DSF 2.5            → 1080x1920 PNG
//   tablet   → 576x1024 logical, zoom 2.5 (DSF 1)   → 1440x2560 PNG  (7")
//   tablet10 → 720x1280 logical, zoom 2.5 (DSF 1)   → 1800x3200 PNG  (10")
// The Flutter screens are single-column with no tablet-specific reflow, so each
// larger form factor is the same UI stretched onto a wider/taller canvas —
// matching how the real app looks on that device.
const FORM = (process.argv[2] || 'phone').toLowerCase();
const CFG = {
  phone:    { dir: 'screenshots',             w: 432, h: 768,  zoom: 1 },
  tablet:   { dir: 'screenshots-tablet-7in',  w: 576, h: 1024, zoom: 2.5 },
  tablet10: { dir: 'screenshots-tablet-10in', w: 720, h: 1280, zoom: 2.5 },
}[FORM] || { dir: 'screenshots', w: 432, h: 768, zoom: 1 };
const OUT = path.join(__dirname, '..', CFG.dir);
setDim(CFG.w, CFG.h, CFG.zoom);
fs.mkdirSync(OUT, { recursive: true });

// ── shared chrome ──────────────────────────────────────────────
function bottomNav(active) {
  const items = [
    ['dashboard', '首頁'],
    ['receipt_long', '記帳'],
    ['trending_up', '股票'],
    ['menu', '更多'],
  ];
  return `<div class="bottomnav">` + items.map(([ic, lb], i) => {
    const on = i === active ? ' on' : '';
    return `<div class="navitem${on}"><div class="pill">${icon(ic, 24)}</div>`
      + `<div class="lbl">${lb}</div></div>`;
  }).join('') + `</div>`;
}

function appbar(title, { center = false, actions = '', sub = '' } = {}) {
  const t = center
    ? `<div class="title" style="text-align:center;flex:1">${title}</div>`
    : `<div class="title">${title}</div>`;
  return `<div class="appbar">${t}<div class="actions">${actions}</div></div>` + sub;
}

function tile({ avBg, avFg, avContent, t, s, trMain, trMainColor, trSub, trSubColor }) {
  return `<div class="tile">`
    + `<div class="av" style="background:${avBg};color:${avFg}">${avContent}</div>`
    + `<div class="mid"><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`
    + (trMain != null
        ? `<div class="tr" style="color:${trMainColor || 'var(--onSurface)'}">${trMain}`
          + (trSub ? `<div class="sub" style="color:${trSubColor}">${trSub}</div>` : '')
          + `</div>`
        : '')
    + `</div>`;
}

const NT = v => 'NT$ ' + v.toLocaleString('en-US');

// ── 1. 登入 ────────────────────────────────────────────────────
function login() {
  const body = statusbar() + `
  <div class="content" style="display:flex;align-items:center;justify-content:center;padding:24px;">
    <div style="width:100%;max-width:360px;display:flex;flex-direction:column;">
      <div class="center">${icon('account_balance_wallet', 64, 'var(--primary)')}</div>
      <div style="text-align:center;font-size:28px;font-weight:700;margin-top:16px;">AssetPilot</div>
      <div style="text-align:center;font-size:14px;color:var(--onSurfaceVariant);margin-top:4px;">資產管理 · 安卓客戶端</div>
      <div style="height:32px"></div>
      <div class="field">${icon('email', 22, 'var(--onSurfaceVariant)')}<span class="ph">demo@assetpilot.app</span></div>
      <div style="height:16px"></div>
      <div class="field">${icon('lock', 22, 'var(--onSurfaceVariant)')}<span class="ph">••••••••</span>${icon('visibility', 22, 'var(--onSurfaceVariant)')}</div>
      <div style="height:24px"></div>
      <div class="filledbtn">登入</div>
      <div style="height:12px"></div>
      <div class="outlinedbtn">${icon('google', 18, 'var(--primary)')}使用 Google 登入</div>
      <div style="height:14px"></div>
      <div style="text-align:center;color:var(--primary);font-size:14px;font-weight:600;">還沒有帳號？註冊</div>
    </div>
  </div>`;
  return page(body);
}

// ── 2. 首頁 / 儀表板 ───────────────────────────────────────────
function dashboard() {
  const subbar = `<div class="subbar"><div style="display:flex;align-items:center;justify-content:center;gap:8px;padding-bottom:8px;">`
    + `${icon('chevron_left', 24, 'var(--onSurfaceVariant)')}<span style="font-size:16px;font-weight:600;">2026-06</span>${icon('chevron_right', 24, 'var(--onSurfaceVariant)')}</div></div>`;
  const pie = [
    { name: '飲食', total: 18200, color: '#ef5350', pct: 35 },
    { name: '居住', total: 12000, color: '#42a5f5', pct: 23 },
    { name: '交通', total: 6800, color: '#ffa726', pct: 13 },
    { name: '購物', total: 5400, color: '#ab47bc', pct: 10 },
    { name: '娛樂', total: 4200, color: '#26c6da', pct: 8 },
    { name: '其他', total: 5740, color: '#8d6e63', pct: 11 },
  ];
  const recents = [
    ['薪資', '2026-06-05', true, '+75,000'],
    ['餐飲', '2026-06-10', false, '-120'],
    ['居住', '2026-06-05', false, '-12,000'],
    ['交通', '2026-06-08', false, '-1,000'],
    ['購物', '2026-06-09', false, '-863'],
  ];
  const body = statusbar() + appbar('AssetPilot', { sub: subbar }) + `
  <div class="content"><div class="scroll">
    <div style="display:flex;gap:12px;">
      <div class="statcard" style="flex:1"><div class="lbl">收入</div><div class="val" style="color:var(--green)">${NT(78500)}</div></div>
      <div class="statcard" style="flex:1"><div class="lbl">支出</div><div class="val" style="color:var(--red)">${NT(52340)}</div></div>
    </div>
    <div style="height:16px"></div>
    <div class="assetcard">
      <div class="lbl">本月淨額</div><div class="big">+26,160</div>
      <div class="hr"></div>
      <div style="display:flex;">
        <div class="mini" style="flex:1"><div class="l">銀行餘額</div><div class="v">${NT(412580)}</div></div>
        <div class="mini" style="flex:1"><div class="l">股票市值</div><div class="v">${NT(386240)}</div></div>
      </div>
    </div>
    <div style="height:24px"></div>
    <div class="card low" style="padding:16px;">
      <div class="sectiontitle">支出分類</div>
      <div class="center" style="height:160px;">${donut(pie, 150, 38)}</div>
      <div class="legend">${pie.map(n => `<div class="it"><span class="dot" style="background:${n.color}"></span>${n.name}　${NT(n.total)}</div>`).join('')}</div>
    </div>
    <div style="height:24px"></div>
    <div class="sectiontitle">最近交易</div>
    ${recents.map(([c, d, inc, amt]) => tile({
      avBg: (inc ? 'rgba(76,175,80,.15)' : 'rgba(244,67,54,.15)'),
      avFg: inc ? 'var(--green)' : 'var(--red)',
      avContent: icon(inc ? 'south_west' : 'north_east', 18, inc ? 'var(--green)' : 'var(--red)'),
      t: c, s: d, trMain: amt, trMainColor: inc ? 'var(--green)' : 'var(--red)',
    })).join('')}
  </div></div>` + bottomNav(0);
  return page(body);
}

// ── 3. 記帳 ────────────────────────────────────────────────────
function transactions() {
  const seg = `<div class="subbar" style="padding:0 12px 8px;"><div class="segmented">`
    + `<div class="seg on">全部</div><div class="seg">收入</div><div class="seg">支出</div></div></div>`;
  const items = [
    ['薪資', '2026-06-05', 'income', '+75,000'],
    ['餐飲 › 午餐', '2026-06-10　便當', 'expense', '-120'],
    ['居住 › 房租', '2026-06-05', 'expense', '-12,000'],
    ['娛樂 › 訂閱', '2026-06-07　Netflix', 'expense', '-390'],
    ['交通 › 加油', '2026-06-08', 'expense', '-1,000'],
    ['轉帳', '2026-06-06', 'transfer', '5,000'],
    ['飲食 › 超市', '2026-06-09　週末採買', 'expense', '-863'],
    ['獎金', '2026-06-04　統一發票', 'income', '+200'],
  ];
  function row([t, s, type, amt]) {
    const inc = type === 'income', tr = type === 'transfer';
    const color = tr ? '#90a4ae' : (inc ? 'var(--green)' : 'var(--red)');
    const ic = tr ? 'swap_horiz' : (inc ? 'south_west' : 'north_east');
    const bg = tr ? 'rgba(144,164,174,.15)' : (inc ? 'rgba(76,175,80,.15)' : 'rgba(244,67,54,.15)');
    return tile({ avBg: bg, avFg: color, avContent: icon(ic, 20, color), t, s, trMain: amt, trMainColor: color });
  }
  const list = items.map((it, i) => row(it) + (i < items.length - 1 ? '<div class="divider"></div>' : '')).join('');
  const body = statusbar() + appbar('記帳', { sub: seg }) + `
  <div class="content"><div style="padding-top:4px">${list}</div></div>
  <div class="fab">${icon('add', 24, 'var(--onPrimaryContainer)')}記一筆</div>` + bottomNav(1);
  return page(body);
}

// ── 4. 股票（持股）─────────────────────────────────────────────
function stocksHoldings() {
  const tabs = `<div class="tabbar"><div class="tab on">持股</div><div class="tab">交易</div><div class="tab">股利</div><div class="tab">損益</div></div>`;
  const holdings = [
    ['2330', '台積電', 100, 580, 1005, 100500, '+42,500', '+73.3%'],
    ['2454', '聯發科', 50, 880, 1210, 60500, '+16,500', '+37.5%'],
    ['2317', '鴻海', 500, 105, 178, 89000, '+36,500', '+69.5%'],
    ['0050', '元大台灣50', 200, 142, 168, 33600, '+5,200', '+18.3%'],
  ];
  function hcard([sym, name, sh, avg, cur, mv, pl, rate]) {
    return `<div class="card low" style="margin-bottom:8px;padding:14px 16px;display:flex;align-items:center;gap:12px;">`
      + `<div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:700;">${sym} ${name}</div>`
      + `<div style="font-size:12px;color:var(--onSurfaceVariant);margin-top:3px;">${sh.toLocaleString()} 股・均價 ${avg}・現價 ${cur}</div></div>`
      + `<div style="text-align:right;"><div style="font-weight:700;">${NT(mv)}</div>`
      + `<div style="font-size:12px;color:var(--plProfit);margin-top:2px;">${pl} (${rate})</div></div></div>`;
  }
  const body = statusbar() + appbar('股票') + tabs + `
  <div class="content"><div class="scroll">
    <div class="assetcard">
      <div class="lbl">總市值</div><div class="big">${NT(386240)}</div>
      <div class="hr"></div>
      <div style="display:flex;">
        <div class="mini" style="flex:1"><div class="l">未實現損益</div><div class="v" style="color:var(--plProfit)">+100,700</div></div>
        <div class="mini" style="flex:1"><div class="l">報酬率</div><div class="v" style="color:var(--plProfit)">+35.27%</div></div>
      </div>
    </div>
    <div style="height:16px"></div>
    ${holdings.map(hcard).join('')}
  </div></div>
  <div class="fab">${icon('add', 24, 'var(--onPrimaryContainer)')}新增股票</div>` + bottomNav(2);
  return page(body);
}

// ── 5. 股票（已實現損益）───────────────────────────────────────
function stocksRealized() {
  const tabs = `<div class="tabbar"><div class="tab">持股</div><div class="tab">交易</div><div class="tab">股利</div><div class="tab on">損益</div></div>`;
  const rows = [
    ['2603', '長榮', '2026-05-12', 1000, '+58,200', '+41.6%'],
    ['3008', '大立光', '2026-04-28', 10, '+12,400', '+5.8%'],
    ['2412', '中華電', '2026-03-15', 300, '-3,150', '-3.1%'],
    ['1303', '南亞', '2026-02-20', 500, '+7,800', '+11.2%'],
  ];
  function row([sym, name, date, sh, pl, rate]) {
    const profit = pl.startsWith('+');
    const c = profit ? 'var(--plProfit)' : 'var(--plLoss)';
    return tile({ avBg: 'transparent', avFg: 'transparent', avContent: '',
      t: `${sym} ${name}`, s: `${date}・賣 ${sh.toLocaleString()} 股`,
      trMain: `${pl} (${rate})`, trMainColor: c });
  }
  const body = statusbar() + appbar('股票') + tabs + `
  <div class="content">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:var(--surfaceContainerHighest);">
      <div style="font-weight:700;font-size:15px;">已實現損益合計</div>
      <div style="font-weight:700;font-size:15px;color:var(--plProfit);">+75,250</div>
    </div>
    ${rows.map((r, i) => row(r) + (i < rows.length - 1 ? '<div class="divider"></div>' : '')).join('')}
  </div>` + bottomNav(2);
  return page(body);
}

// ── 6. 預算 ────────────────────────────────────────────────────
function budgets() {
  const actions = `${icon('chevron_left', 24, 'var(--onSurfaceVariant)')}<span style="font-size:15px;">2026-06</span>${icon('chevron_right', 24, 'var(--onSurfaceVariant)')}`;
  const data = [
    ['月度總預算', 38000, 50000, 0.76],
    ['餐飲', 9200, 10000, 0.92],
    ['購物', 6400, 5000, 1.28],
    ['交通', 2800, 4000, 0.70],
    ['娛樂', 1200, 3000, 0.40],
  ];
  function color(p) { return p >= 1 ? 'var(--red)' : p >= 0.9 ? 'var(--orange)' : p >= 0.7 ? 'var(--amber)' : 'var(--green)'; }
  function bcard([name, used, amt, p]) {
    const c = color(p);
    return `<div class="card low" style="margin-bottom:12px;padding:16px;">`
      + `<div style="display:flex;align-items:center;"><div style="flex:1;font-weight:700;font-size:15px;">${name}</div>`
      + `${icon('delete', 20, 'var(--onSurfaceVariant)')}</div>`
      + `<div style="height:8px"></div>`
      + `<div class="bar" style="background:${c.replace('var(--', 'rgba(0,0,0,0)')};"><div style="height:10px;border-radius:6px;background:rgba(255,255,255,.08);"><i style="display:block;height:10px;width:${Math.min(p * 100, 100)}%;border-radius:6px;background:${c};"></i></div></div>`
      + `<div style="height:6px"></div>`
      + `<div style="font-size:13px;color:var(--onSurface);">${NT(used)} / ${NT(amt)}　(${Math.round(p * 100)}%)</div></div>`;
  }
  const body = statusbar() + appbar('預算', { actions }) + `
  <div class="content"><div class="scroll" style="padding-top:8px">${data.map(bcard).join('')}</div></div>
  <div class="fab">${icon('add', 24, 'var(--onPrimaryContainer)')}新增預算</div>`;
  return page(body);
}

// ── 7. 統計報表 ────────────────────────────────────────────────
function reports() {
  const pie = [
    { name: '飲食', total: 18200, color: '#ef5350', pct: 35 },
    { name: '居住', total: 12000, color: '#42a5f5', pct: 23 },
    { name: '交通', total: 6800, color: '#ffa726', pct: 13 },
    { name: '購物', total: 5400, color: '#ab47bc', pct: 10 },
    { name: '娛樂', total: 4200, color: '#26c6da', pct: 8 },
    { name: '醫療', total: 3100, color: '#66bb6a', pct: 6 },
    { name: '其他', total: 2640, color: '#8d6e63', pct: 5 },
  ];
  const body = statusbar() + appbar('統計報表') + `
  <div class="content"><div class="scroll" style="padding-top:8px;">
    <div class="center"><div class="segmented" style="width:220px;"><div class="seg on">支出</div><div class="seg">收入</div></div></div>
    <div style="height:8px"></div>
    <div class="center"><div class="outlinedbtn" style="width:auto;padding:0 18px;height:42px;border-radius:21px;">${icon('date_range', 20, 'var(--primary)')}2026-06-01 ～ 2026-06-30</div></div>
    <div style="height:18px"></div>
    <div class="center" style="font-size:16px;font-weight:700;">總支出：${NT(52340)}</div>
    <div style="height:16px"></div>
    <div class="center" style="height:200px;">${donut(pie, 190, 50)}</div>
    <div style="height:16px"></div>
    ${pie.map(n => `<div class="tile" style="padding:8px 4px;"><span class="dot" style="width:16px;height:16px;background:${n.color};margin-right:12px;"></span><div class="mid"><div class="t">${n.name}</div></div><div class="tr">${NT(n.total)}</div></div>`).join('')}
  </div></div>`;
  return page(body);
}

// ── 8. 更多 ────────────────────────────────────────────────────
function more() {
  const items = [
    ['account_balance_wallet', '帳戶'],
    ['category', '分類'],
    ['savings', '預算'],
    ['repeat', '固定收支'],
    ['bar_chart', '統計報表'],
  ];
  function row([ic, lab]) {
    return `<div class="menutile"><span class="ic">${icon(ic, 24, 'var(--onSurfaceVariant)')}</span>`
      + `<span class="lab">${lab}</span>${icon('chevron_right', 24, 'var(--onSurfaceVariant)')}</div>`;
  }
  const body = statusbar() + appbar('更多') + `
  <div class="content"><div style="padding-top:4px;">
    ${items.map(row).join('')}
    <div class="divider" style="margin:8px 0;"></div>
    <div class="menutile"><span class="ic">${icon('settings', 24, 'var(--onSurfaceVariant)')}</span><span class="lab">設定</span>${icon('chevron_right', 24, 'var(--onSurfaceVariant)')}</div>
  </div></div>` + bottomNav(3);
  return page(body);
}

const screens = {
  '01-login': login(),
  '02-dashboard': dashboard(),
  '03-transactions': transactions(),
  '04-stocks-holdings': stocksHoldings(),
  '05-stocks-realized': stocksRealized(),
  '06-budgets': budgets(),
  '07-reports': reports(),
  '08-more': more(),
};

for (const [name, html] of Object.entries(screens)) {
  fs.writeFileSync(path.join(OUT, `${name}.html`), html, 'utf8');
  console.log('wrote', name + '.html');
}
console.log('done');

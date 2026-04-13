/* ====================================================================
   資產管理 - 主應用程式
   使用後端 API + SQLite 資料庫儲存 + JWT 認證
   ==================================================================== */

const App = (() => {
  // ─── 常數 ───
  const FREQ_LABELS = { daily: '每日', weekly: '每週', monthly: '每月', yearly: '每年' };

  // ─── Auth 狀態 ───
  let authToken = null; // Token 改由 httpOnly Cookie 管理，前端不儲存
  let currentUser = null;
  let latestLoginRecord = null;
  let googleUseCodeFlow = false;
  let authConfig = { registrationEnabled: true, publicRegistration: true, allowlistEnabled: false };
  let themeMode = localStorage.getItem('themeMode') || 'system';
  const prefersDarkMedia = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function getSystemPrefersDark() {
    // prefers-color-scheme 會優先反映瀏覽器主題偏好，無自訂時回退至作業系統偏好。
    return !!prefersDarkMedia?.matches;
  }

  function normalizeThemeMode(mode) {
    const v = String(mode || '').trim().toLowerCase();
    return (v === 'light' || v === 'dark' || v === 'system') ? v : 'system';
  }

  function applyThemeMode(mode, persist = true) {
    const nextMode = normalizeThemeMode(mode);
    const resolved = nextMode === 'system'
      ? (getSystemPrefersDark() ? 'dark' : 'light')
      : nextMode;

    themeMode = nextMode;
    document.body.classList.toggle('dark-mode', resolved === 'dark');
    document.body.classList.toggle('system-theme', nextMode === 'system');
    if (typeof Chart !== 'undefined') {
      Chart.defaults.color = resolved === 'dark' ? '#cbd5e1' : '#475569';
    }
    if (persist) {
      if (nextMode === 'system') localStorage.removeItem('themeMode');
      else localStorage.setItem('themeMode', nextMode);
    }
  }

  function handleSystemThemeChange() {
    if (themeMode !== 'system') return;
    applyThemeMode('system', false);
    updateThemeModeControls();
  }

  function updateThemeModeControls() {
    const controls = document.querySelectorAll('input[name="themeMode"]');
    controls.forEach(input => {
      input.checked = input.value === themeMode;
    });
  }

  function bindThemePreference() {
    if (!prefersDarkMedia) return;
    if (typeof prefersDarkMedia.addEventListener === 'function') {
      prefersDarkMedia.addEventListener('change', handleSystemThemeChange);
    } else if (typeof prefersDarkMedia.addListener === 'function') {
      prefersDarkMedia.addListener(handleSystemThemeChange);
    }
  }

  async function syncThemeModeFromServer() {
    const serverMode = normalizeThemeMode(currentUser?.themeMode);
    applyThemeMode(serverMode, true);
    updateThemeModeControls();
  }

  async function persistThemeModeToServer(mode) {
    if (!currentUser) return;
    const nextMode = normalizeThemeMode(mode);
    try {
      const result = await API.put('/api/account/theme', { themeMode: nextMode });
      if (currentUser) currentUser.themeMode = normalizeThemeMode(result?.themeMode || nextMode);
      return true;
    } catch (e) {
      if (currentUser) currentUser.themeMode = nextMode;
      return false;
    }
  }

  // ─── API 呼叫（Cookie 自動附送，無需手動帶 token）───
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  const FETCH_OPTS = { credentials: 'include' };

  const API = {
    async parseResponse(r) {
      const text = await r.text();
      const contentType = (r.headers.get('content-type') || '').toLowerCase();
      const isJson = contentType.includes('application/json');

      if (!text) return {};
      if (isJson) {
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error('伺服器回傳 JSON 格式錯誤，請稍後再試');
        }
      }

      // 常見於 API 路由不存在或後端尚未重啟時，會回傳 index.html
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        if (!r.ok) {
          throw new Error(`伺服器暫時異常（${r.status}），請稍後再試`);
        }
        throw new Error('伺服器回應格式異常，請稍後再試');
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('伺服器回應格式無法解析，請稍後再試');
      }
    },
    async get(url) {
      const r = await fetch(url, { ...FETCH_OPTS, headers: JSON_HEADERS });
      if (r.status === 401) { logout(); throw new Error('請先登入'); }
      const data = await this.parseResponse(r);
      if (!r.ok) {
        const err = new Error(data.error || `操作失敗 (${r.status})`);
        err.status = r.status;
        err.data = data;
        err.detail = data?.detail;
        throw err;
      }
      return data;
    },
    async post(url, body) {
      const r = await fetch(url, { ...FETCH_OPTS, method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
      const data = await this.parseResponse(r);
      if (r.status === 401) { logout(); throw new Error('請先登入'); }
      if (!r.ok) {
        const err = new Error(data.error || '操作失敗');
        err.status = r.status;
        err.data = data;
        throw err;
      }
      return data;
    },
    async put(url, body) {
      const r = await fetch(url, { ...FETCH_OPTS, method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) });
      const data = await this.parseResponse(r);
      if (r.status === 401) { logout(); throw new Error('請先登入'); }
      if (!r.ok) throw new Error(data.error || '操作失敗');
      return data;
    },
    async patch(url) {
      const r = await fetch(url, { ...FETCH_OPTS, method: 'PATCH', headers: JSON_HEADERS });
      if (r.status === 401) { logout(); throw new Error('請先登入'); }
      const data = await this.parseResponse(r);
      if (!r.ok) throw new Error(data.error || `操作失敗 (${r.status})`);
      return data;
    },
    async del(url) {
      const r = await fetch(url, { ...FETCH_OPTS, method: 'DELETE', headers: JSON_HEADERS });
      const data = await this.parseResponse(r);
      if (r.status === 401) { logout(); throw new Error('請先登入'); }
      if (!r.ok) throw new Error(data.error || '操作失敗');
      return data;
    },
  };

  // ─── 工具函式 ───
  const fmt = (n) => 'NT$ ' + Number(n).toLocaleString('zh-TW');
  const CURRENCY_LABELS = {
    // 亞太地區
    TWD: '新台幣', JPY: '日圓', CNY: '人民幣', HKD: '港幣', KRW: '韓元',
    SGD: '新加坡幣', THB: '泰銖', MYR: '馬來西亞幣', PHP: '菲律賓披索',
    IDR: '印尼盾', VND: '越南盾', INR: '印度盧比', AUD: '澳幣', NZD: '紐西蘭幣',
    MOP: '澳門幣', MMK: '緬甸元', KHR: '柬埔寨瑞爾', LAK: '寮國基普',
    BND: '汶萊幣', FJD: '斐濟幣', PGK: '巴布亞紐幾內亞基那',
    LKR: '斯里蘭卡盧比', PKR: '巴基斯坦盧比', BDT: '孟加拉塔卡',
    NPR: '尼泊爾盧比', MVR: '馬爾地夫拉菲亞', MNT: '蒙古圖格里克',
    KZT: '哈薩克坦吉', UZS: '烏茲別克索姆', KGS: '吉爾吉斯索姆',
    TJS: '塔吉克索莫尼', TMT: '土庫曼馬納特', AFN: '阿富汗尼',
    KPW: '北韓圓', WST: '薩摩亞塔拉', TOP: '東加潘加', SBD: '所羅門群島元',
    VUV: '萬那杜瓦圖', XPF: '太平洋法郎',
    // 歐洲
    EUR: '歐元', GBP: '英鎊', CHF: '瑞士法郎', SEK: '瑞典克朗',
    NOK: '挪威克朗', DKK: '丹麥克朗', PLN: '波蘭茲羅提', CZK: '捷克克朗',
    HUF: '匈牙利福林', RON: '羅馬尼亞列伊', BGN: '保加利亞列弗',
    HRK: '克羅埃西亞庫納', ISK: '冰島克朗', RSD: '塞爾維亞第納爾',
    UAH: '烏克蘭格里夫納', RUB: '俄羅斯盧布', TRY: '土耳其里拉',
    GEL: '喬治亞拉里', AMD: '亞美尼亞德拉姆', AZN: '亞塞拜然馬納特',
    ALL: '阿爾巴尼亞列克', MKD: '北馬其頓第納爾', BAM: '波赫可兌換馬克',
    MDL: '摩爾多瓦列伊', BYN: '白俄羅斯盧布',
    // 北美洲
    USD: '美元', CAD: '加幣', MXN: '墨西哥披索',
    GTQ: '瓜地馬拉格查爾', HNL: '宏都拉斯倫皮拉', NIO: '尼加拉瓜科多巴',
    CRC: '哥斯大黎加科朗', PAB: '巴拿馬巴波亞', BZD: '貝里斯幣',
    DOP: '多明尼加披索', JMD: '牙買加幣', TTD: '千里達幣',
    BSD: '巴哈馬幣', BBD: '巴貝多幣', HTG: '海地古德',
    CUP: '古巴披索', XCD: '東加勒比幣', AWG: '阿魯巴弗羅林',
    ANG: '荷屬安的列斯盾', KYD: '開曼群島幣', BMD: '百慕達幣',
    // 南美洲
    BRL: '巴西雷亞爾', ARS: '阿根廷披索', CLP: '智利披索',
    COP: '哥倫比亞披索', PEN: '秘魯索爾', UYU: '烏拉圭披索',
    VES: '委內瑞拉玻利瓦', BOB: '玻利維亞幣', PYG: '巴拉圭瓜拉尼',
    GYD: '蓋亞那幣', SRD: '蘇利南幣', FKP: '福克蘭群島鎊',
    // 中東地區
    SAR: '沙烏地里亞爾', AED: '阿聯酋迪拉姆', ILS: '以色列謝克爾',
    JOD: '約旦第納爾', KWD: '科威特第納爾', BHD: '巴林第納爾',
    OMR: '阿曼里亞爾', QAR: '卡達里亞爾', IQD: '伊拉克第納爾',
    IRR: '伊朗里亞爾', LBP: '黎巴嫩鎊', SYP: '敘利亞鎊', YER: '葉門里亞爾',
    // 非洲
    ZAR: '南非蘭特', EGP: '埃及鎊', NGN: '奈及利亞奈拉',
    KES: '肯亞先令', GHS: '迦納塞地', TZS: '坦尚尼亞先令',
    UGX: '烏干達先令', MAD: '摩洛哥迪拉姆', TND: '突尼西亞第納爾',
    DZD: '阿爾及利亞第納爾', LYD: '利比亞第納爾', ETB: '衣索比亞比爾',
    XOF: '西非法郎', XAF: '中非法郎', MUR: '模里西斯盧比',
    SCR: '塞席爾盧比', BWP: '波札那普拉', MZN: '莫三比克梅蒂卡爾',
    ZMW: '尚比亞克瓦查', RWF: '盧安達法郎', AOA: '安哥拉寬扎',
    CDF: '剛果法郎', SDG: '蘇丹鎊', SOS: '索馬利亞先令',
    DJF: '吉布地法郎', ERN: '厄利垂亞納克法', MWK: '馬拉威克瓦查',
    GMD: '甘比亞達拉西', SLL: '獅子山利昂', GNF: '幾內亞法郎',
    CVE: '維德角埃斯庫多', STN: '聖多美多布拉', BIF: '蒲隆地法郎',
    KMF: '葛摩法郎', LSL: '賴索托洛蒂', SZL: '史瓦帝尼里蘭吉尼',
    NAD: '納米比亞幣', MGA: '馬達加斯加阿里亞里', LRD: '賴比瑞亞幣',
    SHP: '聖乎勒拿鎊',
    // 特殊 / 貴金屬
    XAU: '黃金（盎司）', XAG: '白銀（盎司）', XDR: '特別提款權',
    BTC: '比特幣',
  };
  // 預設幣別清單 = CURRENCY_LABELS 全部（常用優先）
  const DEFAULT_CURRENCY_CODES = ['TWD', 'USD', 'JPY', 'EUR', 'HKD', 'CNY',
    ...Object.keys(CURRENCY_LABELS).filter(c => !['TWD','USD','JPY','EUR','HKD','CNY'].includes(c))];

  function normalizeCurrencyCode(code) {
    const c = String(code || 'TWD').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(c) ? c : 'TWD';
  }

  function parseCurrencyCodeInput(code) {
    const c = String(code || '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(c) ? c : '';
  }

  function getAvailableCurrencies(extra = []) {
    const set = new Set(DEFAULT_CURRENCY_CODES);
    Object.keys(cachedExchangeRates || {}).forEach(c => {
      const code = parseCurrencyCodeInput(c);
      if (code) set.add(code);
    });
    (cachedAccounts || []).forEach(a => {
      const code = parseCurrencyCodeInput(a.currency);
      if (code) set.add(code);
    });
    (extra || []).forEach(c => {
      const code = parseCurrencyCodeInput(c);
      if (code) set.add(code);
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (!list.includes('TWD')) list.unshift('TWD');
    return ['TWD', ...list.filter(c => c !== 'TWD')];
  }

  function currencyOptionLabel(code) {
    return CURRENCY_LABELS[code] ? `${code} ${CURRENCY_LABELS[code]}` : code;
  }

  function buildCurrencyOptionsHtml(selected, extra = []) {
    const s = normalizeCurrencyCode(selected);
    return getAvailableCurrencies([s, ...(extra || [])])
      .map(c => `<option value="${c}" ${c === s ? 'selected' : ''}>${currencyOptionLabel(c)}</option>`)
      .join('');
  }

  function renderCurrencySelectOptions(selectId, selected = 'TWD', extra = []) {
    const select = el(selectId);
    if (!select) return;
    const s = normalizeCurrencyCode(selected);
    select.innerHTML = buildCurrencyOptionsHtml(s, extra);
    select.value = s;
  }

  function refreshFxCurrencySuggestionList(extra = []) {
    const listEl = el('fxCurrencySuggestionList');
    if (!listEl) return;
    listEl.innerHTML = getAvailableCurrencies(extra)
      .map(c => `<option value="${c}"></option>`)
      .join('');
  }

  function normalizeAccountIcon(icon) {
    const value = String(icon || '').trim().toLowerCase();
    return /^fa-[a-z0-9-]{1,40}$/.test(value) ? value : 'fa-wallet';
  }

  function fmtByCurrency(n, currencyCode) {
    const c = normalizeCurrencyCode(currencyCode);
    return `${c} ${Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`;
  }

  function getRateToTwd(currencyCode) {
    const c = normalizeCurrencyCode(currencyCode);
    if (c === 'TWD') return 1;
    return Number(cachedExchangeRates[c]) > 0 ? Number(cachedExchangeRates[c]) : 1;
  }

  function calcTwdAmount(originalAmount, currencyCode, fxRate) {
    const amount = Number(originalAmount) || 0;
    const c = normalizeCurrencyCode(currencyCode);
    const rate = c === 'TWD' ? 1 : (Number(fxRate) > 0 ? Number(fxRate) : getRateToTwd(c));
    return Math.round(amount * rate * 100) / 100;
  }

  function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function localMonthStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function localDateTimeStr(input) {
    const d = input instanceof Date ? input : new Date(input);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }

  const today = () => localDateStr(new Date());
  const thisMonth = () => localMonthStr(new Date());
  const el = (id) => document.getElementById(id);

  // ─── 快取 ───
  let cachedCategories = [];
  let cachedAccounts = [];
  let accountTypeFilter = 'all';
  let cachedExchangeRates = { TWD: 1 };

  // ─── 狀態 ───
  let currentPage = 'dashboard';
  let charts = {};
  let deleteCallback = null;
  const DASH_DUAL_EXPENSE_KEY = 'dashDualPieExpense';
  const DASH_DUAL_ASSET_KEY = 'dashDualPieAsset';
  let dashDualPie = {
    expense: localStorage.getItem(DASH_DUAL_EXPENSE_KEY) === '1',
    asset: localStorage.getItem(DASH_DUAL_ASSET_KEY) === '1',
  };
  let dashboardDualBound = false;

  // ─── Auth 邏輯 ───
  function showAuthForm(formId) {
    // 清除錯誤訊息
    document.querySelectorAll('.auth-error').forEach(e => e.textContent = '');
    if (formId === 'registerForm' && !authConfig.registrationEnabled) {
      formId = 'loginForm';
      el('loginError').textContent = '目前未開放公開註冊，請聯絡管理員';
    }
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    el(formId).classList.add('active');
  }

  function updateRegisterEntryVisibility() {
    const enabled = !!authConfig.registrationEnabled;
    const showRegisterLink = el('showRegister');
    const showLoginLink = el('showLogin');
    const registerForm = el('registerForm');
    const registerWrap = el('googleSignUpWrap');
    if (showRegisterLink) showRegisterLink.style.display = enabled ? '' : 'none';
    if (showLoginLink) showLoginLink.textContent = enabled ? '已有帳號？返回登入' : '返回登入';
    if (registerWrap && !enabled) registerWrap.style.display = 'none';
    if (registerForm) {
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = !enabled;
    }
    if (!enabled && registerForm?.classList.contains('active')) {
      showAuthForm('loginForm');
    }
  }

  function showAuth() {
    el('publicHome').style.display = 'none';
    el('authContainer').classList.add('active');
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.mobile-header').style.display = 'none';
    document.querySelector('.main-content').style.display = 'none';
    el('fabBtn').style.display = 'none';
    showAuthForm('loginForm');
  }

  function showLoginPage(pushState = false) {
    showAuth();
    if (pushState && location.pathname !== '/login') {
      history.pushState({ publicPage: 'login' }, '', '/login');
    }
  }

  function showPublicHome(pushState = false) {
    el('publicHome').style.display = '';
    el('authContainer').classList.remove('active');
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.mobile-header').style.display = 'none';
    document.querySelector('.main-content').style.display = 'none';
    el('fabBtn').style.display = 'none';
    if (pushState && location.pathname !== '/') {
      history.pushState({ publicPage: 'home' }, '', '/');
    }
  }

  function hideAuth() {
    el('publicHome').style.display = 'none';
    el('authContainer').classList.remove('active');
    document.querySelector('.sidebar').style.display = '';
    document.querySelector('.mobile-header').style.display = '';
    document.querySelector('.main-content').style.display = '';
    updateFabForPage(currentPage);
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = el('loginEmail').value.trim();
    const password = el('loginPassword').value;
    el('loginError').textContent = '';

    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '登入失敗');

      currentUser = data.user;
      latestLoginRecord = data.currentLogin || null;
      el('loginForm').reset();
    } catch (err) {
      el('loginError').textContent = err.message;
      return;
    }
    // 登入已成功；enterApp() 的錯誤屬於登入後的資料載入失敗，不應被誤報為登入失敗。
    try {
      await enterApp();
    } catch (err) {
      el('loginError').textContent = err.message;
      toast('登入後載入資料失敗：' + err.message, 'error');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!authConfig.registrationEnabled) {
      el('registerError').textContent = '目前未開放公開註冊，請聯絡管理員';
      return;
    }
    const email = el('regEmail').value.trim();
    const displayName = el('regName').value.trim();
    const password = el('regPassword').value;
    const confirm = el('regPasswordConfirm').value;
    el('registerError').textContent = '';

    if (password.length < 8) {
      el('registerError').textContent = '密碼長度至少 8 字元';
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
      el('registerError').textContent = '密碼需包含大寫字母、小寫字母、數字與特殊符號';
      return;
    }
    if (password !== confirm) {
      el('registerError').textContent = '兩次密碼不一致';
      return;
    }

    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '註冊失敗');

      currentUser = data.user;
      el('registerForm').reset();
      await enterApp();
    } catch (err) {
      el('registerError').textContent = err.message;
    }
  }


  function logout() {
    currentUser = null;
    latestLoginRecord = null;
    cachedCategories = [];
    cachedAccounts = [];
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    showLoginPage(true);
  }

  function updateUserAvatar() {
    const avatarEl = el('userAvatar');
    const iconEl = el('userAvatarIcon');
    if (currentUser?.avatarUrl) {
      if (avatarEl) { avatarEl.src = currentUser.avatarUrl; avatarEl.style.display = ''; }
      if (iconEl) iconEl.style.display = 'none';
    } else {
      if (avatarEl) avatarEl.style.display = 'none';
      if (iconEl) iconEl.style.display = '';
    }
  }

  async function enterApp() {
    await syncThemeModeFromServer();
    // 設定使用者名稱與頭像
    el('userDisplayName').textContent = currentUser?.displayName || currentUser?.email || '';
    updateUserAvatar();
    hideAuth();
    // 載入快取（個別以 .catch 防護，避免單一端點失敗就阻擋後續導航）
    await API.post('/api/recurring/process', {}).catch(() => {});
    await API.post('/api/stock-recurring/process', {}).catch(() => {});
    let cacheLoadError = null;
    cachedCategories = await API.get('/api/categories').catch(err => {
      cacheLoadError = cacheLoadError || err;
      return [];
    });
    cachedAccounts = await API.get('/api/accounts').catch(err => {
      cacheLoadError = cacheLoadError || err;
      return [];
    });
    if (cacheLoadError) {
      toast('部分資料載入失敗：' + cacheLoadError.message, 'error');
    }
    // 載入版本號
    loadVersionLabel();
    // 根據目前 URL 導航
    const { page, sub } = parseRoute(location.pathname);
    if (page === 'home') {
      await navigate('dashboard', null);
      return;
    }
    await navigate(page, sub);
  }

  // ─── 初始化 ───
  async function init() {
    applyThemeMode(themeMode, false);
    bindThemePreference();
    bindNav();
    bindForms();
    bindFilters();
    bindMobile();
    bindAuth();

    // 若 URL 帶有 Google OAuth 授權碼，優先自動完成登入。
    if (!currentUser && await handleGoogleCodeFromUrl()) {
      return;
    }

    // 嘗試用 Cookie 恢復登入
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        currentUser = data.user;
        await enterApp();
        return;
      }
    } catch {}
    const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
    const isAppPath = path === '/login' || path === '/dashboard' || path === '/finance'
      || path.startsWith('/finance/') || path === '/transactions' || path === '/reports'
      || path === '/budget' || path === '/accounts' || path === '/stocks'
      || path.startsWith('/stocks/') || path === '/settings' || path.startsWith('/settings/')
      || path === '/api-credits';
    if (path === '/login' || isAppPath) {
      showLoginPage(false);
    } else {
      showPublicHome(false);
    }
  }

  // ─── Google SSO ───
  let googleClientId = null;
  let googleAuthInProgress = false;

  async function requestGoogleOAuthState() {
    const r = await fetch('/api/auth/google/state', { cache: 'no-store' });
    const data = await r.json();
    if (!r.ok || !data?.state) {
      throw new Error(data?.error || '無法取得 Google 登入狀態');
    }
    return String(data.state);
  }

  function setGoogleAuthInProgress(inProgress) {
    googleAuthInProgress = inProgress;
    const btnIds = ['googleSignInFallback', 'googleSignUpFallback'];
    btnIds.forEach(id => {
      const b = el(id);
      if (b) b.disabled = inProgress;
    });
  }

  async function initGoogleSSO() {
    try {
      const config = await (await fetch('/api/config')).json();
      authConfig = {
        registrationEnabled: !!config.registrationEnabled,
        publicRegistration: !!config.publicRegistration,
        allowlistEnabled: !!config.allowlistEnabled,
      };
      updateRegisterEntryVisibility();

      if (!config.googleClientId) return;
      googleClientId = config.googleClientId;
      googleUseCodeFlow = !!config.googleCodeFlow;

      // Google SSO 登入統一使用 Authorization Code Flow（Client ID + Client Secret）
      if (!googleUseCodeFlow) {
        console.warn('Google SSO 未完整設定：缺少 GOOGLE_CLIENT_SECRET，已停用 Google 登入');
        return;
      }

      showGoogleFallbackButtons();
      el('googleSignInWrap').style.display = '';
      el('altLoginWrap').style.display = '';
      el('googleSignUpWrap').style.display = '';
    } catch (e) {
      console.warn('Google SSO 初始化失敗:', e.message);
    }
  }

  function showGoogleFallbackButtons() {
    const fb1 = el('googleSignInFallback');
    const fb2 = el('googleSignUpFallback');
    if (fb1) { fb1.style.display = ''; el('googleSignInBtn').style.display = 'none'; }
    if (fb2) { fb2.style.display = ''; el('googleSignUpBtn').style.display = 'none'; }
  }

  function getGooglePopupErrorMessage(errType, elapsedMs) {
    if (errType === 'popup_failed_to_open') {
      return 'Google 登入視窗無法開啟，將改用重新導向模式';
    }
    if (errType === 'popup_closed' || errType === 'popup_closed_by_user') {
      if (elapsedMs < 1500) {
        return 'Google 授權視窗已開啟，請在該視窗完成登入';
      }
      return 'Google 登入流程未完成，請重新點擊 Google 登入';
    }
    return 'Google 登入流程中斷，請再試一次';
  }

  async function handleGoogleCodeFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const code = params.get('code');
      const state = params.get('state');
      if (!code) return false;

      // 不論成功失敗都先清除 OAuth 參數，避免卡在同一個 callback URL 無限重試。
      history.replaceState({}, document.title, location.pathname + location.hash);

      if (!state) {
        throw new Error('Google 登入狀態驗證失敗（state 不一致），請重新點擊 Google 登入');
      }

      setGoogleAuthInProgress(true);
      await handleGoogleCode(code, location.origin + '/', state);
      return true;
    } catch (e) {
      console.warn('處理 Google URL 授權碼失敗:', e);
      el('loginError').textContent = e.message || 'Google 登入失敗';
      setGoogleAuthInProgress(false);
      return false;
    }
  }

  // Google 登入：統一使用 Authorization Code Flow（GIS redirect）
  function googleFallbackLogin() {
    if (!googleClientId) { toast('Google SSO 未設定', 'error'); return; }
    if (!googleUseCodeFlow) { toast('Google SSO 需設定 Client Secret 才能使用', 'error'); return; }
    if (googleAuthInProgress) return;
    const redirectUri = location.origin + '/';

    const startGoogleRedirect = async () => {
      setGoogleAuthInProgress(true);
      let oauthState = '';
      try {
        oauthState = await requestGoogleOAuthState();
      } catch (e) {
        setGoogleAuthInProgress(false);
        const msg = e?.message || '無法啟動 Google 登入';
        el('loginError').textContent = msg;
        toast(msg, 'error');
        return;
      }

      if (window.google?.accounts?.oauth2) {
        try {
          const codeClient = google.accounts.oauth2.initCodeClient({
            client_id: googleClientId,
            scope: 'openid email profile',
            ux_mode: 'redirect',
            redirect_uri: redirectUri,
            state: oauthState,
            select_account: true,
            callback: () => {},
            error_callback: (err) => {
              const errType = err?.type || 'unknown_error';
              console.warn('GIS Code Client 錯誤:', errType, err);
              setGoogleAuthInProgress(false);
              const elapsedMs = 0;
              const msg = getGooglePopupErrorMessage(errType, elapsedMs);
              el('loginError').textContent = msg;
              const level = errType === 'popup_failed_to_open' ? 'error' : 'info';
              toast('Google 登入狀態（' + errType + '）：' + msg, level);
            },
          });
          el('loginError').textContent = '正在前往 Google 授權頁面...';
          codeClient.requestCode();
          return;
        } catch (e) {
          console.warn('GIS Code Client 啟動失敗:', e);
          setGoogleAuthInProgress(false);
          el('loginError').textContent = 'Google 登入元件初始化失敗，請稍後再試';
          toast('Google 登入失敗：GIS 初始化失敗', 'error');
          return;
        }
      }

      setGoogleAuthInProgress(false);
      el('loginError').textContent = 'Google 登入元件未載入，請檢查網路或重新整理頁面';
      toast('Google 登入失敗：GIS SDK 未載入', 'error');
    };

    startGoogleRedirect();
  }

  // Code Flow：將授權碼送到後端交換 token
  async function handleGoogleCode(code, redirectUri, state) {
    el('loginError').textContent = '';
    try {
      const r = await fetch('/api/auth/google', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: redirectUri, state }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Google 登入失敗');
      currentUser = data.user;
      latestLoginRecord = data.currentLogin || null;
    } catch (err) {
      el('loginError').textContent = err.message;
      toast('Google 登入失敗：' + err.message, 'error');
      setGoogleAuthInProgress(false);
      return;
    }
    // Google 授權已成功；enterApp() 的錯誤屬於登入後的資料載入失敗，
    // 不應被誤報為「Google 登入失敗」。
    try {
      await enterApp();
    } catch (err) {
      el('loginError').textContent = err.message;
      toast('登入後載入資料失敗：' + err.message, 'error');
    } finally {
      setGoogleAuthInProgress(false);
    }
  }

  async function handleGoogleCredential(response) {
    if (!response?.credential) return;
    // 已統一為 Authorization Code Flow，此舊 callback 僅保留提示，避免誤走 credential 登入。
    el('loginError').textContent = '請使用 Google 登入按鈕（OAuth 授權碼流程）';
    toast('Google 登入已改為 OAuth 授權碼流程，請重新點擊 Google 登入按鈕', 'error');
  }

  function bindAuth() {
    // 表單切換
    el('showRegister').addEventListener('click', e => {
      e.preventDefault();
      if (!authConfig.registrationEnabled) {
        el('loginError').textContent = '目前未開放公開註冊，請聯絡管理員';
        return;
      }
      showAuthForm('registerForm');
    });
    el('showLogin').addEventListener('click', e => { e.preventDefault(); showAuthForm('loginForm'); });
    el('goLoginBtn')?.addEventListener('click', e => {
      e.preventDefault();
      showLoginPage(true);
    });
    el('goRegisterBtn')?.addEventListener('click', e => {
      e.preventDefault();
      showLoginPage(true);
      if (authConfig.registrationEnabled) {
        showAuthForm('registerForm');
      } else {
        el('loginError').textContent = '目前未開放公開註冊，請聯絡管理員';
      }
    });

    // 表單提交
    el('loginForm').addEventListener('submit', handleLogin);
    el('registerForm').addEventListener('submit', handleRegister);

    // 登出 & 版本資訊
    el('logoutBtn').addEventListener('click', logout);
    el('changelogBtn').addEventListener('click', openChangelog);

    // Google SSO 初始化
    initGoogleSSO();
    // Passkey 按鈕初始化
    initPasskeyUI();
  }

  async function refreshCache() {
    const [categories, accounts, rateRes] = await Promise.all([
      API.get('/api/categories'),
      API.get('/api/accounts'),
      API.get('/api/exchange-rates'),
    ]);
    cachedCategories = categories;
    cachedAccounts = accounts;
    const map = { TWD: 1 };
    (rateRes?.rates || []).forEach(r => {
      const c = normalizeCurrencyCode(r.currency);
      const rate = Number(r.rateToTwd);
      if (rate > 0) map[c] = rate;
    });
    cachedExchangeRates = map;
    renderCurrencySelectOptions('txCurrency', el('txCurrency')?.value || 'TWD');
    renderCurrencySelectOptions('accCurrency', el('accCurrency')?.value || 'TWD');
    renderCurrencySelectOptions('recCurrency', el('recCurrency')?.value || 'TWD');
    refreshFxCurrencySuggestionList();
  }

  // ─── 導航 ───
  const validPages = ['dashboard', 'transactions', 'reports', 'budget', 'accounts', 'stocks', 'settings', 'api-credits'];
  const financePages = ['transactions', 'reports', 'budget', 'accounts', 'categories', 'recurring'];
  const validSettingsTabs = ['export', 'account', 'admin'];
  const validStocksTabs = ['portfolio', 'transactions', 'dividends', 'realized', 'settings'];

  function updateFabForPage(page) {
    const fab = el('fabBtn');
    if (!fab) return;

    if (financePages.includes(page)) {
      fab.style.display = '';
      fab.dataset.action = 'transaction';
      fab.title = '新增交易';
      fab.setAttribute('aria-label', '新增交易');
      return;
    }

    if (page === 'stocks') {
      fab.style.display = '';
      fab.dataset.action = 'stock-transaction';
      fab.title = '新增股票交易紀錄';
      fab.setAttribute('aria-label', '新增股票交易紀錄');
      return;
    }

    fab.style.display = 'none';
    fab.dataset.action = '';
    fab.title = '';
    fab.removeAttribute('aria-label');
  }

  function parseRoute(pathname) {
    const parts = (pathname || '/').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    let page = 'home';
    if (parts[0] === 'dashboard') {
      page = 'dashboard';
    } else if (parts[0] === 'finance') {
      page = financePages.includes(parts[1]) ? parts[1] : 'transactions';
    } else if (validPages.includes(parts[0])) {
      page = parts[0];
    }
    let sub = null;
    if (page === 'settings' && validSettingsTabs.includes(parts[1])) sub = parts[1];
    else if (page === 'stocks' && validStocksTabs.includes(parts[1])) sub = parts[1];
    return { page, sub };
  }

  function buildPath(page, sub) {
    if ((page === 'settings' || page === 'stocks') && sub) return '/' + page + '/' + sub;
    if (financePages.includes(page)) return '/finance/' + page;
    if (page === 'dashboard') return '/dashboard';
    return '/' + page;
  }

  async function navigate(page, sub, pushState = true) {
    // 若 page 是 settings 且沒指定 sub，預設 export
    if (page === 'settings' && !sub) sub = 'export';
    if (page === 'settings' && sub === 'admin' && !currentUser?.isAdmin) sub = 'export';
    // 若 page 是 stocks 且沒指定 sub，預設 portfolio
    if (page === 'stocks' && !sub) sub = 'portfolio';
    currentPage = page;
    updateFabForPage(page);
    const navPage = financePages.includes(page) ? 'finance' : page;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el('page-' + page)?.classList.add('active');
    document.querySelector(`.nav-item[data-page="${navPage}"]`)?.classList.add('active');
    if (financePages.includes(page)) {
      activateFinanceTab(page);
    }
    const titles = { dashboard: '儀表板', transactions: '收支管理', reports: '收支管理', budget: '收支管理', accounts: '收支管理', categories: '收支管理', recurring: '收支管理', stocks: '股票紀錄', settings: '設定', 'api-credits': 'API 使用與授權' };
    el('mobileTitle').textContent = titles[page] || '';
    el('sidebar').classList.remove('open');

    const path = buildPath(page, sub);
    if (pushState) history.pushState({ page, sub }, '', path);

    // 以 try/catch 包覆頁面渲染，單頁資料載入失敗不應阻斷整個導航
    try {
      await renderPage(page);
    } catch (err) {
      console.error('renderPage failed:', err);
      toast('頁面載入失敗：' + (err?.message || '未知錯誤'), 'error');
    }

    // 切換子分頁（需在 render 完成後執行）
    if (page === 'settings' && sub) {
      activateSettingsTab(sub);
    }
    if (page === 'stocks' && sub) {
      activateStocksTab(sub);
    }
  }

  function activateSettingsTab(tab) {
    document.querySelectorAll('.settings-tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    const tabEl = document.querySelector(`.settings-tabs .tab[data-settings="${tab}"]`);
    if (tabEl) tabEl.classList.add('active');
    el('panel-' + tab)?.classList.add('active');
  }

  function activateStocksTab(tab) {
    document.querySelectorAll('.stock-tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.stock-panel').forEach(p => p.classList.remove('active'));
    const tabEl = document.querySelector(`.stock-tabs .tab[data-stock-tab="${tab}"]`);
    if (tabEl) tabEl.classList.add('active');
    el('stockPanel-' + tab)?.classList.add('active');
  }

  function activateFinanceTab(tab) {
    document.querySelectorAll('.finance-tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll(`.finance-tabs .tab[data-finance-tab="${tab}"]`).forEach(t => t.classList.add('active'));
  }

  function bindNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page === 'finance') {
          navigate('transactions', null);
          return;
        }
        const sub = page === 'settings' ? 'export' : page === 'stocks' ? 'portfolio' : null;
        navigate(page, sub);
      });
    });
    document.querySelectorAll('.finance-tabs .tab').forEach(tab => {
      tab.addEventListener('click', e => {
        e.preventDefault();
        const page = tab.dataset.financeTab;
        if (financePages.includes(page)) navigate(page, null);
      });
    });
    window.addEventListener('popstate', (e) => {
      if (!currentUser) {
        const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
        const isAppPath = path === '/dashboard' || path === '/finance'
          || path.startsWith('/finance/') || path === '/transactions' || path === '/reports'
          || path === '/budget' || path === '/accounts' || path === '/stocks'
          || path.startsWith('/stocks/') || path === '/settings' || path.startsWith('/settings/')
          || path === '/api-credits';
        if (path === '/login' || isAppPath) showLoginPage(false);
        else showPublicHome(false);
        return;
      }
      const state = e.state;
      if (state?.page) {
        navigate(state.page, state.sub, false);
      } else {
        const { page, sub } = parseRoute(location.pathname);
        navigate(page, sub, false);
      }
    });
  }

  function bindMobile() {
    el('menuBtn').addEventListener('click', () => el('sidebar').classList.toggle('open'));
    document.addEventListener('click', e => {
      const sb = el('sidebar');
      if (sb.classList.contains('open') && !sb.contains(e.target) && e.target !== el('menuBtn') && !el('menuBtn').contains(e.target)) {
        sb.classList.remove('open');
      }
    });
  }

  // ─── 頁面渲染 ───
  async function renderPage(page) {
    switch (page) {
      case 'dashboard': await renderDashboard(); break;
      case 'transactions': await renderTransactions(); break;
      case 'reports': await renderReports(); break;
      case 'budget': await renderBudget(); break;
      case 'accounts': await renderAccounts(); break;
      case 'categories': await renderCategories(); break;
      case 'recurring': await renderRecurring(); break;
      case 'stocks': await renderStocks(); break;
      case 'settings': await renderSettings(); break;
      case 'api-credits': await renderApiCredits(); break;
    }
  }

  async function renderApiCredits() {
    // 靜態說明頁：API 來源與授權資訊在 index.html 維護。
  }

  // ─── 儀表板 ───
  async function renderDashboard() {
    bindDashboardDualPieControls();
    const expenseToggle = el('dashExpenseDualPie');
    const assetToggle = el('dashAssetDualPie');
    if (expenseToggle) expenseToggle.checked = !!dashDualPie.expense;
    if (assetToggle) assetToggle.checked = !!dashDualPie.asset;

    const data = await API.get('/api/dashboard');

    el('dashIncome').textContent = fmt(data.income);
    el('dashExpense').textContent = fmt(data.expense);
    el('dashNet').textContent = fmt(data.net);
    el('dashToday').textContent = fmt(data.todayExpense);

    await renderDashBudget(data.expense);
    renderDashPie(data.catBreakdown, !!dashDualPie.expense);
    await renderDashAssetAllocationPie(!!dashDualPie.asset);
    renderDashRecent(data.recent);
  }

  function bindDashboardDualPieControls() {
    if (dashboardDualBound) return;
    const expenseToggle = el('dashExpenseDualPie');
    const assetToggle = el('dashAssetDualPie');
    if (!expenseToggle || !assetToggle) return;

    expenseToggle.addEventListener('change', () => {
      dashDualPie.expense = !!expenseToggle.checked;
      if (dashDualPie.expense) localStorage.setItem(DASH_DUAL_EXPENSE_KEY, '1');
      else localStorage.removeItem(DASH_DUAL_EXPENSE_KEY);
      renderDashboard();
    });

    assetToggle.addEventListener('change', () => {
      dashDualPie.asset = !!assetToggle.checked;
      if (dashDualPie.asset) localStorage.setItem(DASH_DUAL_ASSET_KEY, '1');
      else localStorage.removeItem(DASH_DUAL_ASSET_KEY);
      renderDashboard();
    });

    dashboardDualBound = true;
  }

  async function renderDashBudget(totalExpense) {
    const budgets = await API.get('/api/budgets?yearMonth=' + thisMonth());
    const container = el('dashBudgetProgress');
    if (budgets.length === 0) {
      container.innerHTML = '<p class="empty-hint">尚未設定預算</p>';
      return;
    }
    let html = '';
    budgets.slice(0, 3).forEach(b => {
      const label = b.categoryId ? escHtml(getCat(b.categoryId)?.name || '未知') : '總預算';
      const used = b.used;
      const pct = Math.min((used / b.amount) * 100, 100);
      const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : '';
      html += `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px">
          <span>${label}</span><span>${fmt(used)} / ${fmt(b.amount)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
      </div>`;
    });
    container.innerHTML = html;
  }

  function renderDashPie(catBreakdown, useDualPie = false) {
    if (charts.dashPie) charts.dashPie.destroy();
    const ctx = el('dashPieChart').getContext('2d');
    const top5Container = el('dashExpenseTop5');
    if (top5Container) top5Container.innerHTML = '';
    if (!catBreakdown || catBreakdown.length === 0) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }

    if (useDualPie) {
      drawDashboardExpenseDualPie(ctx, catBreakdown);
      renderDashExpenseTop5(catBreakdown);
      return;
    }

    const sorted = buildSortedCategoryRows(catBreakdown);
    if (sorted.parentRows.length === 0) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }

    // 只用父分類
    const parentColorMap = new Map();
    sorted.parentRows.forEach((parent, idx) => {
      parentColorMap.set(parent.parentKey, buildParentAccentColor(parent.parentColor, idx, sorted.parentRows.length));
    });

    const labels = sorted.parentRows.map(r => r.parentName);
    const data = sorted.parentRows.map(r => r.total);
    const colors = sorted.parentRows.map(r => parentColorMap.get(r.parentKey) || '#94a3b8');

    charts.dashPie = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } } },
    });

    renderDashExpenseTop5(catBreakdown);
  }

  function renderDashExpenseTop5(catBreakdown) {
    const container = el('dashExpenseTop5');
    if (!container) return;

    const sorted = buildSortedCategoryRows(catBreakdown);
    const parentRows = sorted.parentRows;
    if (parentRows.length === 0) { container.innerHTML = ''; return; }

    const grandTotal = parentRows.reduce((s, r) => s + r.total, 0);
    const top5 = parentRows.slice(0, 5);

    let html = '<div class="dash-top5-group">';
    html += '<div class="dash-top5-title"><i class="fas fa-tags"></i>支出分類前 5 名</div>';
    html += '<ul class="dash-top5-list">';
    top5.forEach((row, idx) => {
      const pct = grandTotal > 0 ? ((row.total / grandTotal) * 100).toFixed(1) : '0.0';
      html += `<li>
        <span class="dash-top5-rank">${idx + 1}</span>
        <span class="dash-top5-name">${escHtml(row.parentName)}</span>
        <span class="dash-top5-value">${fmt(row.total)}<span class="dash-top5-pct">${pct}%</span></span>
      </li>`;
    });
    html += '</ul></div>';
    container.innerHTML = html;
  }

  async function renderDashAssetAllocationPie(useDualPie = false) {
    if (charts.dashAssetPie) charts.dashAssetPie.destroy();
    const canvas = el('dashAssetPieChart');
    if (!canvas) return;
    const assetTop5El = el('dashAssetTop5');
    if (assetTop5El) assetTop5El.innerHTML = '';

    const [accounts, stocks] = await Promise.all([
      API.get('/api/accounts'),
      API.get('/api/stocks'),
    ]);

    const labels = [];
    const values = [];
    const colors = [];
    const accountBase = '#0f766e';
    const stockBase = '#b45309';

    const ctx = canvas.getContext('2d');

    if (useDualPie) {
      drawDashboardAssetDualPie(ctx, accounts, stocks);
      renderDashAssetTop5(accounts, stocks);
      return;
    }

    const accountRows = (accounts || [])
      .filter(a => !a.exclude_from_total)
      .map(a => ({ label: String(a.name || '帳戶'), name: String(a.name || '帳戶'), total: Math.round(Number(a.balance) || 0) }))
      .filter(row => row.total > 0)
      .sort(sortByTotalThenNameDesc);
    const stockValue = (stocks || []).reduce((sum, s) => sum + (Number(s.marketValue) || 0), 0);

    const parentRows = [];
    if (accountRows.length > 0) parentRows.push({ key: 'account', name: '帳戶資產', total: accountRows.reduce((s, x) => s + x.total, 0), color: accountBase });
    if (stockValue > 0) parentRows.push({ key: 'stock', name: '股票資產', total: Math.round(stockValue), color: stockBase });
    parentRows.sort(sortByTotalThenNameDesc);

    parentRows.forEach(parent => {
      if (parent.key === 'account') {
        accountRows.forEach((row, idx) => {
          labels.push(row.label);
          values.push(row.total);
          colors.push(buildChildVariantColor(accountBase, idx, Math.max(accountRows.length, 1)));
        });
      } else {
        labels.push('股票市值');
        values.push(parent.total);
        colors.push(buildChildVariantColor(stockBase, 0, 1));
      }
    });

    if (values.length === 0) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }

    const totalValue = values.reduce((sum, v) => sum + v, 0);
    const formatLegendText = (label, value) => {
      const pct = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0';
      return `${label} ${fmt(value)} (${pct}%)`;
    };

    charts.dashAssetPie = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10,
              generateLabels(chart) {
                const ds = chart.data.datasets[0] || { data: [], backgroundColor: [] };
                return (chart.data.labels || []).map((label, i) => {
                  const value = Number(ds.data[i]) || 0;
                  const bg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;
                  return {
                    text: formatLegendText(String(label || ''), value),
                    fillStyle: bg,
                    strokeStyle: bg,
                    lineWidth: 0,
                    hidden: !chart.getDataVisibility(i),
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const label = context.label || '';
                const value = Number(context.raw) || 0;
                return formatLegendText(label, value);
              },
            },
          },
        },
      },
    });

    renderDashAssetTop5(accounts, stocks);
  }

  function renderDashAssetTop5(accounts, stocks) {
    const container = el('dashAssetTop5');
    if (!container) return;

    const accountRows = (accounts || [])
      .filter(a => !a.exclude_from_total)
      .map(a => ({ name: String(a.name || '帳戶'), total: Math.round(Number(a.balance) || 0) }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);

    const stockRows = (stocks || [])
      .map(s => {
        const code = String(s.code || '').trim();
        const name = String(s.name || '').trim();
        const label = code && name && code !== name ? `${code} ${name}` : (name || code || '股票');
        return { name: label, total: Math.round(Number(s.marketValue) || 0) };
      })
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);

    if (stockRows.length === 0 && accountRows.length === 0) {
      container.innerHTML = '';
      return;
    }

    let html = '<div class="dash-top5-columns">';

    // 持股前 5 名
    if (stockRows.length > 0) {
      const top5Stocks = stockRows.slice(0, 5);
      const stockTotal = stockRows.reduce((s, r) => s + r.total, 0);
      html += '<div class="dash-top5-group">';
      html += '<div class="dash-top5-title"><i class="fas fa-chart-line"></i>持股前 5 名</div>';
      html += '<ul class="dash-top5-list">';
      top5Stocks.forEach((row, idx) => {
        const pct = stockTotal > 0 ? ((row.total / stockTotal) * 100).toFixed(1) : '0.0';
        html += `<li>
          <span class="dash-top5-rank">${idx + 1}</span>
          <span class="dash-top5-name">${escHtml(row.name)}</span>
          <span class="dash-top5-value">${fmt(row.total)}<span class="dash-top5-pct">${pct}%</span></span>
        </li>`;
      });
      html += '</ul></div>';
    }

    // 帳戶前 5 名
    if (accountRows.length > 0) {
      const top5Accounts = accountRows.slice(0, 5);
      const accountTotal = accountRows.reduce((s, r) => s + r.total, 0);
      html += '<div class="dash-top5-group">';
      html += '<div class="dash-top5-title"><i class="fas fa-landmark"></i>帳戶前 5 名</div>';
      html += '<ul class="dash-top5-list">';
      top5Accounts.forEach((row, idx) => {
        const pct = accountTotal > 0 ? ((row.total / accountTotal) * 100).toFixed(1) : '0.0';
        html += `<li>
          <span class="dash-top5-rank">${idx + 1}</span>
          <span class="dash-top5-name">${escHtml(row.name)}</span>
          <span class="dash-top5-value">${fmt(row.total)}<span class="dash-top5-pct">${pct}%</span></span>
        </li>`;
      });
      html += '</ul></div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function renderDashRecent(recent) {
    const container = el('dashRecentList');
    if (!recent || recent.length === 0) {
      container.innerHTML = '<p class="empty-hint">尚無交易記錄</p>';
      return;
    }
    let html = '<ul class="recent-list">';
    recent.forEach(t => {
      const catName = t.cat_name || '未分類';
      const catColor = /^#[0-9a-fA-F]{3,8}$/.test(t.cat_color) ? t.cat_color : '#94a3b8';
      const amountCls = t.type === 'income' ? 'amount-income' : 'amount-expense';
      const prefix = t.type === 'income' ? '+' : '-';
      html += `<li class="recent-item">
        <div class="recent-item-left">
          <div class="recent-category" style="background:${catColor}">${escHtml(catName[0])}</div>
          <div class="recent-item-info">
            <div class="recent-cat">${escHtml(catName)}</div>
            <div class="recent-date">${t.date}${t.note ? ' · ' + escHtml(t.note) : ''}</div>
          </div>
        </div>
        <span class="${amountCls}">${prefix} ${fmt(t.amount)}</span>
      </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
  }

  // ─── 交易記錄 ───
  async function renderTransactions() {
    populateFilterSelects();
    await applyFilters();
  }

  function populateFilterSelects() {
    const cats = cachedCategories.filter(c => !c.isHidden);
    let catHtml = '<option value="all">全部</option>';
    const parents = cats.filter(c => !c.parentId);
    parents.forEach(p => {
      const children = cats.filter(c => c.parentId === p.id);
      if (children.length > 0) {
        catHtml += `<optgroup label="${escHtml(p.name)}">`;
        children.forEach(c => { catHtml += `<option value="${c.id}">${escHtml(c.name)}</option>`; });
        catHtml += '</optgroup>';
      } else {
        catHtml += `<option value="${p.id}">${escHtml(p.name)}</option>`;
      }
    });
    el('filterCategory').innerHTML = catHtml;

    let accHtml = '<option value="all">全部</option>';
    cachedAccounts.forEach(a => accHtml += `<option value="${a.id}">${escHtml(a.name)}</option>`);
    el('filterAccount').innerHTML = accHtml;
  }

  async function applyFilters(page) {
    const params = new URLSearchParams();
    const dateFrom = el('filterDateFrom').value;
    const dateTo = el('filterDateTo').value;
    const type = el('filterType').value;
    const catId = el('filterCategory').value;
    const accId = el('filterAccount').value;
    const keyword = el('filterKeyword').value.trim();

    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (type !== 'all') params.set('type', type);
    if (catId !== 'all') params.set('categoryId', catId);
    if (accId !== 'all') params.set('accountId', accId);
    if (keyword) params.set('keyword', keyword);
    params.set('page', page || 1);
    const psVal = el('filterPageSize').value;
    params.set('limit', psVal === 'custom' ? (parseInt(el('filterPageSizeCustom').value) || 20) : psVal);

    const result = await API.get('/api/transactions?' + params.toString());
    renderTransactionTable(result);
  }

  // ─── 多選狀態 ───
  let selectedTxIds = new Set();

  function updateBatchBar() {
    const count = selectedTxIds.size;
    el('batchBar').style.display = count > 0 ? '' : 'none';
    el('batchCount').textContent = `已選 ${count} 筆`;
    // 更新全選 checkbox 狀態
    const allCheckbox = el('selectAllTx');
    const checkboxes = document.querySelectorAll('.tx-checkbox');
    if (checkboxes.length > 0 && count === checkboxes.length) {
      allCheckbox.checked = true;
      allCheckbox.indeterminate = false;
    } else if (count > 0) {
      allCheckbox.checked = false;
      allCheckbox.indeterminate = true;
    } else {
      allCheckbox.checked = false;
      allCheckbox.indeterminate = false;
    }
  }

  function clearSelection() {
    selectedTxIds.clear();
    document.querySelectorAll('.tx-checkbox').forEach(cb => cb.checked = false);
    updateBatchBar();
  }

  function renderTransactionTable(result) {
    const { data: txs, total, page: pageNum, totalPages } = result;
    selectedTxIds.clear();
    updateBatchBar();
    const todayStrValue = today();

    const tbody = el('transactionBody');
    if (txs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-hint">沒有交易記錄</td></tr>';
    } else {
      tbody.innerHTML = txs.map(t => {
        const cat = getCat(t.categoryId || t.category_id);
        const acc = getAcc(t.accountId || t.account_id);
        const isFutureTx = (t.date || '') > todayStrValue;
        const futureBadge = isFutureTx ? '<span class="tx-schedule-badge">未來</span>' : '';
        const excludeBadge = t.excludeFromStats ? '<span class="tx-exclude-badge">不統計</span>' : '';
        let typeBadge, amountCls;
        if (t.type === 'income') {
          typeBadge = '<span class="type-badge income">收入</span>';
          amountCls = 'amount-income';
        } else if (t.type === 'transfer_out') {
          typeBadge = '<span class="type-badge transfer">轉出</span>';
          amountCls = 'amount-transfer';
        } else if (t.type === 'transfer_in') {
          typeBadge = '<span class="type-badge transfer">轉入</span>';
          amountCls = 'amount-transfer';
        } else {
          typeBadge = '<span class="type-badge expense">支出</span>';
          amountCls = 'amount-expense';
        }
        return `<tr data-txid="${t.id}">
          <td class="td-check"><input type="checkbox" class="tx-checkbox" data-id="${t.id}" onchange="App.toggleTxSelect('${t.id}', this.checked)"></td>
          <td>${t.date}</td>
          <td>${typeBadge}${futureBadge}${excludeBadge}</td>
          <td>${getCatDisplayName(cat)}</td>
          <td class="${amountCls}">
            ${fmt(t.amount)}
            ${normalizeCurrencyCode(t.currency) !== 'TWD' ? `<div class="tx-original-amount">${fmtByCurrency(t.originalAmount, t.currency)}</div>` : ''}
          </td>
          <td>${acc ? escHtml(acc.name) : '-'}</td>
          <td>${escHtml(t.note || '')}</td>
          <td>
            <button class="btn-icon" onclick="App.editTransaction('${t.id}')" title="編輯"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" onclick="App.deleteTransaction('${t.id}')" title="刪除"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('');
    }

    // pagination
    const pag = el('transactionPagination');
    if (totalPages <= 1) { pag.innerHTML = ''; return; }
    let ph = `<button ${pageNum <= 1 ? 'disabled' : ''} onclick="App.txGoPage(${pageNum - 1})"><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7) {
        if (i === 1 || i === totalPages || (i >= pageNum - 1 && i <= pageNum + 1)) {
          ph += `<button class="${i === pageNum ? 'active' : ''}" onclick="App.txGoPage(${i})">${i}</button>`;
        } else if (i === pageNum - 2 || i === pageNum + 2) {
          ph += `<button disabled>...</button>`;
        }
      } else {
        ph += `<button class="${i === pageNum ? 'active' : ''}" onclick="App.txGoPage(${i})">${i}</button>`;
      }
    }
    ph += `<button ${pageNum >= totalPages ? 'disabled' : ''} onclick="App.txGoPage(${pageNum + 1})"><i class="fas fa-chevron-right"></i></button>`;
    pag.innerHTML = ph;
  }

  function bindFilters() {
    el('filterBtn').addEventListener('click', () => applyFilters(1));
    el('filterResetBtn').addEventListener('click', () => {
      el('filterDateFrom').value = '';
      el('filterDateTo').value = '';
      el('filterType').value = 'all';
      el('filterCategory').value = 'all';
      el('filterAccount').value = 'all';
      el('filterKeyword').value = '';
      el('filterPageSize').value = '20';
      el('filterPageSizeCustom').style.display = 'none';
      el('filterPageSizeCustom').value = '';
      applyFilters(1);
    });
    el('filterPageSize').addEventListener('change', () => {
      const isCustom = el('filterPageSize').value === 'custom';
      el('filterPageSizeCustom').style.display = isCustom ? '' : 'none';
      if (!isCustom) applyFilters(1);
      else el('filterPageSizeCustom').focus();
    });
    el('filterPageSizeCustom').addEventListener('change', () => applyFilters(1));
    el('filterPageSizeCustom').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyFilters(1); }
    });

    // 全選 checkbox
    el('selectAllTx').addEventListener('change', (e) => {
      const checked = e.target.checked;
      document.querySelectorAll('.tx-checkbox').forEach(cb => {
        cb.checked = checked;
        const id = cb.dataset.id;
        if (checked) selectedTxIds.add(id); else selectedTxIds.delete(id);
      });
      updateBatchBar();
    });

    // 批次操作按鈕
    el('batchDeleteBtn').addEventListener('click', batchDelete);
    el('batchChangeCatBtn').addEventListener('click', () => openBatchChangeModal('category'));
    el('batchChangeAccBtn').addEventListener('click', () => openBatchChangeModal('account'));
    el('batchChangeDateBtn').addEventListener('click', () => openBatchChangeModal('date'));
    el('batchCancelBtn').addEventListener('click', clearSelection);

    // 批次變更表單
    el('batchChangeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const field = el('batchField').value;
      const ids = [...selectedTxIds];
      let fields = {};
      if (field === 'category') fields.categoryId = el('batchCategory').value;
      else if (field === 'account') fields.accountId = el('batchAccount').value;
      else if (field === 'date') fields.date = el('batchDate').value;
      if (Object.values(fields).some(v => !v)) { toast('請選擇要變更的值', 'error'); return; }
      try {
        const result = await API.post('/api/transactions/batch-update', { ids, fields });
        closeModal('modalBatchChange');
        toast(`已更新 ${result.updated} 筆交易`, 'success');
        clearSelection();
        await renderPage(currentPage);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function toggleTxSelect(id, checked) {
    if (checked) selectedTxIds.add(id); else selectedTxIds.delete(id);
    updateBatchBar();
  }

  function batchDelete() {
    const count = selectedTxIds.size;
    confirmDelete(`確定要刪除所選的 ${count} 筆交易記錄嗎？此操作無法復原。`, async () => {
      try {
        const result = await API.post('/api/transactions/batch-delete', { ids: [...selectedTxIds] });
        toast(`已刪除 ${result.deleted} 筆交易`, 'success');
        clearSelection();
        await renderPage(currentPage);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function openBatchChangeModal(field) {
    el('batchField').value = field;
    el('batchCatRow').style.display = 'none';
    el('batchAccRow').style.display = 'none';
    el('batchDateRow').style.display = 'none';
    if (field === 'category') {
      el('batchChangeTitle').textContent = `批次變更分類（${selectedTxIds.size} 筆）`;
      buildBatchCatPicker();
      el('batchCatRow').style.display = '';
    } else if (field === 'account') {
      el('batchChangeTitle').textContent = `批次變更帳戶（${selectedTxIds.size} 筆）`;
      el('batchAccount').innerHTML = cachedAccounts.map(a => `<option value="${a.id}">${escHtml(a.name)}</option>`).join('');
      el('batchAccRow').style.display = '';
    } else if (field === 'date') {
      el('batchChangeTitle').textContent = `批次變更日期（${selectedTxIds.size} 筆）`;
      el('batchDate').value = today();
      el('batchDateRow').style.display = '';
    }
    openModal('modalBatchChange');
  }

  function buildBatchCatPicker() {
    const dropdown = el('batchCatDropdown');
    const trigger = el('batchCatTrigger');
    const hiddenInput = el('batchCategory');
    const dotEl = el('batchCatDot');
    const labelEl = el('batchCatLabel');

    // 建構下拉內容
    let html = '';
    ['expense', 'income'].forEach(type => {
      html += `<div class="batch-cat-section">${type === 'expense' ? '支出' : '收入'}</div>`;
      const cats = cachedCategories.filter(c => c.type === type && !c.isHidden);
      const parents = cats.filter(c => !c.parentId);
      parents.forEach(p => {
        const children = cats.filter(c => c.parentId === p.id);
        if (children.length > 0) {
          html += `<div class="batch-cat-group-label"><span class="batch-cat-color" style="background:${/^#[0-9a-fA-F]{3,8}$/.test(p.color) ? p.color : '#ccc'}"></span>${escHtml(p.name)}</div>`;
          children.forEach(c => {
            html += `<div class="batch-cat-item" data-id="${c.id}" data-color="${escHtml(c.color)}" data-name="${escHtml(c.name)}"><span class="batch-cat-color" style="background:${/^#[0-9a-fA-F]{3,8}$/.test(c.color) ? c.color : '#ccc'}"></span>${escHtml(c.name)}</div>`;
          });
        } else {
          html += `<div class="batch-cat-item top-level" data-id="${p.id}" data-color="${escHtml(p.color)}" data-name="${escHtml(p.name)}"><span class="batch-cat-color" style="background:${/^#[0-9a-fA-F]{3,8}$/.test(p.color) ? p.color : '#ccc'}"></span>${escHtml(p.name)}</div>`;
        }
      });
    });
    dropdown.innerHTML = html;

    // 預設選第一個可選項
    const firstItem = dropdown.querySelector('.batch-cat-item');
    if (firstItem) selectBatchCat(firstItem);

    // 開關下拉
    trigger.onclick = (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      dropdown.classList.toggle('open', !isOpen);
      trigger.classList.toggle('active', !isOpen);
    };

    // 選擇項目
    dropdown.onclick = (e) => {
      const item = e.target.closest('.batch-cat-item');
      if (!item) return;
      selectBatchCat(item);
      dropdown.classList.remove('open');
      trigger.classList.remove('active');
    };

    // 點外面關閉
    const closeDropdown = (e) => {
      if (!e.target.closest('.batch-cat-picker')) {
        dropdown.classList.remove('open');
        trigger.classList.remove('active');
      }
    };
    document.removeEventListener('click', closeDropdown);
    document.addEventListener('click', closeDropdown);

    function selectBatchCat(item) {
      dropdown.querySelectorAll('.batch-cat-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      hiddenInput.value = item.dataset.id;
      labelEl.textContent = item.dataset.name;
      const color = item.dataset.color;
      if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
        dotEl.style.background = color;
        dotEl.classList.add('visible');
      } else {
        dotEl.classList.remove('visible');
      }
    }
  }

  // ─── 統計報表 ───
  let reportBound = false;
  async function renderReports() {
    if (!reportBound) {
      document.querySelectorAll('.report-controls .tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.report-controls .tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          drawReport();
        });
      });
      el('reportRange').addEventListener('change', () => {
        const isCustom = el('reportRange').value === 'custom';
        el('reportCustomRange').style.display = isCustom ? '' : 'none';
        if (!isCustom) drawReport();
      });
      el('reportFrom').addEventListener('change', drawReport);
      el('reportTo').addEventListener('change', drawReport);
      el('reportType').addEventListener('change', drawReport);
      el('reportDualPie').addEventListener('change', drawReport);
      reportBound = true;
    }
    await drawReport();
  }

  function updateReportDualPieVisibility(activeTab) {
    const wrap = el('reportDualPieWrap');
    if (!wrap) return;
    wrap.style.display = activeTab === 'category' ? '' : 'none';
  }

  function getReportDateRange() {
    const range = el('reportRange').value;
    const now = new Date();
    let from, to;
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (range) {
      case 'thisMonth':
        from = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'lastMonth':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0); break;
      case 'last3':
        from = new Date(now.getFullYear(), now.getMonth() - 2, 1); break;
      case 'last6':
        from = new Date(now.getFullYear(), now.getMonth() - 5, 1); break;
      case 'thisYear':
        from = new Date(now.getFullYear(), 0, 1); break;
      case 'custom': {
        const cf = el('reportFrom').value;
        const ct = el('reportTo').value;
        if (cf && ct) return { from: cf, to: ct };
        if (cf) return { from: cf, to: localDateStr(to) };
        if (ct) { from = new Date(now.getFullYear(), now.getMonth(), 1); return { from: localDateStr(from), to: ct }; }
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      }
      default:
        from = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { from: localDateStr(from), to: localDateStr(to) };
  }

  async function drawReport() {
    const activeTab = document.querySelector('.report-controls .tab.active')?.dataset.report || 'category';
    const type = el('reportType').value;
    const { from, to } = getReportDateRange();
    updateReportDualPieVisibility(activeTab);

    const reportData = await API.get(`/api/reports?type=${type}&from=${from}&to=${to}`);

    if (charts.report) charts.report.destroy();
    const ctx = el('reportChart').getContext('2d');
    el('reportSummary').innerHTML = '';

    switch (activeTab) {
      case 'category': drawCategoryChart(ctx, reportData, !!el('reportDualPie')?.checked); break;
      case 'trend': drawTrendChart(ctx, reportData, type, from, to); break;
      case 'daily': drawDailyChart(ctx, reportData, type, from, to); break;
    }
  }

  function sortByTotalThenNameDesc(a, b) {
    const totalDiff = (Number(b.total) || 0) - (Number(a.total) || 0);
    if (totalDiff !== 0) return totalDiff;
    return String(a.name || a.label || '').localeCompare(String(b.name || b.label || ''), 'zh-Hant');
  }

  function buildSortedCategoryRows(rowsInput) {
    const rows = Array.isArray(rowsInput) ? rowsInput : [];
    const parentMap = new Map();
    const childByParent = new Map();

    rows.forEach(item => {
      const total = Number(item.total) || 0;
      if (total <= 0) return;

      const childName = String(item.name || item.childName || '未分類');
      const parentName = String(item.parentName || childName);
      const parentKey = String(item.parentId || parentName || '未分類');
      const parentColor = normalizeHexColor(item.parentColor || item.color || '#94a3b8');
      const color = normalizeHexColor(item.color || parentColor || '#94a3b8');

      if (!parentMap.has(parentKey)) {
        parentMap.set(parentKey, {
          parentKey,
          parentId: String(item.parentId || ''),
          parentName,
          parentColor,
          total: 0,
        });
      }
      parentMap.get(parentKey).total += total;

      if (!childByParent.has(parentKey)) childByParent.set(parentKey, []);
      childByParent.get(parentKey).push({
        parentKey,
        parentName,
        childName,
        name: childName,
        total,
        color,
        label: parentName === childName ? childName : `${parentName} > ${childName}`,
      });
    });

    const parentRows = [...parentMap.values()].sort(sortByTotalThenNameDesc);
    const childRows = [];
    parentRows.forEach(parent => {
      const siblings = (childByParent.get(parent.parentKey) || []).sort(sortByTotalThenNameDesc);
      siblings.forEach((child, childIndex) => {
        childRows.push({
          ...child,
          childIndex,
          siblingCount: siblings.length,
        });
      });
    });

    return { parentRows, childRows };
  }

  function buildSortedCategoryRowsFromMap(catMap) {
    const map = catMap || {};
    const keys = Object.keys(map);
    const rows = keys.map(key => {
      const raw = String(key || '未分類');
      const [parent, childMaybe] = raw.includes(' > ')
        ? raw.split(' > ').map(x => x.trim())
        : [raw, raw];
      const node = map[key] || {};
      return {
        name: childMaybe || raw,
        parentName: parent || raw,
        parentId: parent || raw,
        color: node.color || '#94a3b8',
        parentColor: node.color || '#94a3b8',
        total: Number(node.total) || 0,
      };
    });
    return buildSortedCategoryRows(rows);
  }

  function drawCategoryChart(ctx, data, useDualPie = false) {
    if (useDualPie) {
      drawDualCategoryChart(ctx, data);
      return;
    }

    const sorted = (Array.isArray(data?.categoryBreakdown) && data.categoryBreakdown.length > 0)
      ? buildSortedCategoryRows(data.categoryBreakdown)
      : buildSortedCategoryRowsFromMap(data?.catMap);
    const parentRows = sorted.parentRows;
    if (parentRows.length === 0) return;

    const parentColorMap = new Map();
    parentRows.forEach((parent, idx) => {
      parentColorMap.set(parent.parentKey, buildParentAccentColor(parent.parentColor, idx, parentRows.length));
    });

    const labels = parentRows.map(r => r.parentName);
    const values = parentRows.map(r => r.total);
    const colors = parentRows.map(r => parentColorMap.get(r.parentKey) || '#94a3b8');
    const total = values.reduce((s, v) => s + v, 0);

    charts.report = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#ffffff' }] },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10,
              generateLabels(chart) {
                const ds = chart.data.datasets[0] || { data: [], backgroundColor: [] };
                return (chart.data.labels || []).map((label, i) => {
                  const value = Number(ds.data[i]) || 0;
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  const bg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;
                  return {
                    text: `${label}  ${fmt(value)}（${pct}%）`,
                    fillStyle: bg,
                    strokeStyle: bg,
                    lineWidth: 0,
                    hidden: false,
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = Number(context.raw) || 0;
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return `${context.label}：${fmt(value)}（${pct}%）`;
              },
            },
          },
        },
      },
    });

    let summaryHtml = '';
    labels.forEach((l, i) => {
      const pct = total ? ((values[i] / total) * 100).toFixed(1) : 0;
      summaryHtml += `<div class="report-summary-item">
        <div class="label">${escHtml(l)}</div>
        <div class="value">${fmt(values[i])}</div>
        <div class="label">${pct}%</div>
      </div>`;
    });
    el('reportSummary').innerHTML = summaryHtml;
  }

  function normalizeHexColor(value, fallback = '#94a3b8') {
    const raw = String(value || '').trim();
    if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(raw)) return fallback;
    if (raw.length === 4) {
      return '#' + raw.slice(1).split('').map(ch => ch + ch).join('').toLowerCase();
    }
    return raw.toLowerCase();
  }

  function hexToRgb(hex) {
    const c = normalizeHexColor(hex);
    const n = parseInt(c.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function blendHexColor(base, accent, ratio = 0.5) {
    const r = Math.max(0, Math.min(1, Number(ratio) || 0));
    const rgbBase = hexToRgb(base);
    const rgbAccent = hexToRgb(accent);
    return rgbToHex(
      rgbBase.r * (1 - r) + rgbAccent.r * r,
      rgbBase.g * (1 - r) + rgbAccent.g * r,
      rgbBase.b * (1 - r) + rgbAccent.b * r
    );
  }

  function rgbToHsl(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0) {
      if (max === rn) h = 60 * (((gn - bn) / d) % 6);
      else if (max === gn) h = 60 * ((bn - rn) / d + 2);
      else h = 60 * ((rn - gn) / d + 4);
    }
    if (h < 0) h += 360;
    return { h, s, l };
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    if (h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    return {
      r: (r1 + m) * 255,
      g: (g1 + m) * 255,
      b: (b1 + m) * 255,
    };
  }

  function buildChildVariantColor(baseColor, childIndex, siblingCount) {
    const base = normalizeHexColor(baseColor);
    const tones = [-0.26, -0.16, -0.08, 0, 0.1, 0.2, 0.28];
    const idx = siblingCount > 1 ? Math.round((childIndex / (siblingCount - 1)) * (tones.length - 1)) : 3;
    const tone = tones[Math.max(0, Math.min(tones.length - 1, idx))];
    if (tone >= 0) {
      return blendHexColor(base, '#f8fafc', Math.min(0.45, tone));
    }
    return blendHexColor(base, '#0f172a', Math.min(0.45, Math.abs(tone)));
  }

  function buildParentAccentColor(baseColor, index, totalCount) {
    const themePalette = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6'];
    const themeBase = themePalette[index % themePalette.length];
    const unifiedBase = blendHexColor(normalizeHexColor(baseColor), themeBase, 0.68);
    const rgb = hexToRgb(unifiedBase);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const step = totalCount > 0 ? 360 / totalCount : 90;
    const h = (hsl.h * 0.62 + (index * step) * 0.38 + (index % 2 === 0 ? 8 : -8) + 360) % 360;
    const s = Math.max(0.62, Math.min(0.9, hsl.s + 0.14));
    const lightSeed = 0.4 + (index % 4) * 0.05;
    const l = Math.max(0.32, Math.min(0.64, hsl.l * 0.56 + lightSeed * 0.44));
    const next = hslToRgb(h, s, l);
    return rgbToHex(next.r, next.g, next.b);
  }

  function drawDashboardExpenseDualPie(ctx, catBreakdown) {
    const sorted = buildSortedCategoryRows(catBreakdown);
    const parentRows = sorted.parentRows;
    const childRows = sorted.childRows;
    if (parentRows.length === 0 || childRows.length === 0) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }

    const parentColorMap = new Map();
    parentRows.forEach((row, idx) => {
      parentColorMap.set(row.parentKey, buildParentAccentColor(row.parentColor, idx, parentRows.length));
    });

    childRows.forEach(row => {
      const parentColor = parentColorMap.get(row.parentKey) || '#94a3b8';
      row.color = buildChildVariantColor(parentColor, row.childIndex, row.siblingCount);
    });

    charts.dashPie = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: childRows.map(r => r.label),
        datasets: [
          {
            label: '父分類',
            data: parentRows.map(r => r.total),
            backgroundColor: parentRows.map(r => parentColorMap.get(r.parentKey) || '#94a3b8'),
            borderColor: '#ffffff',
            borderWidth: 2,
            radius: '62%',
            cutout: '34%',
            segmentLabels: parentRows.map(r => r.parentName),
          },
          {
            label: '子分類',
            data: childRows.map(r => r.total),
            backgroundColor: childRows.map(r => r.color),
            borderColor: '#ffffff',
            borderWidth: 2,
            radius: '95%',
            cutout: '66%',
            segmentLabels: childRows.map(r => r.label),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10,
              generateLabels(chart) {
                const ds = chart.data.datasets[1] || { data: [], backgroundColor: [] };
                return (chart.data.labels || []).map((label, i) => {
                  const bg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;
                  return {
                    text: String(label || ''),
                    fillStyle: bg,
                    strokeStyle: bg,
                    lineWidth: 0,
                    hidden: false,
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              title(items) {
                if (!items || items.length === 0) return '';
                const item = items[0];
                const ds = item.dataset || {};
                const labels = ds.segmentLabels || [];
                return labels[item.dataIndex] || item.label || '';
              },
              label(context) {
                const ds = context.dataset || {};
                const labels = ds.segmentLabels || [];
                const label = labels[context.dataIndex] || context.label || '';
                const value = Number(context.raw) || 0;
                return `${ds.label}：${label} ${fmt(value)}`;
              },
            },
          },
        },
      },
    });
  }

  function drawDashboardAssetDualPie(ctx, accounts, stocks) {
    const accountRows = (accounts || [])
      .filter(a => !a.exclude_from_total)
      .map(a => ({
        label: String(a.name || '帳戶'),
        total: Math.round(Number(a.balance) || 0),
      }))
      .filter(row => row.total > 0)
      .sort((a, b) => b.total - a.total);

    const stockRows = (stocks || [])
      .map(s => {
        const code = String(s.code || '').trim();
        const name = String(s.name || '').trim();
        const label = code && name && code !== name ? `${code} ${name}` : (name || code || '股票');
        return {
          label,
          total: Math.round(Number(s.marketValue) || 0),
        };
      })
      .filter(row => row.total > 0)
      .sort((a, b) => b.total - a.total);

    const accountTotal = accountRows.reduce((sum, row) => sum + row.total, 0);
    const stockTotal = stockRows.reduce((sum, row) => sum + row.total, 0);
    if (accountTotal <= 0 && stockTotal <= 0) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }

    const parentRows = [];
    if (accountTotal > 0) parentRows.push({ key: 'account', label: '帳戶資產', name: '帳戶資產', total: accountTotal, color: '#0f766e' });
    if (stockTotal > 0) parentRows.push({ key: 'stock', label: '股票資產', name: '股票資產', total: stockTotal, color: '#b45309' });
    parentRows.sort(sortByTotalThenNameDesc);

    const childRows = [];
    parentRows.forEach(parent => {
      if (parent.key === 'account') {
        accountRows.forEach((row, idx) => {
          childRows.push({
            parentKey: 'account',
            label: `帳戶資產 > ${row.label}`,
            total: row.total,
            color: buildChildVariantColor('#0f766e', idx, Math.max(accountRows.length, 1)),
          });
        });
      } else {
        stockRows.forEach((row, idx) => {
          childRows.push({
            parentKey: 'stock',
            label: `股票資產 > ${row.label}`,
            total: row.total,
            color: buildChildVariantColor('#b45309', idx, Math.max(stockRows.length, 1)),
          });
        });
      }
    });

    const totalValue = childRows.reduce((sum, row) => sum + row.total, 0);
    const formatLabel = (label, value) => {
      const pct = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0';
      return `${label} ${fmt(value)} (${pct}%)`;
    };

    charts.dashAssetPie = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: childRows.map(r => r.label),
        datasets: [
          {
            label: '父分類',
            data: parentRows.map(r => r.total),
            backgroundColor: parentRows.map(r => r.color),
            borderColor: '#ffffff',
            borderWidth: 2,
            radius: '62%',
            cutout: '34%',
            segmentLabels: parentRows.map(r => r.label),
          },
          {
            label: '子分類',
            data: childRows.map(r => r.total),
            backgroundColor: childRows.map(r => r.color),
            borderColor: '#ffffff',
            borderWidth: 2,
            radius: '95%',
            cutout: '66%',
            segmentLabels: childRows.map(r => r.label),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10,
              generateLabels(chart) {
                const ds = chart.data.datasets[1] || { data: [], backgroundColor: [] };
                const labels = chart.data.labels || [];
                return labels.map((label, i) => {
                  const value = Number(ds.data?.[i]) || 0;
                  const bg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;
                  return {
                    text: formatLabel(String(label || ''), value),
                    fillStyle: bg,
                    strokeStyle: bg,
                    lineWidth: 0,
                    hidden: false,
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              title(items) {
                if (!items || items.length === 0) return '';
                const item = items[0];
                const ds = item.dataset || {};
                const labels = ds.segmentLabels || [];
                return labels[item.dataIndex] || item.label || '';
              },
              label(context) {
                const ds = context.dataset || {};
                const labels = ds.segmentLabels || [];
                const label = labels[context.dataIndex] || context.label || '';
                const value = Number(context.raw) || 0;
                return `${ds.label}：${formatLabel(label, value)}`;
              },
            },
          },
        },
      },
    });
  }

  function drawDualCategoryChart(ctx, data) {
    const breakdown = Array.isArray(data.categoryBreakdown) ? data.categoryBreakdown : [];
    if (breakdown.length === 0) return;

    const sorted = buildSortedCategoryRows(breakdown);
    const parentRows = sorted.parentRows;
    const childRows = sorted.childRows;
    if (parentRows.length === 0 || childRows.length === 0) return;

    const parentColorMap = new Map();
    parentRows.forEach((row, idx) => {
      parentColorMap.set(row.parentKey, buildParentAccentColor(row.parentColor || '#94a3b8', idx, parentRows.length));
    });

    childRows.forEach(row => {
      const parentColor = parentColorMap.get(row.parentKey) || '#94a3b8';
      row.renderColor = buildChildVariantColor(parentColor, row.childIndex, Math.max(row.siblingCount, 1));
    });

    const grandTotal = childRows.reduce((sum, row) => sum + row.total, 0);
    const parentTotal = parentRows.reduce((sum, row) => sum + row.total, 0);

    charts.report = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: childRows.map(r => r.label),
        datasets: [
          {
            label: '父分類',
            data: parentRows.map(r => r.total),
            backgroundColor: parentRows.map(r => parentColorMap.get(r.parentKey) || '#94a3b8'),
            borderColor: '#ffffff',
            borderWidth: 2,
            radius: '62%',
            cutout: '36%',
            segmentLabels: parentRows.map(r => r.parentName),
          },
          {
            label: '子分類',
            data: childRows.map(r => r.total),
            backgroundColor: childRows.map(r => r.renderColor || '#94a3b8'),
            borderColor: '#ffffff',
            borderWidth: 2,
            radius: '95%',
            cutout: '67%',
            segmentLabels: childRows.map(r => r.label),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title(items) {
                if (!items || items.length === 0) return '';
                const item = items[0];
                const ds = item.dataset || {};
                const names = ds.segmentLabels || [];
                return names[item.dataIndex] || item.label || '';
              },
              label(context) {
                const ds = context.dataset || {};
                const names = ds.segmentLabels || [];
                const label = names[context.dataIndex] || '';
                const value = Number(context.raw) || 0;
                const ref = ds.label === '父分類' ? parentTotal : grandTotal;
                const pct = ref > 0 ? ((value / ref) * 100).toFixed(1) : '0.0';
                return `${ds.label}：${label}  ${fmt(value)}（${pct}%）`;
              },
            },
          },
        },
      },
    });

    const total = childRows.reduce((sum, row) => sum + row.total, 0);
    const summaryParts = [
      '<div class="report-summary-item"><div class="label">圖層</div><div class="value">雙圓餅圖</div><div class="label">內圈父分類 / 外圈子分類</div></div>',
      ...parentRows.map(row => {
        const pct = total ? ((row.total / total) * 100).toFixed(1) : '0.0';
        return `<div class="report-summary-item"><div class="label">父分類：${escHtml(row.parentName)}</div><div class="value">${fmt(row.total)}</div><div class="label">${pct}%</div></div>`;
      }),
      ...childRows.map(row => {
        const pct = total ? ((row.total / total) * 100).toFixed(1) : '0.0';
        return `<div class="report-summary-item"><div class="label">${escHtml(row.label)}</div><div class="value">${fmt(row.total)}</div><div class="label">${pct}%</div></div>`;
      }),
    ];
    el('reportSummary').innerHTML = summaryParts.join('');
  }

  function drawTrendChart(ctx, data, type, from, to) {
    const monthlyMap = data.monthlyMap;
    const start = new Date(from);
    const end = new Date(to);
    const labels = [];
    const values = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const key = localMonthStr(cur);
      labels.push(key);
      values.push(monthlyMap[key] || 0);
      cur.setMonth(cur.getMonth() + 1);
    }
    const color = type === 'income' ? '#10b981' : '#ef4444';
    charts.report = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: type === 'income' ? '收入' : '支出', data: values, borderColor: color, backgroundColor: color + '20', fill: true, tension: .3 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
  }

  function drawDailyChart(ctx, data, type, from, to) {
    const dailyMap = data.dailyMap;
    const labels = [];
    const values = [];
    const cur = new Date(from);
    const endDate = new Date(to);
    while (cur <= endDate) {
      const key = localDateStr(cur);
      labels.push(key.slice(5));
      values.push(dailyMap[key] || 0);
      cur.setDate(cur.getDate() + 1);
    }
    const color = type === 'income' ? '#10b981' : '#ef4444';
    charts.report = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: type === 'income' ? '收入' : '支出', data: values, backgroundColor: color + 'cc' }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { ticks: { maxTicksLimit: 15 } } } },
    });
  }

  // ─── 預算管理 ───
  async function renderBudget() {
    const month = thisMonth();
    const budgets = await API.get('/api/budgets?yearMonth=' + month);

    const totalExpenseRow = budgets.find(b => !b.categoryId);
    const totalExpenseUsed = totalExpenseRow ? totalExpenseRow.used : 0;

    el('budgetUsed').textContent = fmt(totalExpenseUsed);
    el('budgetTotal').textContent = totalExpenseRow ? fmt(totalExpenseRow.amount) : 'NT$ 0';
    const pct = totalExpenseRow ? Math.min((totalExpenseUsed / totalExpenseRow.amount) * 100, 100) : 0;
    const bar = el('budgetTotalBar');
    bar.style.width = pct + '%';
    bar.className = 'progress-fill' + (pct >= 100 ? ' danger' : pct >= 80 ? ' warning' : '');

    const catBudgets = budgets.filter(b => b.categoryId);
    const container = el('budgetList');
    if (catBudgets.length === 0 && !totalExpenseRow) {
      container.innerHTML = '<p class="empty-hint">尚未設定預算，請點擊「設定預算」按鈕</p>';
    } else {
      container.innerHTML = catBudgets.map(b => {
        const cat = getCat(b.categoryId);
        const p = Math.min((b.used / b.amount) * 100, 100);
        const cls = p >= 100 ? 'danger' : p >= 80 ? 'warning' : '';
        return `<div class="budget-item">
          <div class="budget-item-header">
            <span>${cat ? escHtml(cat.name) : '未知分類'}</span>
            <div>
              <button class="btn-icon" onclick="App.editBudget('${b.id}')" title="編輯"><i class="fas fa-pen"></i></button>
              <button class="btn-icon danger" onclick="App.deleteBudget('${b.id}')" title="刪除"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div class="budget-item-amounts">${fmt(b.used)} / ${fmt(b.amount)} (${p.toFixed(0)}%)</div>
          <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${p}%"></div></div>
        </div>`;
      }).join('');
    }

    el('setBudgetBtn').onclick = () => openBudgetModal();
  }

  // ─── 帳戶管理 ───
  const ACCOUNT_TYPE_META = [
    { key: 'all',    label: '全部',     icon: 'fa-layer-group',      color: 'var(--primary)' },
    { key: '銀行',   label: '銀行',     icon: 'fa-building-columns', color: '#3b82f6' },
    { key: '信用卡', label: '信用卡',   icon: 'fa-credit-card',      color: '#8b5cf6' },
    { key: '現金',   label: '現金',     icon: 'fa-money-bill',       color: '#10b981' },
    { key: '虛擬錢包', label: '虛擬錢包', icon: 'fa-wallet',          color: '#f59e0b' },
  ];

  function getAccountTypeMeta(key) {
    return ACCOUNT_TYPE_META.find(t => t.key === key) || ACCOUNT_TYPE_META[3];
  }

  function renderCreditCardsByBank(cards) {
    const bankGroups = {};
    const ungrouped = [];
    cards.forEach(c => {
      if (c.linkedBankId) {
        if (!bankGroups[c.linkedBankId]) bankGroups[c.linkedBankId] = [];
        bankGroups[c.linkedBankId].push(c);
      } else {
        ungrouped.push(c);
      }
    });

    let html = '';
    Object.entries(bankGroups).forEach(([bankId, groupCards]) => {
      const bankAcc = cachedAccounts.find(a => a.id === bankId);
      const bankName = bankAcc ? escHtml(bankAcc.name) : '未知銀行';
      const totalDebt = groupCards.reduce((sum, c) => sum + c.balance, 0);
      const debtStr = fmtByCurrency(totalDebt, 'TWD'); // balances are normalized to TWD by the server
      html += `<div class="acc-bank-group-header">
        <i class="fas fa-building-columns"></i>
        <span>${bankName} · 共 ${groupCards.length} 張</span>
        <span class="acc-bank-debt">欠款合計 ${debtStr}</span>
        <button class="btn btn-sm btn-outline acc-repay-btn" onclick="App.openCreditRepaymentModal('${bankId}')">
          <i class="fas fa-hand-holding-dollar"></i> 還款
        </button>
      </div>
      ${groupCards.map(c => renderAccountCard(c)).join('')}`;
    });

    if (ungrouped.length > 0) {
      html += `<div class="account-type-group-header" style="--group-color:#8b5cf6;margin-top:${Object.keys(bankGroups).length > 0 ? '8px' : '0'}">
        <i class="fas fa-credit-card"></i>
        <span>未分組</span>
        <span class="acc-group-count">${ungrouped.length} 個</span>
      </div>
      ${ungrouped.map(c => renderAccountCard(c)).join('')}`;
    }
    return html;
  }

  function renderAccountCard(a) {
    const currency = normalizeCurrencyCode(a.currency);
    const safeIcon = normalizeAccountIcon(a.icon);
    const typeMeta = getAccountTypeMeta(a.account_type || '現金');
    const excluded = a.exclude_from_total === 1 || a.exclude_from_total === true;
    return `<div class="account-card${excluded ? ' acc-excluded' : ''}">
      <div class="card-icon" style="background:${typeMeta.color}18;color:${typeMeta.color}">
        <i class="fas ${safeIcon}"></i>
      </div>
      <div class="account-card-info">
        <div class="account-card-name">
          ${escHtml(a.name)} <span class="tx-original-amount">(${currency})</span>
          ${excluded ? '<span class="acc-excluded-badge"><i class="fas fa-eye-slash"></i> 不計入總資產</span>' : ''}
        </div>
        <div class="account-card-balance">${fmtByCurrency(a.balance, currency)}</div>
      </div>
      <div class="account-card-actions">
        <button class="btn-icon" onclick="App.editAccount('${a.id}')" title="編輯"><i class="fas fa-pen"></i></button>
        <button class="btn-icon danger" onclick="App.deleteAccount('${a.id}')" title="刪除"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }

  async function renderAccounts() {
    const accounts = await API.get('/api/accounts');
    cachedAccounts = accounts;

    const includedAccounts = accounts.filter(a => !a.exclude_from_total);
    const excludedAccounts = accounts.filter(a => a.exclude_from_total);
    const totalAssets = includedAccounts.reduce((sum, a) => sum + a.balance, 0);
    el('totalAssets').textContent = fmt(totalAssets);
    const noteEl = el('totalAssetsNote');
    if (noteEl) {
      noteEl.textContent = excludedAccounts.length > 0
        ? `已排除 ${excludedAccounts.length} 個帳戶不計入`
        : '';
    }

    // ── 篩選 Tab ──
    const filterEl = el('accountTypeFilter');
    filterEl.innerHTML = ACCOUNT_TYPE_META.map(t => {
      const count = t.key === 'all' ? accounts.length : accounts.filter(a => (a.account_type || '現金') === t.key).length;
      return `<button class="acc-type-btn${accountTypeFilter === t.key ? ' active' : ''}"
        onclick="App.setAccountTypeFilter('${t.key}')">
        <i class="fas ${t.icon}"></i> ${t.label}
        <span class="acc-type-count">${count}</span>
      </button>`;
    }).join('');

    // ── 渲染卡片 ──
    const grid = el('accountGrid');
    const filtered = accountTypeFilter === 'all'
      ? accounts
      : accounts.filter(a => (a.account_type || '現金') === accountTypeFilter);

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="account-empty-state"><i class="fas fa-folder-open"></i><p>此類別尚無帳戶</p></div>`;
    } else if (accountTypeFilter === 'all') {
      const typeOrder = ['銀行', '信用卡', '現金', '虛擬錢包'];
      const grouped = {};
      filtered.forEach(a => {
        const t = a.account_type || '現金';
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(a);
      });
      grid.innerHTML = typeOrder.filter(t => grouped[t]).map(type => {
        const meta = getAccountTypeMeta(type);
        const header = `<div class="account-type-group-header" style="--group-color:${meta.color}">
          <i class="fas ${meta.icon}"></i>
          <span>${type}</span>
          <span class="acc-group-count">${grouped[type].length} 個</span>
        </div>`;
        const body = type === '信用卡'
          ? renderCreditCardsByBank(grouped[type])
          : grouped[type].map(a => renderAccountCard(a)).join('');
        return header + body;
      }).join('');
    } else {
      grid.innerHTML = accountTypeFilter === '信用卡'
        ? renderCreditCardsByBank(filtered)
        : filtered.map(a => renderAccountCard(a)).join('');
    }

    el('addAccountBtn').onclick = () => openAccountModal();
    el('transferBtn').onclick = () => openTransferModal();

    await renderExchangeRateSettings();
    bindExchangeRateSettingsIfNeeded();
  }

  // ─── 股票紀錄 ───
  let stocksBound = false;
  let cachedStocks = [];
  const DEFAULT_STOCK_CALC_SETTINGS = {
    feeRate: 0.001425,
    feeDiscount: 1,
    feeMinLot: 20,
    feeMinOdd: 1,
    sellTaxRateStock: 0.003,
    sellTaxRateEtf: 0.001,
    sellTaxRateWarrant: 0.001,
    sellTaxMin: 1,
  };
  let stockCalcSettings = { ...DEFAULT_STOCK_CALC_SETTINGS };
  let stkTxPage = 1, stkTxPageSize = 20;
  let stkTxSortBy = 'date', stkTxSortDir = 'desc';
  let stkDivPage = 1, stkDivPageSize = 20;
  let stkDivSortBy = 'date', stkDivSortDir = 'desc';
  let selectedStkTxIds = new Set();
  let selectedStkDivIds = new Set();

  function updateStkTxBatchBar() {
    const count = selectedStkTxIds.size;
    el('stkTxBatchBar').style.display = count > 0 ? '' : 'none';
    el('stkTxBatchCount').textContent = `已選 ${count} 筆`;
    const allCb = el('selectAllStkTx');
    const cbs = document.querySelectorAll('.stk-tx-checkbox');
    if (cbs.length > 0 && count === cbs.length) { allCb.checked = true; allCb.indeterminate = false; }
    else if (count > 0) { allCb.checked = false; allCb.indeterminate = true; }
    else { allCb.checked = false; allCb.indeterminate = false; }
  }

  function clearStkTxSelection() {
    selectedStkTxIds.clear();
    document.querySelectorAll('.stk-tx-checkbox').forEach(cb => cb.checked = false);
    updateStkTxBatchBar();
  }

  function toggleStkTxSelect(id, checked) {
    if (checked) selectedStkTxIds.add(id); else selectedStkTxIds.delete(id);
    updateStkTxBatchBar();
  }

  function updateStkDivBatchBar() {
    const count = selectedStkDivIds.size;
    el('stkDivBatchBar').style.display = count > 0 ? '' : 'none';
    el('stkDivBatchCount').textContent = `已選 ${count} 筆`;
    const allCb = el('selectAllStkDiv');
    const cbs = document.querySelectorAll('.stk-div-checkbox');
    if (cbs.length > 0 && count === cbs.length) { allCb.checked = true; allCb.indeterminate = false; }
    else if (count > 0) { allCb.checked = false; allCb.indeterminate = true; }
    else { allCb.checked = false; allCb.indeterminate = false; }
  }

  function clearStkDivSelection() {
    selectedStkDivIds.clear();
    document.querySelectorAll('.stk-div-checkbox').forEach(cb => cb.checked = false);
    updateStkDivBatchBar();
  }

  function toggleStkDivSelect(id, checked) {
    if (checked) selectedStkDivIds.add(id); else selectedStkDivIds.delete(id);
    updateStkDivBatchBar();
  }

  function stkTxBatchDelete() {
    const count = selectedStkTxIds.size;
    confirmDelete(`確定要刪除所選的 ${count} 筆交易紀錄嗎？此操作無法復原。`, async () => {
      try {
        const result = await API.post('/api/stock-transactions/batch-delete', { ids: [...selectedStkTxIds] });
        toast(`已刪除 ${result.deleted} 筆交易紀錄`, 'success');
        clearStkTxSelection();
        await refreshStocks();
        renderStockPortfolio();
        await renderStockTransactions();
        await renderStockRealized();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function stkDivBatchDelete() {
    const count = selectedStkDivIds.size;
    confirmDelete(`確定要刪除所選的 ${count} 筆股利紀錄嗎？此操作無法復原。`, async () => {
      try {
        const result = await API.post('/api/stock-dividends/batch-delete', { ids: [...selectedStkDivIds] });
        toast(`已刪除 ${result.deleted} 筆股利紀錄`, 'success');
        clearStkDivSelection();
        await refreshStocks();
        renderStockPortfolio();
        await renderStockDividends();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function renderStkPagination(paginationElId, pageNum, totalPages, goPageFn) {
    const pag = el(paginationElId);
    if (totalPages <= 1) { pag.innerHTML = ''; return; }
    let ph = `<button ${pageNum <= 1 ? 'disabled' : ''} onclick="${goPageFn}(${pageNum - 1})"><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7) {
        if (i === 1 || i === totalPages || (i >= pageNum - 1 && i <= pageNum + 1)) {
          ph += `<button class="${i === pageNum ? 'active' : ''}" onclick="${goPageFn}(${i})">${i}</button>`;
        } else if (i === pageNum - 2 || i === pageNum + 2) {
          ph += `<button disabled>...</button>`;
        }
      } else {
        ph += `<button class="${i === pageNum ? 'active' : ''}" onclick="${goPageFn}(${i})">${i}</button>`;
      }
    }
    ph += `<button ${pageNum >= totalPages ? 'disabled' : ''} onclick="${goPageFn}(${pageNum + 1})"><i class="fas fa-chevron-right"></i></button>`;
    pag.innerHTML = ph;
  }

  async function renderStocks() {
    if (!stocksBound) {
      // Tab 切換（透過路由）
      document.querySelectorAll('.stock-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const sub = tab.dataset.stockTab;
          navigate('stocks', sub);
        });
      });
      // 篩選器（搜尋輸入框）
      setupStockSearchFilter('stockTxFilterInput', 'stockTxFilter', 'stockTxFilterClear', () => { stkTxPage = 1; renderStockTransactions(); });
      setupStockSearchFilter('stockDivFilterInput', 'stockDivFilter', 'stockDivFilterClear', () => { stkDivPage = 1; renderStockDividends(); });
      setupStockSearchFilter('stockRealizedFilterInput', 'stockRealizedFilter', 'stockRealizedFilterClear', renderStockRealized);

      // 股票交易：日期篩選
      el('stkTxDateFrom').addEventListener('change', () => { stkTxPage = 1; renderStockTransactions(); });
      el('stkTxDateTo').addEventListener('change', () => { stkTxPage = 1; renderStockTransactions(); });

      // 股票交易：每頁筆數
      el('stkTxPageSize').addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          el('stkTxPageSizeCustom').style.display = '';
          el('stkTxPageSizeCustom').focus();
        } else {
          el('stkTxPageSizeCustom').style.display = 'none';
          stkTxPageSize = parseInt(e.target.value);
          stkTxPage = 1;
          renderStockTransactions();
        }
      });
      el('stkTxPageSizeCustom').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const v = parseInt(el('stkTxPageSizeCustom').value);
          if (v > 0) { stkTxPageSize = v; stkTxPage = 1; renderStockTransactions(); }
        }
      });

      // 股票交易：全選 + 批次操作
      el('selectAllStkTx').addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.stk-tx-checkbox').forEach(cb => {
          cb.checked = checked;
          const id = cb.dataset.id;
          if (checked) selectedStkTxIds.add(id); else selectedStkTxIds.delete(id);
        });
        updateStkTxBatchBar();
      });
      el('stkTxBatchDeleteBtn').addEventListener('click', stkTxBatchDelete);
      el('stkTxBatchCancelBtn').addEventListener('click', clearStkTxSelection);

      // 股利：日期篩選
      el('stkDivDateFrom').addEventListener('change', () => { stkDivPage = 1; renderStockDividends(); });
      el('stkDivDateTo').addEventListener('change', () => { stkDivPage = 1; renderStockDividends(); });

      // 股利：每頁筆數
      el('stkDivPageSize').addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          el('stkDivPageSizeCustom').style.display = '';
          el('stkDivPageSizeCustom').focus();
        } else {
          el('stkDivPageSizeCustom').style.display = 'none';
          stkDivPageSize = parseInt(e.target.value);
          stkDivPage = 1;
          renderStockDividends();
        }
      });
      el('stkDivPageSizeCustom').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const v = parseInt(el('stkDivPageSizeCustom').value);
          if (v > 0) { stkDivPageSize = v; stkDivPage = 1; renderStockDividends(); }
        }
      });

      // 股利：全選 + 批次操作
      el('selectAllStkDiv').addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.stk-div-checkbox').forEach(cb => {
          cb.checked = checked;
          const id = cb.dataset.id;
          if (checked) selectedStkDivIds.add(id); else selectedStkDivIds.delete(id);
        });
        updateStkDivBatchBar();
      });
      el('stkDivBatchDeleteBtn').addEventListener('click', stkDivBatchDelete);
      el('stkDivBatchCancelBtn').addEventListener('click', clearStkDivSelection);
      // 自動計算手續費/稅
      const calcFields = ['stkTxShares', 'stkTxPrice'];
      calcFields.forEach(id => el(id).addEventListener('input', calcStockTxSummary));
      document.querySelectorAll('input[name="stkTxType"]').forEach(r => {
        r.addEventListener('change', () => {
          el('stkTxTaxRow').style.display = r.value === 'sell' ? '' : 'none';
          calcStockTxSummary();
        });
      });
      // 股票代號自動查詢 TWSE（新增股票 Modal）
      let stkLookupTimer = null;
      el('stkSymbol').addEventListener('input', () => {
        clearTimeout(stkLookupTimer);
        const sym = el('stkSymbol').value.trim();
        el('stkLookupStatus').textContent = '';
        if (sym.length >= 2) {
          el('stkLookupStatus').textContent = '查詢中...';
          el('stkLookupStatus').className = 'stk-lookup-status';
          stkLookupTimer = setTimeout(() => lookupTwseStock(sym), 500);
        }
      });
      // 股票代號自動查詢 TWSE（交易 Modal）
      let stkTxLookupTimer = null;
      el('stkTxSymbol').addEventListener('input', () => {
        clearTimeout(stkTxLookupTimer);
        const sym = el('stkTxSymbol').value.trim();
        el('stkTxLookupStatus').textContent = '';
        el('stkTxStockId').value = '';
        if (sym.length >= 2) {
          el('stkTxLookupStatus').textContent = '查詢中...';
          el('stkTxLookupStatus').className = 'stk-lookup-status';
          stkTxLookupTimer = setTimeout(() => lookupStockSymbol(sym, 'stkTx'), 500);
        }
      });
      // 股票代號自動查詢 TWSE（股利 Modal）
      let stkDivLookupTimer = null;
      el('stkDivSymbol').addEventListener('input', () => {
        clearTimeout(stkDivLookupTimer);
        const sym = el('stkDivSymbol').value.trim();
        el('stkDivLookupStatus').textContent = '';
        el('stkDivStockId').value = '';
        if (sym.length >= 2) {
          el('stkDivLookupStatus').textContent = '查詢中...';
          el('stkDivLookupStatus').className = 'stk-lookup-status';
          stkDivLookupTimer = setTimeout(() => lookupStockSymbol(sym, 'stkDiv'), 500);
        }
      });
      // 表單提交
      el('stockForm').addEventListener('submit', handleStockSave);
      el('stockTxForm').addEventListener('submit', handleStockTxSave);
      el('stockDivForm').addEventListener('submit', handleStockDivSave);
      el('priceUpdateSaveBtn').addEventListener('click', handlePriceUpdateSave);
      el('fetchTwsePricesBtn').addEventListener('click', fetchTwsePrices);
      const stockSettingsForm = el('stockSettingsForm');
      if (stockSettingsForm) stockSettingsForm.addEventListener('submit', saveStockCalcSettings);
      el('addStockRecurringBtn')?.addEventListener('click', () => openStockRecurringModal());
      el('stockRecurringForm')?.addEventListener('submit', handleStockRecurringSave);
      stocksBound = true;
    }
    await loadStockCalcSettings();
    await refreshStocks();
    renderStockPortfolio();
    populateStockFilters();
    await renderStockTransactions();
    await renderStockDividends();
    await renderStockRealized();
    renderStockSettingsPanel();
    await renderStockRecurringList();
  }

  async function refreshStocks() {
    cachedStocks = await API.get('/api/stocks');
  }

  function openFormulaModal() {
    openModal('modalFormula');
  }

  function renderStockPortfolio() {
    const stocks = cachedStocks;
    let totalValue = 0, totalCost = 0, totalPL = 0, totalDiv = 0;
    stocks.forEach(s => {
      totalValue += s.marketValue;
      totalCost += s.totalCost;
      totalPL += s.estimatedProfit || 0;
      totalDiv += s.totalDividend;
    });
    el('stockTotalValue').textContent = fmt(totalValue);
    el('stockTotalCost').textContent = fmt(totalCost);
    el('stockTotalPL').textContent = (totalPL >= 0 ? '+' : '') + fmt(totalPL);
    el('stockTotalPL').className = 'card-value ' + (totalPL >= 0 ? 'amount-income' : 'amount-expense');
    el('stockTotalDiv').textContent = fmt(totalDiv);

    const grid = el('stockPortfolioGrid');
    if (stocks.length === 0) {
      grid.innerHTML = '<div class="empty-hint" style="padding:40px;text-align:center;color:var(--text-secondary)">尚無股票，點擊「新增股票」開始記錄</div>';
      return;
    }
    grid.innerHTML = stocks.filter(s => s.totalShares > 0 || s.totalCost > 0 || s.marketValue > 0).map(s => {
      const ep = s.estimatedProfit || 0;
      const rr = s.returnRate || 0;
      const plCls = ep >= 0 ? 'stock-card-pl-pos' : 'stock-card-pl-neg';
      const plSign = ep >= 0 ? '+' : '';
      const rlPlCls = s.realizedPL >= 0 ? 'stock-card-pl-pos' : 'stock-card-pl-neg';
      const rlSign = s.realizedPL >= 0 ? '+' : '';
      const plArrow = ep >= 0 ? '<i class="fas fa-caret-up"></i>' : '<i class="fas fa-caret-down"></i>';
      const totalReturn = ep + s.realizedPL + s.totalDividend;
      return `<div class="stock-card">
        <div class="stock-card-header">
          <div class="stock-card-header-left">
            <span class="stock-card-symbol">${escHtml(s.symbol)}</span>
            <span class="stock-card-name">${escHtml(s.name)}</span>
          </div>
          <div class="stock-card-price-wrap">
            <div class="stock-card-price">$${(s.currentPrice || 0).toLocaleString()}</div>
            <div class="stock-card-price-change ${plCls}">${plArrow} ${plSign}${rr.toFixed(1)}%</div>
          </div>
        </div>
        <div class="stock-card-body">
          <div class="stock-card-item"><span class="label">持有股數</span><span class="value">${s.totalShares.toLocaleString()}</span></div>
          <div class="stock-card-item"><span class="label">成本均價</span><span class="value">$${Number(s.avgCost).toLocaleString()}</span></div>
          <div class="stock-card-item"><span class="label">成本金額</span><span class="value">${fmt(s.totalCost)}</span></div>
          <div class="stock-card-item"><span class="label">市值</span><span class="value">${fmt(s.marketValue)}</span></div>
          <div class="stock-card-divider"></div>
          <div class="stock-card-item"><span class="label">預估手續費</span><span class="value">${fmt(s.estSellFee || 0)}</span></div>
          <div class="stock-card-item"><span class="label">預估交易稅</span><span class="value">${fmt(s.estSellTax || 0)}</span></div>
          <div class="stock-card-item"><span class="label">預估淨收付</span><span class="value">${fmt(s.estimatedNet || 0)}</span></div>
          <div class="stock-card-item"><span class="label">預估損益</span><span class="value ${plCls}">${plSign}${fmt(ep)} (${plSign}${rr.toFixed(1)}%)</span></div>
          <div class="stock-card-divider"></div>
          <div class="stock-card-item"><span class="label">已實現損益</span><span class="value ${rlPlCls}">${rlSign}${fmt(s.realizedPL)}</span></div>
          <div class="stock-card-item"><span class="label">累計股利</span><span class="value" style="color:var(--today)">${fmt(s.totalDividend)}</span></div>
          <div class="stock-card-item"><span class="label">總報酬</span><span class="value ${totalReturn >= 0 ? 'stock-card-pl-pos' : 'stock-card-pl-neg'}">${totalReturn >= 0 ? '+' : ''}${fmt(totalReturn)}</span></div>
        </div>
        <div class="stock-card-actions">
          <button class="btn-icon" onclick="App.editStock('${s.id}')" title="編輯"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="App.deleteStock('${s.id}')" title="刪除"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
    }).join('') || '<div class="empty-hint" style="padding:40px;text-align:center;color:var(--text-secondary)">所有股票已賣出，無持股</div>';
  }

  function populateStockFilters() {
    // 搜尋式篩選不需要填充 select，只需確保 dropdown 候選項可用
    // cachedStocks 已有最新資料供搜尋使用
  }

  function setupStockSearchFilter(inputId, hiddenId, clearBtnId, renderFn) {
    const input = el(inputId);
    const hidden = el(hiddenId);
    const clearBtn = el(clearBtnId);
    // 建立下拉選單
    const dropdown = document.createElement('div');
    dropdown.className = 'stock-search-dropdown';
    input.parentElement.appendChild(dropdown);

    let activeIdx = -1;

    function showDropdown(keyword) {
      const kw = keyword.toLowerCase();
      const matches = kw
        ? cachedStocks.filter(s => s.symbol.toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw))
        : cachedStocks;
      if (matches.length === 0 && !kw) {
        dropdown.classList.remove('show');
        return;
      }
      const allItem = `<div class="stock-search-item" data-id="" data-symbol="">
        <span class="stock-search-symbol">全部</span><span class="stock-search-name">顯示所有股票</span></div>`;
      dropdown.innerHTML = allItem + matches.map(s =>
        `<div class="stock-search-item" data-id="${s.id}" data-symbol="${escHtml(s.symbol)}">
          <span class="stock-search-symbol">${escHtml(s.symbol)}</span>
          <span class="stock-search-name">${escHtml(s.name)}</span>
        </div>`
      ).join('');
      activeIdx = -1;
      dropdown.classList.add('show');
    }

    function selectItem(id, symbol) {
      hidden.value = id;
      input.value = symbol;
      clearBtn.style.display = symbol ? '' : 'none';
      dropdown.classList.remove('show');
      renderFn();
    }

    input.addEventListener('focus', () => showDropdown(input.value.trim()));
    input.addEventListener('input', () => {
      const kw = input.value.trim();
      showDropdown(kw);
      // 即時篩選：若輸入為空則顯示全部
      if (!kw) {
        hidden.value = '';
        clearBtn.style.display = 'none';
        renderFn();
      }
    });
    input.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.stock-search-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && items[activeIdx]) {
          selectItem(items[activeIdx].dataset.id, items[activeIdx].dataset.symbol);
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('show');
      }
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.stock-search-item');
      if (item) selectItem(item.dataset.id, item.dataset.symbol);
    });

    // 點擊外部關閉
    document.addEventListener('click', (e) => {
      if (!input.parentElement.contains(e.target)) dropdown.classList.remove('show');
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      hidden.value = '';
      clearBtn.style.display = 'none';
      renderFn();
    });
  }

  // ─── 排序圖示更新 ───
  function updateSortIcons(panelId, currentSort, currentDir) {
    const panel = el(panelId);
    if (!panel) return;
    panel.querySelectorAll('th.sortable').forEach(th => {
      const col = th.dataset.sort;
      th.classList.remove('sort-asc', 'sort-desc');
      const icon = th.querySelector('i');
      if (col === currentSort) {
        th.classList.add(currentDir === 'asc' ? 'sort-asc' : 'sort-desc');
        if (icon) icon.className = currentDir === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
      } else {
        if (icon) icon.className = 'fas fa-sort';
      }
    });
  }

  function stkTxSort(col) {
    if (stkTxSortBy === col) {
      stkTxSortDir = stkTxSortDir === 'desc' ? 'asc' : 'desc';
    } else {
      stkTxSortBy = col;
      stkTxSortDir = col === 'date' ? 'desc' : 'asc';
    }
    stkTxPage = 1;
    renderStockTransactions();
  }

  function stkDivSort(col) {
    if (stkDivSortBy === col) {
      stkDivSortDir = stkDivSortDir === 'desc' ? 'asc' : 'desc';
    } else {
      stkDivSortBy = col;
      stkDivSortDir = col === 'date' ? 'desc' : 'asc';
    }
    stkDivPage = 1;
    renderStockDividends();
  }

  async function renderStockTransactions(page) {
    if (page) stkTxPage = page;
    selectedStkTxIds.clear();
    updateStkTxBatchBar();
    const stockId = el('stockTxFilter').value;
    const dateFrom = el('stkTxDateFrom')?.value || '';
    const dateTo = el('stkTxDateTo')?.value || '';
    let params = `?page=${stkTxPage}&pageSize=${stkTxPageSize}&sortBy=${stkTxSortBy}&sortDir=${stkTxSortDir}`;
    if (stockId) params += `&stockId=${stockId}`;
    if (dateFrom) params += `&dateFrom=${dateFrom}`;
    if (dateTo) params += `&dateTo=${dateTo}`;
    // 更新表頭排序圖示
    updateSortIcons('stockPanel-transactions', stkTxSortBy, stkTxSortDir);
    const result = await API.get('/api/stock-transactions' + params);
    const { data: txs, total, page: pageNum, totalPages } = result;
    const tbody = el('stockTxBody');
    if (txs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-hint">沒有交易紀錄</td></tr>';
      el('stkTxPagination').innerHTML = '';
      return;
    }
    tbody.innerHTML = txs.map(t => {
      const isBuy = t.type === 'buy';
      const total = isBuy ? (t.shares * t.price + t.fee) : (t.shares * t.price - t.fee - t.tax);
      return `<tr>
        <td class="td-check"><input type="checkbox" class="stk-tx-checkbox" data-id="${t.id}" onchange="App.toggleStkTxSelect('${t.id}', this.checked)"></td>
        <td>${t.date}</td>
        <td><span class="type-badge ${isBuy ? 'income' : 'expense'}">${isBuy ? '買進' : '賣出'}</span></td>
        <td>${escHtml(t.symbol)} ${escHtml(t.stock_name)}</td>
        <td>${t.shares.toLocaleString()}</td>
        <td>$${Number(t.price).toLocaleString()}</td>
        <td>${fmt(t.fee)}</td>
        <td>${t.tax ? fmt(t.tax) : '-'}</td>
        <td class="${isBuy ? 'amount-expense' : 'amount-income'}">${fmt(Math.round(total))}</td>
        <td>
          <button class="btn-icon" onclick="App.editStockTx('${t.id}')" title="編輯"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="App.deleteStockTx('${t.id}')" title="刪除"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
    renderStkPagination('stkTxPagination', pageNum, totalPages, 'App.stkTxGoPage');
  }

  async function renderStockDividends(page) {
    if (page) stkDivPage = page;
    selectedStkDivIds.clear();
    updateStkDivBatchBar();
    const stockId = el('stockDivFilter').value;
    const dateFrom = el('stkDivDateFrom')?.value || '';
    const dateTo = el('stkDivDateTo')?.value || '';
    let params = `?page=${stkDivPage}&pageSize=${stkDivPageSize}&sortBy=${stkDivSortBy}&sortDir=${stkDivSortDir}`;
    if (stockId) params += `&stockId=${stockId}`;
    if (dateFrom) params += `&dateFrom=${dateFrom}`;
    if (dateTo) params += `&dateTo=${dateTo}`;
    // 更新表頭排序圖示
    updateSortIcons('stockPanel-dividends', stkDivSortBy, stkDivSortDir);
    const result = await API.get('/api/stock-dividends' + params);
    const { data: divs, total, page: pageNum, totalPages } = result;
    const tbody = el('stockDivBody');
    if (divs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-hint">沒有股利紀錄</td></tr>';
      el('stkDivPagination').innerHTML = '';
      return;
    }
    tbody.innerHTML = divs.map(d => `<tr>
      <td class="td-check"><input type="checkbox" class="stk-div-checkbox" data-id="${d.id}" onchange="App.toggleStkDivSelect('${d.id}', this.checked)"></td>
      <td>${d.date}</td>
      <td>${escHtml(d.symbol)} ${escHtml(d.stock_name)}</td>
      <td>${fmt(d.cash_dividend)}</td>
      <td>${d.stock_dividend_shares || '-'}</td>
      <td>${escHtml(d.note || '')}</td>
      <td>
        <button class="btn-icon" onclick="App.editStockDiv('${d.id}')" title="編輯"><i class="fas fa-pen"></i></button>
        <button class="btn-icon danger" onclick="App.deleteStockDiv('${d.id}')" title="刪除"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('');
    renderStkPagination('stkDivPagination', pageNum, totalPages, 'App.stkDivGoPage');
  }

  // ─── 同步除權息 ───
  async function syncDividends() {
    const btn = el('syncDividendsBtn');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 同步中（查詢歷史除權息資料，可能需要數十秒）...';
    try {
      const result = await API.post('/api/stock-dividends/sync', {});
      if (result.synced > 0) {
        toast(`已同步 ${result.synced} 筆股利紀錄`, 'success');
        await refreshStocks();
        renderStockPortfolio();
        await renderStockDividends();
        await renderStockRealized();
      } else if (result.skipped > 0) {
        toast('所有除權息紀錄皆已存在，無需同步', 'info');
      } else {
        toast(result.message || '查無符合的除權息紀錄', 'info');
      }
      if (result.errors?.length) {
        console.warn('同步警告:', result.errors);
      }
    } catch (e) {
      toast('同步失敗：' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }

  // ─── 實現損益 ───
  async function renderStockRealized() {
    const stockId = el('stockRealizedFilter').value;
    const params = stockId ? `?stockId=${stockId}` : '';
    const records = await API.get('/api/stock-realized' + params);
    const tbody = el('stockRealizedBody');

    // 彙總卡片
    const totalPL = records.reduce((s, r) => s + r.realizedPL, 0);
    const totalCost = records.reduce((s, r) => s + r.totalCost, 0);
    const totalReturn = totalCost > 0 ? (totalPL / totalCost * 100) : 0;
    const thisYear = new Date().getFullYear().toString();
    const yearPL = records.filter(r => r.date.startsWith(thisYear)).reduce((s, r) => s + r.realizedPL, 0);
    const plClass = totalPL >= 0 ? 'amount-income' : 'amount-expense';
    const yearPlClass = yearPL >= 0 ? 'amount-income' : 'amount-expense';
    el('realizedSummaryCards').innerHTML = `
      <div class="card summary-card ${totalPL >= 0 ? 'income' : 'expense'}">
        <div class="card-icon"><i class="fas fa-chart-line"></i></div>
        <div class="card-info">
          <span class="card-label">總實現損益</span>
          <span class="card-value ${plClass}">${totalPL >= 0 ? '+' : ''}${fmt(totalPL)}</span>
        </div>
      </div>
      <div class="card summary-card" style="border-left-color:#6366f1">
        <div class="card-icon" style="background:#ede9fe;color:#6366f1"><i class="fas fa-percent"></i></div>
        <div class="card-info">
          <span class="card-label">整體報酬率</span>
          <span class="card-value ${plClass}">${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%</span>
        </div>
      </div>
      <div class="card summary-card" style="border-left-color:#f59e0b">
        <div class="card-icon" style="background:#fef3c7;color:#f59e0b"><i class="fas fa-calendar-check"></i></div>
        <div class="card-info">
          <span class="card-label">今年實現損益</span>
          <span class="card-value ${yearPlClass}">${yearPL >= 0 ? '+' : ''}${fmt(yearPL)}</span>
        </div>
      </div>
      <div class="card summary-card" style="border-left-color:#64748b">
        <div class="card-icon" style="background:#f1f5f9;color:#64748b"><i class="fas fa-receipt"></i></div>
        <div class="card-info">
          <span class="card-label">已實現筆數</span>
          <span class="card-value">${records.length} 筆</span>
        </div>
      </div>`;

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-hint">尚無已實現的賣出紀錄</td></tr>';
      return;
    }
    tbody.innerHTML = records.map(r => {
      const plClass = r.realizedPL >= 0 ? 'amount-income' : 'amount-expense';
      const rateSign = r.returnRate >= 0 ? '+' : '';
      const feeAndTax = r.fee + r.tax;
      return `<tr>
        <td>${r.date}</td>
        <td>${escHtml(r.symbol)} ${escHtml(r.name)}</td>
        <td>${r.shares.toLocaleString()}</td>
        <td>$${Number(r.sellPrice).toLocaleString()}</td>
        <td>$${Number(r.costPerShare).toLocaleString()}</td>
        <td>${fmt(feeAndTax)}</td>
        <td class="${plClass}">${r.realizedPL >= 0 ? '+' : ''}${fmt(r.realizedPL)}</td>
        <td class="${plClass}">${rateSign}${r.returnRate.toFixed(2)}%</td>
      </tr>`;
    }).join('');
  }

  // ─── TWSE 查詢 ───
  // 台灣時間資訊（UTC+8），由前端判斷，避免依賴 server 時區
  function getTaiwanTime() {
    const now = new Date();
    const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return {
      day: tw.getUTCDay(),               // 0=日, 6=六
      minutes: tw.getUTCHours() * 60 + tw.getUTCMinutes(),
      dateStr: tw.toISOString().slice(0, 10).replace(/-/g, ''), // YYYYMMDD
    };
  }

  // 取得 TWSE API 路徑（依台灣時間決定資料來源）
  // 盤中 09:00-13:30 → realtime=1（即時成交價）
  // 盤後 13:30-24:00 平日 → date=YYYYMMDD（今日收盤價，STOCK_DAY API）
  // 假日 / 其他 → 無參數（STOCK_DAY_ALL 備援）
  function twseStockUrl(symbol) {
    const base = '/api/twse/stock/' + encodeURIComponent(symbol);
    const { day, minutes, dateStr } = getTaiwanTime();
    const isWeekday = day >= 1 && day <= 5;
    if (!isWeekday) return base; // 假日 → 備援
    if (minutes >= 9 * 60 && minutes < 13 * 60 + 30) {
      return base + '?realtime=1';       // 盤中 → 即時報價
    }
    if (minutes >= 13 * 60 + 30) {
      return base + '?date=' + dateStr;  // 盤後 → 今日收盤（STOCK_DAY）
    }
    return base; // 盤前（09:00 前）→ 備援
  }

  function formatTwsePriceLabel(result) {
    const label = result.priceType || '收盤價';
    const dateInfo = result.isRealtime && result.dataTime
      ? result.dataTime           // 盤中：顯示時間 HH:MM
      : (result.dataDate || '');  // 盤後/收盤：顯示日期 YYYY/MM/DD
    return dateInfo ? `${label} $${result.closingPrice}（${dateInfo}）` : `${label} $${result.closingPrice}`;
  }

  async function lookupTwseStock(symbol) {
    try {
      const result = await API.get(twseStockUrl(symbol));
      if (result.found) {
        el('stkName').value = result.name;
        el('stkPrice').value = result.closingPrice;
        el('stkLookupStatus').textContent = `✓ ${result.name} ${formatTwsePriceLabel(result)}`;
        el('stkLookupStatus').className = 'stk-lookup-status success';
      } else {
        el('stkLookupStatus').textContent = '找不到此股票代號';
        el('stkLookupStatus').className = 'stk-lookup-status error';
      }
    } catch (e) {
      el('stkLookupStatus').textContent = '查詢失敗';
      el('stkLookupStatus').className = 'stk-lookup-status error';
    }
  }

  // 交易/股利 Modal 用：查詢股票代號，先檢查已有持倉，再查 TWSE
  async function lookupStockSymbol(symbol, prefix) {
    const statusEl = el(prefix + 'LookupStatus');
    const idEl = el(prefix + 'StockId');
    // 先查已有持倉
    const existing = cachedStocks.find(s => s.symbol === symbol);
    if (existing) {
      idEl.value = existing.id;
      statusEl.textContent = `✓ ${existing.symbol} ${existing.name}（已有持倉）`;
      statusEl.className = 'stk-lookup-status success';
      return;
    }
    // 查 TWSE
    try {
      const result = await API.get(twseStockUrl(symbol));
      if (result.found) {
        idEl.value = '__new__';
        statusEl.textContent = `✓ ${result.name} ${formatTwsePriceLabel(result)}（將自動新增）`;
        statusEl.className = 'stk-lookup-status success';
        statusEl.dataset.twseName = result.name;
        statusEl.dataset.twsePrice = result.closingPrice;
      } else {
        idEl.value = '';
        statusEl.textContent = '找不到此股票代號';
        statusEl.className = 'stk-lookup-status error';
      }
    } catch (e) {
      idEl.value = '';
      statusEl.textContent = '查詢失敗';
      statusEl.className = 'stk-lookup-status error';
    }
  }

  // 自動建立股票（若尚未存在）
  async function ensureStockBySymbol(symbol, prefix) {
    const idEl = el(prefix + 'StockId');
    const statusEl = el(prefix + 'LookupStatus');
    // 如果已有 ID（既有持倉），直接回傳
    if (idEl.value && idEl.value !== '__new__') return idEl.value;
    // 需要自動新增
    const name = statusEl.dataset.twseName || symbol;
    const price = Number(statusEl.dataset.twsePrice) || 0;
    try {
      const res = await API.post('/api/stocks', { symbol, name });
      if (price > 0) {
        await API.put('/api/stocks/' + res.id, { name, currentPrice: price });
      }
      await refreshStocks();
      populateStockFilters();
      return res.id;
    } catch (err) {
      // 可能已存在（race condition），重新查找
      await refreshStocks();
      const s = cachedStocks.find(s => s.symbol === symbol);
      if (s) return s.id;
      throw err;
    }
  }

  async function fetchTwsePrices() {
    const btn = el('fetchTwsePricesBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 查詢中...';
    try {
      let updated = 0;
      let isRealtime = false;
      const inputs = document.querySelectorAll('#priceUpdateList .price-input');
      for (const inp of inputs) {
        const stockId = inp.dataset.stockId;
        const stock = cachedStocks.find(s => s.id === stockId);
        if (!stock) continue;
        const result = await API.get(twseStockUrl(stock.symbol));
        const label = document.querySelector(`.price-source-label[data-stock-id="${stockId}"]`);
        if (result.found && result.closingPrice > 0) {
          inp.value = result.closingPrice;
          updated++;
          if (result.isRealtime) isRealtime = true;
          // 顯示價格來源與時間
          if (label) {
            const sourceText = formatTwsePriceLabel(result);
            label.innerHTML = `<span class="price-dot"></span>${escHtml(sourceText)}`;
            label.classList.add('success');
          }
        } else if (label) {
          label.innerHTML = '<span class="price-dot"></span>查無資料';
          label.classList.add('error');
        }
      }
      const priceLabel = isRealtime ? '即時成交價' : '收盤價';
      toast(`已從證交所更新 ${updated} 檔股價（${priceLabel}）`, 'success');
    } catch (e) {
      toast('取得股價失敗：' + e.message, 'error');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-cloud-arrow-down"></i> 從證交所取得最新股價';
  }

  // ─── 股票 Modal ───
  function openStockModal(stockId) {
    const form = el('stockForm');
    form.reset();
    if (stockId) {
      const s = cachedStocks.find(x => x.id === stockId);
      if (!s) return;
      el('stkId').value = s.id;
      el('stkSymbol').value = s.symbol;
      el('stkName').value = s.name;
      el('stkType').value = s.stock_type || 'stock';
      el('stkPrice').value = s.current_price || 0;
      el('modalStockTitle').textContent = '編輯股票';
      el('stkSymbol').readOnly = true;
    } else {
      el('stkId').value = '';
      el('stkType').value = 'stock';
      el('modalStockTitle').textContent = '新增股票';
      el('stkSymbol').readOnly = false;
    }
    openModal('modalStock');
  }

  async function handleStockSave(e) {
    e.preventDefault();
    const id = el('stkId').value;
    const symbol = el('stkSymbol').value.trim();
    const name = el('stkName').value.trim();
    const stockType = el('stkType').value || 'stock';
    const currentPrice = Number(el('stkPrice').value) || 0;
    if (!symbol || !name) return;
    try {
      if (id) {
        await API.put('/api/stocks/' + id, { name, currentPrice, stockType });
      } else {
        await API.post('/api/stocks', { symbol, name, stockType });
        if (currentPrice > 0) {
          await refreshStocks();
          const newStock = cachedStocks.find(s => s.symbol === symbol);
          if (newStock) await API.put('/api/stocks/' + newStock.id, { name, currentPrice, stockType });
        }
      }
      closeModal('modalStock');
      toast(id ? '股票已更新' : '股票已新增', 'success');
      await refreshStocks();
      renderStockPortfolio();
      populateStockFilters();
    } catch (err) { toast(err.message, 'error'); }
  }

  function openStockTxModal(txId) {
    const form = el('stockTxForm');
    form.reset();
    el('stkTxDate').value = today();
    el('stkTxTaxRow').style.display = 'none';
    el('stkTxSymbol').readOnly = false;
    el('stkTxStockId').value = '';
    el('stkTxLookupStatus').textContent = '';
    el('stkTxLookupStatus').className = 'stk-lookup-status';
    el('stkTxAccount').innerHTML = '<option value="">不指定</option>' + cachedAccounts.map(a => `<option value="${a.id}">${escHtml(a.name)}</option>`).join('');
    if (txId) {
      (async () => {
        const txs = await API.get('/api/stock-transactions');
        const t = txs.find(x => x.id === txId);
        if (!t) return;
        el('stkTxId').value = t.id;
        el('modalStockTxTitle').textContent = '編輯股票交易';
        form.querySelector(`input[name="stkTxType"][value="${t.type}"]`).checked = true;
        // 找到股票代號填入
        const stock = cachedStocks.find(s => s.id === t.stock_id);
        el('stkTxSymbol').value = stock ? stock.symbol : '';
        el('stkTxStockId').value = t.stock_id;
        if (stock) {
          el('stkTxLookupStatus').textContent = `✓ ${stock.symbol} ${stock.name}`;
          el('stkTxLookupStatus').className = 'stk-lookup-status success';
        }
        el('stkTxShares').value = t.shares;
        el('stkTxPrice').value = t.price;
        el('stkTxDate').value = t.date;
        el('stkTxFee').value = t.fee;
        el('stkTxTax').value = t.tax;
        el('stkTxTaxRow').style.display = t.type === 'sell' ? '' : 'none';
        el('stkTxAccount').value = t.account_id || '';
        el('stkTxNote').value = t.note || '';
        calcStockTxSummary();
      })();
    } else {
      el('stkTxId').value = '';
      el('modalStockTxTitle').textContent = '新增股票交易';
      form.querySelector('input[name="stkTxType"][value="buy"]').checked = true;
      el('stkTxTotal').textContent = 'NT$ 0';
    }
    openModal('modalStockTx');
  }

  function calcStockTxSummary() {
    const shares = Number(el('stkTxShares').value) || 0;
    const price = Number(el('stkTxPrice').value) || 0;
    const amount = shares * price;
    const isBuy = document.querySelector('input[name="stkTxType"]:checked')?.value === 'buy';
    const fee = calcStockFeeBySettings(amount, shares);
    el('stkTxFee').value = fee;
    let tax = 0;
    if (!isBuy && amount > 0) {
      const stockId = el('stkTxStockId').value;
      const stock = cachedStocks.find(s => s.id === stockId);
      tax = calcStockTaxBySettings(amount, stock?.stock_type || 'stock');
    }
    el('stkTxTax').value = tax;
    const total = isBuy ? (amount + fee) : (amount - fee - tax);
    el('stkTxTotal').textContent = fmt(Math.round(total));
  }

  function normalizeStockCalcSettings(raw = {}) {
    const n = {
      feeRate: Number(raw.feeRate),
      feeDiscount: Number(raw.feeDiscount),
      feeMinLot: Number(raw.feeMinLot),
      feeMinOdd: Number(raw.feeMinOdd),
      sellTaxRateStock: Number(raw.sellTaxRateStock),
      sellTaxRateEtf: Number(raw.sellTaxRateEtf),
      sellTaxRateWarrant: Number(raw.sellTaxRateWarrant),
      sellTaxMin: Number(raw.sellTaxMin),
    };
    return {
      feeRate: Number.isFinite(n.feeRate) && n.feeRate > 0 ? n.feeRate : DEFAULT_STOCK_CALC_SETTINGS.feeRate,
      feeDiscount: Number.isFinite(n.feeDiscount) && n.feeDiscount > 0 ? n.feeDiscount : DEFAULT_STOCK_CALC_SETTINGS.feeDiscount,
      feeMinLot: Number.isFinite(n.feeMinLot) && n.feeMinLot >= 0 ? Math.round(n.feeMinLot) : DEFAULT_STOCK_CALC_SETTINGS.feeMinLot,
      feeMinOdd: Number.isFinite(n.feeMinOdd) && n.feeMinOdd >= 0 ? Math.round(n.feeMinOdd) : DEFAULT_STOCK_CALC_SETTINGS.feeMinOdd,
      sellTaxRateStock: Number.isFinite(n.sellTaxRateStock) && n.sellTaxRateStock >= 0 ? n.sellTaxRateStock : DEFAULT_STOCK_CALC_SETTINGS.sellTaxRateStock,
      sellTaxRateEtf: Number.isFinite(n.sellTaxRateEtf) && n.sellTaxRateEtf >= 0 ? n.sellTaxRateEtf : DEFAULT_STOCK_CALC_SETTINGS.sellTaxRateEtf,
      sellTaxRateWarrant: Number.isFinite(n.sellTaxRateWarrant) && n.sellTaxRateWarrant >= 0 ? n.sellTaxRateWarrant : DEFAULT_STOCK_CALC_SETTINGS.sellTaxRateWarrant,
      sellTaxMin: Number.isFinite(n.sellTaxMin) && n.sellTaxMin >= 0 ? Math.round(n.sellTaxMin) : DEFAULT_STOCK_CALC_SETTINGS.sellTaxMin,
    };
  }

  async function loadStockCalcSettings() {
    try {
      const data = await API.get('/api/stock-settings');
      stockCalcSettings = normalizeStockCalcSettings(data || {});
    } catch {
      stockCalcSettings = { ...DEFAULT_STOCK_CALC_SETTINGS };
    }
  }

  function calcStockFeeBySettings(amount, shares) {
    if (!(amount > 0)) return 0;
    const feeBase = Math.floor(amount * stockCalcSettings.feeRate * stockCalcSettings.feeDiscount);
    const minFee = shares < 1000 ? stockCalcSettings.feeMinOdd : stockCalcSettings.feeMinLot;
    return Math.max(minFee, feeBase);
  }

  function getSellTaxRateByType(stockType) {
    if (stockType === 'etf') return stockCalcSettings.sellTaxRateEtf;
    if (stockType === 'warrant') return stockCalcSettings.sellTaxRateWarrant;
    return stockCalcSettings.sellTaxRateStock;
  }

  function calcStockTaxBySettings(amount, stockType) {
    if (!(amount > 0)) return 0;
    const tax = Math.floor(amount * getSellTaxRateByType(stockType));
    return Math.max(stockCalcSettings.sellTaxMin, tax);
  }

  function renderStockSettingsPanel() {
    const form = el('stockSettingsForm');
    if (!form) return;
    el('stockFeeRate').value = stockCalcSettings.feeRate;
    el('stockFeeDiscount').value = stockCalcSettings.feeDiscount;
    el('stockFeeMinLot').value = stockCalcSettings.feeMinLot;
    el('stockFeeMinOdd').value = stockCalcSettings.feeMinOdd;
    el('stockTaxRateStock').value = stockCalcSettings.sellTaxRateStock;
    el('stockTaxRateEtf').value = stockCalcSettings.sellTaxRateEtf;
    el('stockTaxRateWarrant').value = stockCalcSettings.sellTaxRateWarrant;
    el('stockTaxMin').value = stockCalcSettings.sellTaxMin;
  }

  async function saveStockCalcSettings(e) {
    e.preventDefault();
    const payload = {
      feeRate: Number(el('stockFeeRate').value),
      feeDiscount: Number(el('stockFeeDiscount').value),
      feeMinLot: Number(el('stockFeeMinLot').value),
      feeMinOdd: Number(el('stockFeeMinOdd').value),
      sellTaxRateStock: Number(el('stockTaxRateStock').value),
      sellTaxRateEtf: Number(el('stockTaxRateEtf').value),
      sellTaxRateWarrant: Number(el('stockTaxRateWarrant').value),
      sellTaxMin: Number(el('stockTaxMin').value),
    };
    try {
      const saved = await API.put('/api/stock-settings', payload);
      stockCalcSettings = normalizeStockCalcSettings(saved || payload);
      renderStockSettingsPanel();
      calcStockTxSummary();
      await refreshStocks();
      renderStockPortfolio();
      await renderStockRealized();
      toast('股票交易設定已儲存', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function renderStockRecurringList() {
    const tbody = el('stockRecurringBody');
    if (!tbody) return;
    const recs = await API.get('/api/stock-recurring');
    if (!recs.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-hint">尚未設定股票定期定額</td></tr>';
      return;
    }
    tbody.innerHTML = recs.map(r => {
      const statusText = r.isActive ? '啟用中' : '已停用';
      const statusCls = r.isActive ? 'active' : 'paused';
      const stockText = `${escHtml(r.symbol || '')} ${escHtml(r.stockName || '')}`.trim();
      return `<tr>
        <td>${stockText || '-'}</td>
        <td>${fmt(r.amount || 0)}</td>
        <td>${FREQ_LABELS[r.frequency] || r.frequency}</td>
        <td>${r.startDate || r.start_date || '-'}</td>
        <td>${r.lastGenerated || r.last_generated || '-'}</td>
        <td><span class="recurring-status ${statusCls}">${statusText}</span></td>
        <td>${escHtml(r.note || '') || '-'}</td>
        <td>
          <button class="btn-icon" onclick="App.toggleStockRecurring('${r.id}')" title="${r.isActive ? '停用' : '啟用'}"><i class="fas ${r.isActive ? 'fa-pause' : 'fa-play'}"></i></button>
          <button class="btn-icon" onclick="App.editStockRecurring('${r.id}')" title="編輯"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="App.deleteStockRecurring('${r.id}')" title="刪除"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  async function openStockRecurringModal(recId) {
    const form = el('stockRecurringForm');
    if (!form) return;
    form.reset();
    el('stockRecStartDate').value = today();
    el('stockRecStockId').innerHTML = cachedStocks
      .map(s => `<option value="${s.id}">${escHtml(s.symbol)} ${escHtml(s.name)}</option>`)
      .join('');
    el('stockRecAccount').innerHTML = '<option value="">不指定</option>' + cachedAccounts
      .map(a => `<option value="${a.id}">${escHtml(a.name)}</option>`)
      .join('');
    if (recId) {
      const recs = await API.get('/api/stock-recurring');
      const r = recs.find(x => x.id === recId);
      if (!r) return;
      el('stockRecId').value = r.id;
      el('modalStockRecurringTitle').textContent = '編輯股票定期定額';
      el('stockRecStockId').value = r.stockId || r.stock_id;
      el('stockRecAmount').value = r.amount || 0;
      el('stockRecFrequency').value = r.frequency;
      el('stockRecStartDate').value = r.startDate || r.start_date;
      el('stockRecAccount').value = r.accountId || r.account_id || '';
      el('stockRecNote').value = r.note || '';
    } else {
      el('stockRecId').value = '';
      el('modalStockRecurringTitle').textContent = '新增股票定期定額';
    }
    openModal('modalStockRecurring');
  }

  async function handleStockRecurringSave(e) {
    e.preventDefault();
    const id = el('stockRecId').value;
    const payload = {
      stockId: el('stockRecStockId').value,
      amount: Number(el('stockRecAmount').value),
      frequency: el('stockRecFrequency').value,
      startDate: el('stockRecStartDate').value,
      accountId: el('stockRecAccount').value,
      note: el('stockRecNote').value.trim(),
    };
    try {
      if (id) await API.put('/api/stock-recurring/' + id, payload);
      else await API.post('/api/stock-recurring', payload);
      closeModal('modalStockRecurring');
      toast(id ? '股票定期定額已更新' : '股票定期定額已新增', 'success');
      await renderStockRecurringList();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function deleteStockRecurring(id) {
    confirmDelete('確定要刪除此股票定期定額嗎？', async () => {
      await API.del('/api/stock-recurring/' + id);
      toast('股票定期定額已刪除', 'success');
      await renderStockRecurringList();
    });
  }

  async function toggleStockRecurring(id) {
    await API.patch('/api/stock-recurring/' + id + '/toggle');
    await renderStockRecurringList();
  }

  async function handleStockTxSave(e) {
    e.preventDefault();
    const id = el('stkTxId').value;
    const type = document.querySelector('input[name="stkTxType"]:checked')?.value;
    const symbol = el('stkTxSymbol').value.trim();
    const shares = Number(el('stkTxShares').value);
    const price = Number(el('stkTxPrice').value);
    const date = el('stkTxDate').value;
    const fee = Number(el('stkTxFee').value) || 0;
    const tax = Number(el('stkTxTax').value) || 0;
    const accountId = el('stkTxAccount').value;
    const note = el('stkTxNote').value.trim();
    if (!symbol || !shares || !price || !date) return;
    // 確認股票存在或自動新增
    let stockId = el('stkTxStockId').value;
    if (!stockId) {
      toast('請輸入有效的股票代號', 'error');
      return;
    }
    try {
      if (stockId === '__new__') {
        stockId = await ensureStockBySymbol(symbol, 'stkTx');
      }
      if (id) {
        await API.put('/api/stock-transactions/' + id, { date, type, shares, price, fee, tax, accountId, note });
      } else {
        await API.post('/api/stock-transactions', { stockId, date, type, shares, price, fee, tax, accountId, note });
      }
      closeModal('modalStockTx');
      toast(id ? '交易已更新' : '交易已新增', 'success');
      await refreshStocks();
      renderStockPortfolio();
      await renderStockTransactions();
      await renderStockRealized();
    } catch (err) { toast(err.message, 'error'); }
  }

  function openStockDivModal(divId) {
    const form = el('stockDivForm');
    form.reset();
    el('stkDivDate').value = today();
    el('stkDivSymbol').readOnly = false;
    el('stkDivStockId').value = '';
    el('stkDivLookupStatus').textContent = '';
    el('stkDivLookupStatus').className = 'stk-lookup-status';
    el('stkDivAccount').innerHTML = '<option value="">不指定</option>' + cachedAccounts.map(a => `<option value="${a.id}">${escHtml(a.name)}</option>`).join('');
    if (divId) {
      (async () => {
        const divs = await API.get('/api/stock-dividends');
        const d = divs.find(x => x.id === divId);
        if (!d) return;
        el('stkDivId').value = d.id;
        el('modalStockDivTitle').textContent = '編輯股利';
        const stock = cachedStocks.find(s => s.id === d.stock_id);
        el('stkDivSymbol').value = stock ? stock.symbol : '';
        el('stkDivStockId').value = d.stock_id;
        if (stock) {
          el('stkDivLookupStatus').textContent = `✓ ${stock.symbol} ${stock.name}`;
          el('stkDivLookupStatus').className = 'stk-lookup-status success';
        }
        el('stkDivDate').value = d.date;
        el('stkDivCash').value = d.cash_dividend;
        el('stkDivSharesAmt').value = d.stock_dividend_shares || 0;
        el('stkDivAccount').value = d.account_id || '';
        el('stkDivNote').value = d.note || '';
      })();
    } else {
      el('stkDivId').value = '';
      el('modalStockDivTitle').textContent = '新增股利';
    }
    openModal('modalStockDiv');
  }

  async function handleStockDivSave(e) {
    e.preventDefault();
    const id = el('stkDivId').value;
    const symbol = el('stkDivSymbol').value.trim();
    const date = el('stkDivDate').value;
    const cashDividend = Number(el('stkDivCash').value) || 0;
    const stockDividendShares = Number(el('stkDivSharesAmt').value) || 0;
    const accountId = el('stkDivAccount').value;
    const note = el('stkDivNote').value.trim();
    if (!symbol || !date) return;
    let stockId = el('stkDivStockId').value;
    if (!stockId) {
      toast('請輸入有效的股票代號', 'error');
      return;
    }
    try {
      if (stockId === '__new__') {
        stockId = await ensureStockBySymbol(symbol, 'stkDiv');
      }
      if (id) {
        await API.put('/api/stock-dividends/' + id, { date, cashDividend, stockDividendShares, accountId, note });
      } else {
        await API.post('/api/stock-dividends', { stockId, date, cashDividend, stockDividendShares, accountId, note });
      }
      closeModal('modalStockDiv');
      toast(id ? '股利已更新' : '股利已新增', 'success');
      await refreshStocks();
      renderStockPortfolio();
      await renderStockDividends();
    } catch (err) { toast(err.message, 'error'); }
  }

  function openPriceUpdateModal() {
    const list = el('priceUpdateList');
    // 只顯示目前有持股的股票
    const holdingStocks = cachedStocks.filter(s => s.totalShares > 0);
    list.innerHTML = holdingStocks.map(s => `<div class="price-update-row">
      <div class="stock-info">
        <div><span class="stock-symbol">${escHtml(s.symbol)}</span><span class="stock-name">${escHtml(s.name)}</span></div>
        <div class="price-source-label" data-stock-id="${s.id}"></div>
      </div>
      <input type="number" step="0.0001" min="0" value="${s.currentPrice || 0}" data-stock-id="${s.id}" class="price-input">
    </div>`).join('') || '<p style="padding:20px;text-align:center;color:var(--text-muted)">目前無持股</p>';
    openModal('modalPriceUpdate');
  }

  async function handlePriceUpdateSave() {
    const inputs = document.querySelectorAll('#priceUpdateList .price-input');
    const prices = [];
    inputs.forEach(inp => {
      prices.push({ id: inp.dataset.stockId, currentPrice: Number(inp.value) || 0 });
    });
    try {
      await API.post('/api/stocks/batch-price', { prices });
      closeModal('modalPriceUpdate');
      toast('股價已更新', 'success');
      await refreshStocks();
      renderStockPortfolio();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteStock(id) {
    const s = cachedStocks.find(x => x.id === id);
    const name = s ? `${s.symbol} ${s.name}` : '此股票';
    confirmDelete(`確定要刪除「${name}」嗎？\n將一併刪除所有相關的交易紀錄與股利紀錄，此操作無法復原。`, async () => {
      try {
        await API.del('/api/stocks/' + id);
        toast('股票及相關紀錄已刪除', 'success');
        await refreshStocks();
        renderStockPortfolio();
        populateStockFilters();
        renderStockTransactions();
        renderStockDividends();
        renderStockRealized();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function deleteStockTx(id) {
    confirmDelete('確定要刪除此交易紀錄嗎？', async () => {
      try {
        await API.del('/api/stock-transactions/' + id);
        toast('交易紀錄已刪除', 'success');
        await refreshStocks();
        renderStockPortfolio();
        await renderStockTransactions();
        await renderStockRealized();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function deleteStockDiv(id) {
    confirmDelete('確定要刪除此股利紀錄嗎？', async () => {
      try {
        await API.del('/api/stock-dividends/' + id);
        toast('股利紀錄已刪除', 'success');
        await refreshStocks();
        renderStockPortfolio();
        await renderStockDividends();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ─── 設定 ───
  let settingsBound = false;
  async function renderSettings() {
    if (!settingsBound) {
      // 使用事件委派避免重複綁定問題
      document.querySelector('.settings-tabs')?.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab[data-settings]');
        if (!tab) return;
        const sub = tab.dataset.settings;
        if (sub === 'admin' && !currentUser?.isAdmin) {
          toast('需要管理員權限', 'error');
          return;
        }
        activateSettingsTab(sub);
        history.pushState({ page: 'settings', sub }, '', buildPath('settings', sub));
      });
      settingsBound = true;
    }

    const adminTab = document.querySelector('.settings-tabs .tab[data-settings="admin"]');
    if (adminTab) adminTab.style.display = currentUser?.isAdmin ? '' : 'none';

    bindExport();
    await renderAccountSettings();
    if (currentUser?.isAdmin) {
      await renderAdminSettings();
    }

    const activeSettingsTab = document.querySelector('.settings-tabs .tab.active')?.dataset.settings;
    if (activeSettingsTab === 'admin' && !currentUser?.isAdmin) {
      activateSettingsTab('export');
      history.replaceState({ page: 'settings', sub: 'export' }, '', buildPath('settings', 'export'));
    }
  }

  async function renderCategories() {
    cachedCategories = await API.get('/api/categories');
    const cats = cachedCategories;
    const expCats = cats.filter(c => c.type === 'expense' && !c.isHidden);
    const incCats = cats.filter(c => c.type === 'income' && !c.isHidden);

    el('expenseCategoryList').innerHTML = buildCatHierarchyHtml(expCats);
    el('incomeCategoryList').innerHTML = buildCatHierarchyHtml(incCats);
  }

  function buildCatHierarchyHtml(cats) {
    const parents = cats.filter(c => !c.parentId);
    return parents.map(p => {
      const children = cats.filter(c => c.parentId === p.id);
      let html = catItemHtml(p, false);
      if (children.length > 0) {
        html += '<div class="subcategory-list">';
        html += children.map(c => catItemHtml(c, true)).join('');
        html += '</div>';
      }
      return html;
    }).join('');
  }

  function catItemHtml(c, isSub) {
    const delBtn = `<button class="btn-icon danger" onclick="App.deleteCategory('${c.id}')" title="刪除"><i class="fas fa-trash"></i></button>`;
    const addSubBtn = !isSub
      ? `<button class="btn-icon" onclick="App.openCategoryModal('${c.type}', null, '${c.id}')" title="新增子分類"><i class="fas fa-plus"></i></button>`
      : '';
    const subCls = isSub ? ' category-item-sub' : '';
    return `<div class="category-item${subCls}">
      <div class="category-item-left">
        ${isSub ? '<i class="fas fa-turn-up fa-rotate-90" style="color:var(--text-secondary);font-size:12px;margin-left:4px"></i>' : ''}
        <div class="category-color" style="background:${/^#[0-9a-fA-F]{3,8}$/.test(c.color) ? c.color : '#ccc'}"></div>
        <span>${escHtml(c.name)}</span>
      </div>
      <div class="category-item-actions">
        ${addSubBtn}
        <button class="btn-icon" onclick="App.editCategory('${c.id}')" title="編輯"><i class="fas fa-pen"></i></button>
        ${delBtn}
      </div>
    </div>`;
  }

  async function renderRecurring() {
    const recs = await API.get('/api/recurring');
    const container = el('recurringList');
    if (recs.length === 0) {
      container.innerHTML = '<p class="empty-hint">尚無固定收支</p>';
    } else {
      container.innerHTML = recs.map(r => {
        const cat = getCat(r.categoryId);
        const acc = getAcc(r.accountId);
        const statusCls = r.isActive ? 'active' : 'paused';
        const statusText = r.isActive ? '啟用' : '暫停';
        const typeBadge = r.type === 'income'
          ? '<span class="type-badge income">收入</span>'
          : '<span class="type-badge expense">支出</span>';
        return `<div class="recurring-item">
          <div class="recurring-info">
            ${typeBadge}
            <span style="font-weight:600">${fmt(r.amount)}</span>
            <span>${cat ? escHtml(cat.name) : '-'}</span>
            <span>${acc ? escHtml(acc.name) : '-'}</span>
            <span>${FREQ_LABELS[r.frequency] || r.frequency}</span>
            <span class="recurring-status ${statusCls}">${statusText}</span>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn-icon" onclick="App.toggleRecurring('${r.id}')" title="${r.isActive ? '暫停' : '啟用'}">
              <i class="fas ${r.isActive ? 'fa-pause' : 'fa-play'}"></i>
            </button>
            <button class="btn-icon" onclick="App.editRecurring('${r.id}')" title="編輯"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" onclick="App.deleteRecurring('${r.id}')" title="刪除"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
      }).join('');
    }
    el('addRecurringBtn').onclick = () => openRecurringModal();
  }

  // CSV 下載輔助
  function downloadCsv(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // 讀取檔案為文字
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsText(file, 'utf-8');
    });
  }

  // ─── 股票交易紀錄 匯出 ───
  async function exportStockTx() {
    const txs = await API.get('/api/stock-transactions');
    const BOM = '\uFEFF';
    let csv = BOM + '日期,股票代號,股票名稱,類型,股數,成交價,手續費,交易稅,帳戶,備註\n';
    txs.forEach(t => {
      const acc = cachedAccounts.find(a => a.id === t.account_id);
      const type = t.type === 'buy' ? '買進' : '賣出';
      csv += `${t.date},"${escCsv(t.symbol || '')}","${escCsv(t.stock_name || '')}",${type},${t.shares},${t.price},${t.fee || 0},${t.tax || 0},"${escCsv(acc?.name || '')}","${escCsv(t.note || '')}"\n`;
    });
    downloadCsv(csv, `股票交易紀錄_${today()}.csv`);
    toast(`已匯出 ${txs.length} 筆股票交易紀錄`, 'success');
  }

  // ─── 股票股利紀錄 匯出 ───
  async function exportStockDiv() {
    const divs = await API.get('/api/stock-dividends');
    const BOM = '\uFEFF';
    let csv = BOM + '日期,股票代號,股票名稱,現金股利,股票股利,備註\n';
    divs.forEach(d => {
      csv += `${d.date},"${escCsv(d.symbol || '')}","${escCsv(d.stock_name || '')}",${d.cash_dividend || 0},${d.stock_dividend_shares || 0},"${escCsv(d.note || '')}"\n`;
    });
    downloadCsv(csv, `股票股利紀錄_${today()}.csv`);
    toast(`已匯出 ${divs.length} 筆股票股利紀錄`, 'success');
  }

  // ─── 股票紀錄 匯入（交易 / 股利） ───
  async function importStockCsv(file, mode) {
    const resultEl = el('stockImportResult');
    resultEl.style.display = 'none';
    try {
      const text = await readFileAsText(file);
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      if (lines.length < 2) { toast('CSV 內容不足（至少需要標題列與一筆資料）', 'error'); return; }

      let rows, endpoint;
      if (mode === 'tx') {
        // 交易：日期,代號,名稱,類型,股數,成交價,手續費,交易稅,帳戶,備註
        rows = lines.slice(1).map(line => {
          const c = parseCsvLine(line);
          return { date: c[0]?.trim(), symbol: c[1]?.trim(), name: c[2]?.trim(), type: c[3]?.trim(),
                   shares: c[4]?.trim(), price: c[5]?.trim(), fee: c[6]?.trim(),
                   tax: c[7]?.trim(), accountName: c[8]?.trim(), note: c[9]?.trim() };
        }).filter(r => r.date && r.symbol);
        endpoint = '/api/stock-transactions/import';
      } else {
        // 股利：日期,代號,名稱,現金股利,股票股利,備註
        rows = lines.slice(1).map(line => {
          const c = parseCsvLine(line);
          return { date: c[0]?.trim(), symbol: c[1]?.trim(), name: c[2]?.trim(),
                   cashDividend: c[3]?.trim(), stockDividend: c[4]?.trim(), note: c[5]?.trim() };
        }).filter(r => r.date && r.symbol);
        endpoint = '/api/stock-dividends/import';
      }

      if (rows.length === 0) { toast('沒有可解析的資料', 'error'); return; }

      const result = await API.post(endpoint, { rows });
      await refreshStocks();

      const label = mode === 'tx' ? '股票交易紀錄' : '股票股利紀錄';
      resultEl.style.display = '';
      resultEl.innerHTML = `<div class="import-result" style="padding:10px;border-radius:8px;background:var(--income-bg);color:var(--income)">
        ✓ 匯入完成：成功 <strong>${result.imported}</strong> 筆${result.skipped ? `，略過 ${result.skipped} 筆` : ''}
        ${result.errors?.length ? `<div style="color:var(--danger);font-size:12px;margin-top:4px">${result.errors.slice(0, 5).map(e => escHtml(e)).join('<br>')}</div>` : ''}
      </div>`;
      if (result.imported > 0) toast(`已匯入 ${result.imported} 筆${label}`, 'success');
    } catch (e) {
      toast('匯入失敗：' + e.message, 'error');
    }
  }

  let accountSettingsBound = false;
  let exchangeRatesBound = false;
  let adminSettingsBound = false;
  let adminCertsBound = false;
  let selectedAdminLoginLogIds = new Set();
  let selectedAdminAllLoginLogIds = new Set();
  let adminLoginLogPage = 1, adminLoginLogPageSize = 20;
  let adminAllLoginLogPage = 1, adminAllLoginLogPageSize = 20;
  let _cachedAdminLoginLogs = [];
  let _cachedAdminAllLoginLogs = [];

  function appendFxRateRow(currency = 'USD', rateToTwd = '', isFixedRow = false) {
    const tbody = el('fxRateTableBody');
    if (!tbody) return;
    const raw = String(currency || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    const c = /^[A-Z]{3}$/.test(raw) ? raw : '';
    const isTwdFixed = isFixedRow && c === 'TWD';
    const disabled = isTwdFixed ? 'readonly' : '';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input class="fx-currency" type="text" maxlength="3" value="${c}" list="fxCurrencySuggestionList" placeholder="例如 USD" ${disabled}></td>
      <td><input class="fx-rate" type="number" min="0.000001" step="0.000001" value="${rateToTwd || ''}" ${isTwdFixed ? 'readonly' : ''}></td>
      <td>${isTwdFixed ? '<span class="import-hint">固定</span>' : '<button type="button" class="btn-icon danger fx-delete-btn" title="刪除"><i class="fas fa-trash"></i></button>'}</td>
    `;
    if (isFixedRow) row.dataset.fixedCurrency = '1';
    tbody.appendChild(row);
    refreshFxCurrencySuggestionList([c]);
  }

  function updateFxAutoStatus(settings) {
    const statusEl = el('fxAutoStatus');
    const toggle = el('fxAutoUpdateToggle');
    if (!statusEl || !toggle) return;
    const autoUpdate = !!settings?.autoUpdate;
    const lastSyncedAt = Number(settings?.lastSyncedAt) || 0;
    toggle.checked = autoUpdate;

    if (!autoUpdate) {
      statusEl.textContent = '目前為手動更新模式；基礎貨幣為 TWD。';
      return;
    }

    if (lastSyncedAt > 0) {
      const ts = localDateTimeStr(lastSyncedAt);
      statusEl.textContent = `已啟用自動更新；上次取得：${ts || '時間格式錯誤'}`;
    } else {
      statusEl.textContent = '已啟用自動更新；尚未同步即時匯率。';
    }
  }

  async function renderExchangeRateSettings() {
    try {
      const res = await API.get('/api/exchange-rates');
      const tbody = el('fxRateTableBody');
      if (!tbody) return;

      const rates = Array.isArray(res.rates) ? res.rates : [];
      const map = { TWD: 1 };
      rates.forEach(r => {
        const c = normalizeCurrencyCode(r.currency);
        const rate = Number(r.rateToTwd);
        if (rate > 0) map[c] = rate;
      });
      cachedExchangeRates = map;
      renderCurrencySelectOptions('txCurrency', el('txCurrency')?.value || 'TWD');
      renderCurrencySelectOptions('accCurrency', el('accCurrency')?.value || 'TWD');
      refreshFxCurrencySuggestionList(Object.keys(map));

      tbody.innerHTML = '';
      appendFxRateRow('TWD', 1, true);
      Object.entries(map)
        .filter(([c]) => c !== 'TWD')
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([currency, rate]) => appendFxRateRow(currency, rate, false));

      updateFxAutoStatus(res.settings || {});
    } catch (e) {
      console.error('載入匯率設定失敗:', e);
    }
  }

  function bindExchangeRateSettingsIfNeeded() {
    if (exchangeRatesBound) return;
    if (!el('fxRateTableBody') || !el('addFxRateBtn') || !el('saveFxRateBtn')) return;

    el('addFxRateBtn')?.addEventListener('click', () => appendFxRateRow('', ''));
    el('refreshGlobalFxBtn')?.addEventListener('click', async () => {
      try {
        const rows = Array.from(document.querySelectorAll('#fxRateTableBody tr'));
        const currencies = [];
        const seen = new Set();
        for (const row of rows) {
          const raw = row.querySelector('.fx-currency')?.value || '';
          const code = parseCurrencyCodeInput(raw);
          if (!code) {
            toast('請輸入 3 碼英文字母幣別代碼（例如 USD）', 'error');
            return;
          }
          if (seen.has(code)) continue;
          seen.add(code);
          currencies.push(code);
        }
        const result = await API.post('/api/exchange-rates/refresh', { currencies });
        await refreshCache();
        await renderExchangeRateSettings();
        const message = result.message || '已更新全球即時匯率';
        toast(message, 'success');
      } catch (e) {
        const msg = String(e?.message || '');
        if (msg.includes('匯率更新冷卻期中') || msg.includes('距離下次更新還有')) {
          toast('偵測到舊版冷卻期訊息，請重啟後端後再試。', 'warning');
          return;
        }
        toast(msg || '更新即時匯率失敗', 'error');
      }
    });

    el('fxAutoUpdateToggle')?.addEventListener('change', async (ev) => {
      const next = !!ev.target?.checked;
      try {
        const result = await API.put('/api/exchange-rates/settings', { autoUpdate: next });
        updateFxAutoStatus(result.settings || { autoUpdate: next });
        toast(next ? '已啟用匯率自動更新' : '已關閉匯率自動更新', 'success');
      } catch (e) {
        if (el('fxAutoUpdateToggle')) el('fxAutoUpdateToggle').checked = !next;
        toast(e.message || '更新匯率自動設定失敗', 'error');
      }
    });

    el('fxRateTableBody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.fx-delete-btn');
      if (!btn) return;
      const row = btn.closest('tr');
      if (row) row.remove();
    });

    el('fxRateTableBody')?.addEventListener('input', (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !input.classList.contains('fx-currency')) return;
      input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    });

    el('fxRateTableBody')?.addEventListener('blur', (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !input.classList.contains('fx-currency')) return;
      input.value = (parseCurrencyCodeInput(input.value) || input.value).toUpperCase();
    }, true);

    el('saveFxRateBtn')?.addEventListener('click', async () => {
      const rows = Array.from(document.querySelectorAll('#fxRateTableBody tr'));
      const seen = new Set();
      const rates = [];

      for (const row of rows) {
        const isFixedRow = row.dataset.fixedCurrency === '1';
        const raw = row.querySelector('.fx-currency')?.value || '';
        const c = parseCurrencyCodeInput(raw);
        
        // 固定列 TWD 直接跳過（後端會自動初始化）
        if (isFixedRow && c === 'TWD') continue;
        
        if (!c) {
          toast('請輸入 3 碼英文字母幣別代碼（例如 USD）', 'error');
          return;
        }
        
        // 非固定列誤填 TWD 時不阻擋整體儲存，直接略過該列
        if (c === 'TWD' && !isFixedRow) {
          continue;
        }
        
        const rate = Number(row.querySelector('.fx-rate')?.value);
        if (seen.has(c)) {
          toast(`幣別重複：${c}`, 'error');
          return;
        }
        seen.add(c);
        
        if (!(rate > 0)) {
          toast(`${c} 匯率必須大於 0`, 'error');
          return;
        }
        rates.push({ currency: c, rateToTwd: rate });
      }

      try {
        await API.put('/api/exchange-rates', { rates });
        await refreshCache();
        await renderExchangeRateSettings();
        toast('匯率已儲存', 'success');
      } catch (e) {
        toast(e.message || '儲存匯率失敗', 'error');
      }
    });

    exchangeRatesBound = true;
  }

  async function renderAccountSettings() {
    try {
      const res = await API.get('/api/auth/me');
      const user = res.user;
      currentUser = { ...(currentUser || {}), ...user };
      el('accountEmail').textContent = user.email || '—';
      el('accountDisplayName').textContent = user.displayName || '—';
      if (el('accountDisplayNameInput')) {
        el('accountDisplayNameInput').value = user.displayName || '';
      }
      updateUserAvatar();
      accountLoginLogs = []; // 重新取得
      await renderAccountLoginLogs();

      const linkedEl = el('googleLinkedInfo');
      const unlinkedEl = el('googleUnlinkedInfo');

      if (user.googleLinked) {
        linkedEl.style.display = '';
        unlinkedEl.style.display = 'none';
      } else {
        linkedEl.style.display = 'none';
        unlinkedEl.style.display = '';
        // 初始化 Google 綁定按鈕
        initGoogleLinkButton();
      }

      // Google-only 帳號（無密碼登入）不需要輸入密碼，隱藏密碼欄位
      const isGoogleOnly = user.googleLinked && !user.hasPassword;
      const pwWrap = el('deleteAccountPasswordWrap');
      if (pwWrap) pwWrap.style.display = isGoogleOnly ? 'none' : '';

      // 修改密碼卡片：依據是否已有密碼切換「修改密碼」/「設定密碼」標題與目前密碼欄位
      const passwordCardTitle = el('accountPasswordCardTitle');
      const passwordHint = el('accountPasswordHint');
      const passwordSubmitText = el('accountPasswordSubmitText');
      const currentPasswordWrap = el('accountCurrentPasswordWrap');
      if (user.hasPassword) {
        if (passwordCardTitle) passwordCardTitle.textContent = '修改密碼';
        if (passwordHint) passwordHint.textContent = '為保護帳號安全，新密碼至少 8 字元，且需包含大寫字母、小寫字母、數字與特殊符號。';
        if (passwordSubmitText) passwordSubmitText.textContent = '更新密碼';
        if (currentPasswordWrap) currentPasswordWrap.style.display = '';
      } else {
        if (passwordCardTitle) passwordCardTitle.textContent = '設定本機密碼';
        if (passwordHint) passwordHint.textContent = '目前帳號僅支援 Google 登入。設定本機密碼後，即可使用電子信箱與密碼登入。';
        if (passwordSubmitText) passwordSubmitText.textContent = '設定密碼';
        if (currentPasswordWrap) currentPasswordWrap.style.display = 'none';
      }

      updateThemeModeControls();

      await renderExchangeRateSettings();
      bindExchangeRateSettingsIfNeeded();
      await renderPasskeyList();

      if (!accountSettingsBound) {
        document.querySelectorAll('input[name="themeMode"]').forEach(input => {
          input.addEventListener('change', async (e) => {
            const nextMode = e.target?.value;
            if (!nextMode) return;
            applyThemeMode(nextMode);
            updateThemeModeControls();
            const synced = await persistThemeModeToServer(nextMode);
            if (synced) {
              if (themeMode === 'system') toast('已切換為跟隨系統主題，且已同步到帳號', 'success');
              else if (themeMode === 'dark') toast('已切換為深色模式，且已同步到帳號', 'success');
              else toast('已切換為淺色模式，且已同步到帳號', 'success');
            } else {
              if (themeMode === 'system') toast('已切換為跟隨系統主題（暫存本機，稍後自動同步）', 'success');
              else if (themeMode === 'dark') toast('已切換為深色模式（暫存本機，稍後自動同步）', 'success');
              else toast('已切換為淺色模式（暫存本機，稍後自動同步）', 'success');
            }
          });
        });

        el('unlinkGoogleBtn').addEventListener('click', async () => {
          if (!confirm('確定要解除 Google 帳號綁定嗎？解除後將無法使用 Google 快速登入。')) return;
          try {
            await API.post('/api/account/unlink-google', {});
            toast('已解除 Google 帳號綁定');
            renderAccountSettings();
          } catch (e) {
            toast(e.message || '解除綁定失敗', 'error');
          }
        });

        el('accountPasswordForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const errEl = el('accountPasswordError');
          const showError = (msg) => {
            if (errEl) {
              errEl.textContent = msg;
              errEl.style.display = '';
            }
          };
          if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
          const isGoogleOnly = currentUser?.googleLinked && !currentUser?.hasPassword;
          const currentPassword = el('accountCurrentPassword')?.value || '';
          const newPassword = el('accountNewPassword')?.value || '';
          const confirmPassword = el('accountNewPasswordConfirm')?.value || '';
          if (!isGoogleOnly && !currentPassword) { showError('請輸入目前密碼'); return; }
          if (!newPassword) { showError('請輸入新密碼'); return; }
          if (newPassword.length < 8) { showError('新密碼長度至少 8 字元'); return; }
          if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) {
            showError('新密碼需包含大寫字母、小寫字母、數字與特殊符號'); return;
          }
          if (newPassword !== confirmPassword) { showError('兩次輸入的新密碼不一致'); return; }
          try {
            await API.put('/api/account/password', {
              currentPassword: isGoogleOnly ? undefined : currentPassword,
              newPassword,
            });
            el('accountPasswordForm')?.reset();
            toast(isGoogleOnly ? '密碼已設定，現在可使用密碼登入' : '密碼已更新', 'success');
            renderAccountSettings();
          } catch (err) {
            showError(err.message || '更新密碼失敗');
          }
        });

        el('accountDisplayNameForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const displayName = (el('accountDisplayNameInput')?.value || '').trim();
          if (!displayName) {
            toast('顯示名稱不可空白', 'error');
            return;
          }
          try {
            const result = await API.put('/api/account/display-name', { displayName });
            currentUser = { ...(currentUser || {}), displayName: result.displayName || displayName };
            el('accountDisplayName').textContent = currentUser.displayName;
            updateUserAvatar();
            toast('顯示名稱已更新', 'success');
          } catch (err) {
            toast(err.message || '更新顯示名稱失敗', 'error');
          }
        });

        el('deleteAccountBtn').addEventListener('click', async () => {
          const pw = el('deleteAccountPassword')?.value || '';
          // 清除之前的錯誤訊息
          const existingErr = document.querySelector('.delete-account-error');
          if (existingErr) existingErr.remove();
          if (!confirm('⚠️ 確定要永久刪除帳號嗎？\n\n所有資料將被刪除且無法復原！')) return;
          if (!confirm('再次確認：真的要刪除帳號及所有資料嗎？')) return;
          try {
            await API.post('/api/account/delete', { password: pw || undefined });
            toast('帳號已刪除', 'success');
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
            setTimeout(() => location.reload(), 800);
          } catch (e) {
            // 在密碼欄位下方顯示錯誤訊息
            const errDiv = document.createElement('div');
            errDiv.className = 'delete-account-error';
            errDiv.innerHTML = `<i class="fas fa-circle-exclamation"></i> ${escHtml(e.message || '刪除失敗')}`;
            const section = el('deleteAccountSection');
            const btn = el('deleteAccountBtn');
            section.insertBefore(errDiv, btn);
            toast(e.message || '刪除失敗', 'error');
          }
        });

        accountSettingsBound = true;
      }

      bindExchangeRateSettingsIfNeeded();
    } catch (e) {
      console.error('載入帳號設定失敗:', e);
    }
  }

  function formatLoginAt(timestamp) {
    const t = Number(timestamp) || 0;
    if (!(t > 0)) return '-';
    return localDateTimeStr(t) || '-';
  }

  function formatLoginMethod(method) {
    const m = String(method || '').trim().toLowerCase();
    if (m === 'google') return 'Google SSO';
    if (m === 'passkey') return 'Passkey';
    return '密碼';
  }

  function formatFailureReason(reason) {
    const r = String(reason || '').trim().toLowerCase();
    if (!r) return '-';
    if (r === 'user_not_found') return '帳號不存在';
    if (r === 'wrong_password') return '密碼錯誤';
    if (r === 'missing_credentials') return '缺少帳號或密碼';
    if (r === 'account_temporarily_locked') return '登入暫時鎖定';
    if (r === 'credential_not_found') return 'Passkey 憑證不存在';
    if (r === 'verification_failed') return 'Passkey 驗證失敗';
    return r;
  }

  function formatCountryCode(country) {
    const code = String(country || '').trim().toUpperCase();
    if (!code || code === '-') return '-';
    if (code === 'LOCAL') return '內網/本機';
    return code;
  }

  function normalizeDeleteApiError(error, fallbackMessage) {
    const msg = String(error?.message || '').trim();
    if (!msg) return fallbackMessage;
    if (msg.includes('伺服器回應格式異常') || msg.includes('伺服器回傳 JSON 格式錯誤') || msg.includes('伺服器回應格式無法解析')) {
      return fallbackMessage;
    }
    return msg;
  }

  function updateAdminLoginLogSyncTime(timestamp = Date.now()) {
    const syncEl = el('adminLoginLogSyncAt');
    if (!syncEl) return;
    syncEl.textContent = `上次同步：${formatLoginAt(timestamp)}`;
  }

  function updateAdminAllLoginLogSyncTime(timestamp = Date.now()) {
    const syncEl = el('adminAllLoginLogSyncAt');
    if (!syncEl) return;
    syncEl.textContent = `上次同步：${formatLoginAt(timestamp)}`;
  }

  async function syncAdminLoginLogs(options = {}) {
    const { silent = false } = options;
    const data = await API.get('/api/admin/login-logs');
    renderAdminLoginLogTables(data);
    const now = Date.now();
    updateAdminLoginLogSyncTime(now);
    updateAdminAllLoginLogSyncTime(now);
    if (!silent) toast('登入紀錄已同步', 'success');
  }

  let accountLoginLogs = [];
  let accountLogPage = 1;
  let accountLogPageSize = 20;
  let accountLogPaginationBound = false;

  async function renderAccountLoginLogs(page) {
    const tbody = el('accountLoginLogBody');
    if (!tbody) return;
    if (typeof page === 'number') accountLogPage = page;
    try {
      if (accountLoginLogs.length === 0) {
        const result = await API.get('/api/account/login-logs');
        accountLoginLogs = Array.isArray(result?.logs) ? [...result.logs] : [];
        if (latestLoginRecord?.loginAt) {
          const hasLatest = accountLoginLogs.some(log => Number(log.loginAt) === Number(latestLoginRecord.loginAt) && String(log.ipAddress || '') === String(latestLoginRecord.ipAddress || ''));
          if (!hasLatest) accountLoginLogs.unshift({ ...latestLoginRecord });
        }
      }
      if (accountLoginLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-hint">尚無登入紀錄</td></tr>';
        el('accountLoginLogPagination').innerHTML = '';
        return;
      }

      const totalPages = Math.ceil(accountLoginLogs.length / accountLogPageSize);
      if (accountLogPage > totalPages) accountLogPage = totalPages;
      if (accountLogPage < 1) accountLogPage = 1;
      const start = (accountLogPage - 1) * accountLogPageSize;
      const pageData = accountLoginLogs.slice(start, start + accountLogPageSize);

      tbody.innerHTML = pageData.map(log => `
        <tr>
          <td>${escHtml(formatLoginAt(log.loginAt))}</td>
          <td>${escHtml(log.ipAddress || 'unknown')}</td>
          <td>${escHtml(formatCountryCode(log.country))}</td>
          <td>${log.isAdminLogin ? '<span class="type-badge income">管理員</span>' : '<span class="type-badge">一般</span>'}</td>
          <td>${escHtml(formatLoginMethod(log.loginMethod))}</td>
        </tr>
      `).join('');

      renderStkPagination('accountLoginLogPagination', accountLogPage, totalPages, 'App.accountLogGoPage');

      if (!accountLogPaginationBound) {
        accountLogPaginationBound = true;
        el('accountLogPageSize')?.addEventListener('change', (e) => {
          if (e.target.value === 'custom') {
            el('accountLogPageSizeCustom').style.display = '';
            el('accountLogPageSizeCustom').focus();
          } else {
            el('accountLogPageSizeCustom').style.display = 'none';
            accountLogPageSize = parseInt(e.target.value);
            accountLogPage = 1;
            renderAccountLoginLogs();
          }
        });
        el('accountLogPageSizeCustom')?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const v = parseInt(el('accountLogPageSizeCustom').value);
            if (v > 0) { accountLogPageSize = v; accountLogPage = 1; renderAccountLoginLogs(); }
          }
        });
      }
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-hint">載入登入紀錄失敗</td></tr>';
    }
  }

  function accountLogGoPage(p) {
    accountLogPage = p;
    renderAccountLoginLogs();
  }

  function updateAdminLoginLogSelectionUI() {
    const checkboxes = document.querySelectorAll('.admin-login-log-checkbox');
    const selectedCount = selectedAdminLoginLogIds.size;
    const countEl = el('adminLoginLogSelectedCount');
    const deleteBtn = el('adminLoginLogDeleteSelectedBtn');
    const selectAll = el('selectAllAdminLoginLogs');

    if (countEl) countEl.textContent = `已選 ${selectedCount} 筆`;
    if (deleteBtn) deleteBtn.disabled = selectedCount === 0;
    if (selectAll) {
      if (checkboxes.length > 0 && selectedCount === checkboxes.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
      } else if (selectedCount > 0) {
        selectAll.checked = false;
        selectAll.indeterminate = true;
      } else {
        selectAll.checked = false;
        selectAll.indeterminate = false;
      }
    }
  }

  function updateAdminAllLoginLogSelectionUI() {
    const checkboxes = document.querySelectorAll('.admin-all-login-log-checkbox');
    const selectedCount = selectedAdminAllLoginLogIds.size;
    const countEl = el('adminAllLoginLogSelectedCount');
    const deleteBtn = el('adminAllLoginLogDeleteSelectedBtn');
    const selectAll = el('selectAllAdminAllLoginLogs');

    if (countEl) countEl.textContent = `已選 ${selectedCount} 筆`;
    if (deleteBtn) deleteBtn.disabled = selectedCount === 0;
    if (selectAll) {
      if (checkboxes.length > 0 && selectedCount === checkboxes.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
      } else if (selectedCount > 0) {
        selectAll.checked = false;
        selectAll.indeterminate = true;
      } else {
        selectAll.checked = false;
        selectAll.indeterminate = false;
      }
    }
  }

  function toggleAdminLoginLogSelect(id, checked) {
    if (!id) return;
    if (checked) selectedAdminLoginLogIds.add(id);
    else selectedAdminLoginLogIds.delete(id);
    updateAdminLoginLogSelectionUI();
  }

  function toggleAllAdminLoginLogs(checked) {
    document.querySelectorAll('.admin-login-log-checkbox').forEach(cb => {
      cb.checked = !!checked;
      const id = cb.dataset.id;
      if (!id) return;
      if (checked) selectedAdminLoginLogIds.add(id);
      else selectedAdminLoginLogIds.delete(id);
    });
    updateAdminLoginLogSelectionUI();
  }

  function toggleAdminAllLoginLogSelect(id, checked) {
    if (!id) return;
    if (checked) selectedAdminAllLoginLogIds.add(id);
    else selectedAdminAllLoginLogIds.delete(id);
    updateAdminAllLoginLogSelectionUI();
  }

  function toggleAllAdminAllLoginLogs(checked) {
    document.querySelectorAll('.admin-all-login-log-checkbox').forEach(cb => {
      cb.checked = !!checked;
      const id = cb.dataset.id;
      if (!id) return;
      if (checked) selectedAdminAllLoginLogIds.add(id);
      else selectedAdminAllLoginLogIds.delete(id);
    });
    updateAdminAllLoginLogSelectionUI();
  }

  function shouldRetryLegacyAdminLoginDelete(error) {
    const msg = String(error?.message || '').trim();
    if (!msg) return false;
    return (
      msg.includes('404')
      || msg.includes('502')
      || msg.includes('503')
      || msg.includes('504')
      || msg.includes('伺服器暫時異常')
      || msg.includes('伺服器回應格式異常')
      || msg.includes('伺服器回應格式無法解析')
      || msg.includes('伺服器回傳 JSON 格式錯誤')
    );
  }

  async function deleteAdminLoginLogWithCompatFallback(id) {
    const encodedId = encodeURIComponent(id);
    try {
      return await API.del('/api/admin/login-logs/admin/' + encodedId);
    } catch (primaryError) {
      if (!shouldRetryLegacyAdminLoginDelete(primaryError)) throw primaryError;
      return API.del('/api/admin/login-logs/' + encodedId);
    }
  }

  async function deleteAdminLoginLog(id) {
    if (!id) return;
    if (!confirm('確定要刪除此筆管理員登入紀錄嗎？')) return;
    try {
      await deleteAdminLoginLogWithCompatFallback(id);
      toast('管理員登入紀錄已刪除', 'success');
      await renderAdminSettings();
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('(404)') || msg.includes('404') || msg.includes('不存在')) {
        try {
          await syncAdminLoginLogs({ silent: true });
        } catch (_) {
          // ignore sync error and still show stable fallback message below
        }
        toast('該筆管理員登入紀錄可能已不存在，已同步最新列表', 'success');
        return;
      }
      toast(normalizeDeleteApiError(e, '刪除管理員登入紀錄失敗，請重新整理後再試'), 'error');
    }
  }

  async function deleteSelectedAdminLoginLogs() {
    const ids = Array.from(selectedAdminLoginLogIds);
    if (ids.length === 0) {
      toast('請先勾選要刪除的紀錄', 'error');
      return;
    }
    if (!confirm(`確定要刪除 ${ids.length} 筆管理員登入紀錄嗎？`)) return;
    try {
      const result = await API.post('/api/admin/login-logs/admin/batch-delete', { ids });
      let deleted = Number(result.deleted) || 0;
      if (deleted === 0 && ids.length > 0) {
        // 備援：若批次端點未成功刪除，改逐筆刪除避免前端無法操作。
        const settled = await Promise.allSettled(ids.map(id => deleteAdminLoginLogWithCompatFallback(id)));
        deleted = settled.filter(x => x.status === 'fulfilled').length;
      }
      toast(`已刪除 ${deleted} 筆管理員登入紀錄`, 'success');
      await renderAdminSettings();
    } catch (e) {
      toast(normalizeDeleteApiError(e, '批次刪除管理員登入紀錄失敗，請重新整理後再試'), 'error');
    }
  }

  async function deleteAdminAllLoginLog(id) {
    if (!id) return;
    if (!confirm('確定要刪除此筆使用者登入紀錄嗎？')) return;
    try {
      await API.del('/api/admin/login-logs/all/' + encodeURIComponent(id));
      toast('使用者登入紀錄已刪除', 'success');
      await renderAdminSettings();
    } catch (e) {
      toast(normalizeDeleteApiError(e, '刪除使用者登入紀錄失敗，請重新整理後再試'), 'error');
    }
  }

  async function deleteSelectedAdminAllLoginLogs() {
    const ids = Array.from(selectedAdminAllLoginLogIds);
    if (ids.length === 0) {
      toast('請先勾選要刪除的紀錄', 'error');
      return;
    }
    if (!confirm(`確定要刪除 ${ids.length} 筆使用者登入紀錄嗎？`)) return;
    try {
      const result = await API.post('/api/admin/login-logs/all/batch-delete', { ids });
      let deleted = Number(result.deleted) || 0;
      if (deleted === 0 && ids.length > 0) {
        // 備援：若批次端點未成功刪除，改逐筆刪除避免前端無法操作。
        const settled = await Promise.allSettled(ids.map(id => API.del('/api/admin/login-logs/all/' + encodeURIComponent(id))));
        deleted = settled.filter(x => x.status === 'fulfilled').length;
      }
      toast(`已刪除 ${deleted} 筆使用者登入紀錄`, 'success');
      await renderAdminSettings();
    } catch (e) {
      toast(normalizeDeleteApiError(e, '批次刪除使用者登入紀錄失敗，請重新整理後再試'), 'error');
    }
  }

  function renderAdminLogPagination(elId, page, totalPages, goFn) {
    const pag = el(elId);
    if (!pag) return;
    if (totalPages <= 1) { pag.innerHTML = ''; return; }
    const btn = (attrs, inner) => `<button ${attrs}>${inner}</button>`;
    const prevDisabled = page <= 1 ? 'disabled' : '';
    const nextDisabled = page >= totalPages ? 'disabled' : '';
    let ph = btn(
      `class="stk-pag-nav" aria-label="上一頁" ${prevDisabled} onclick="${goFn}(${page - 1})"`,
      '<i class="fas fa-chevron-left" aria-hidden="true"></i>'
    );
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7) {
        if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
          const isActive = i === page;
          ph += btn(
            `class="stk-pag-num${isActive ? ' active' : ''}"${isActive ? ' aria-current="page"' : ''} aria-label="第 ${i} 頁" onclick="${goFn}(${i})"`,
            i
          );
        } else if (i === page - 2 || i === page + 2) {
          ph += btn('class="stk-pag-ellipsis" disabled aria-hidden="true" tabindex="-1"', '…');
        }
      } else {
        const isActive = i === page;
        ph += btn(
          `class="stk-pag-num${isActive ? ' active' : ''}"${isActive ? ' aria-current="page"' : ''} aria-label="第 ${i} 頁" onclick="${goFn}(${i})"`,
          i
        );
      }
    }
    ph += btn(
      `class="stk-pag-nav" aria-label="下一頁" ${nextDisabled} onclick="${goFn}(${page + 1})"`,
      '<i class="fas fa-chevron-right" aria-hidden="true"></i>'
    );
    pag.innerHTML = ph;
  }

  function adminLoginLogGoPage(p) {
    adminLoginLogPage = p;
    _renderAdminLoginLogPage();
  }

  function adminAllLoginLogGoPage(p) {
    adminAllLoginLogPage = p;
    _renderAdminAllLoginLogPage();
  }

  function _renderAdminLoginLogPage() {
    const logs = _cachedAdminLoginLogs;
    const adminTbody = el('adminLoginLogBody');
    if (!adminTbody) return;
    selectedAdminLoginLogIds = new Set();

    const totalPages = Math.max(1, Math.ceil(logs.length / adminLoginLogPageSize));
    adminLoginLogPage = Math.min(Math.max(1, adminLoginLogPage), totalPages);
    const start = (adminLoginLogPage - 1) * adminLoginLogPageSize;
    const pageRows = logs.slice(start, start + adminLoginLogPageSize);

    const totalEl = el('adminLoginLogTotal');
    if (totalEl) totalEl.textContent = `共 ${logs.length} 筆`;

    if (logs.length === 0) {
      adminTbody.innerHTML = '<tr><td colspan="6" class="empty-hint">尚無管理員登入紀錄</td></tr>';
    } else {
      adminTbody.innerHTML = pageRows.map(log => {
        const rowId = String(log.id || (log.loginAt ? `ts:${Number(log.loginAt)}` : '')).trim();
        const hasId = !!rowId;
        return `
        <tr>
          <td class="td-check">${hasId ? `<input type="checkbox" class="admin-login-log-checkbox" data-id="${escHtml(rowId)}">` : ''}</td>
          <td>${escHtml(formatLoginAt(log.loginAt))}</td>
          <td>${escHtml(log.ipAddress || 'unknown')}</td>
          <td>${escHtml(formatCountryCode(log.country))}</td>
          <td>${escHtml(formatLoginMethod(log.loginMethod))}</td>
          <td>${hasId ? `<button class="btn-icon danger admin-login-log-delete-btn" data-id="${escHtml(rowId)}" title="刪除"><i class="fas fa-trash"></i></button>` : '<span class="import-hint">-</span>'}</td>
        </tr>`;
      }).join('');
    }
    updateAdminLoginLogSelectionUI();
    renderAdminLogPagination('adminLoginLogPagination', adminLoginLogPage, totalPages, 'App.adminLoginLogGoPage');
  }

  function _renderAdminAllLoginLogPage() {
    const logs = _cachedAdminAllLoginLogs;
    const allUserTbody = el('adminAllLoginLogBody');
    if (!allUserTbody) return;
    selectedAdminAllLoginLogIds = new Set();

    const totalPages = Math.max(1, Math.ceil(logs.length / adminAllLoginLogPageSize));
    adminAllLoginLogPage = Math.min(Math.max(1, adminAllLoginLogPage), totalPages);
    const start = (adminAllLoginLogPage - 1) * adminAllLoginLogPageSize;
    const pageRows = logs.slice(start, start + adminAllLoginLogPageSize);

    const totalEl = el('adminAllLoginLogTotal');
    if (totalEl) totalEl.textContent = `共 ${logs.length} 筆`;

    if (logs.length === 0) {
      allUserTbody.innerHTML = '<tr><td colspan="11" class="empty-hint">尚無使用者登入紀錄</td></tr>';
    } else {
      allUserTbody.innerHTML = pageRows.map(log => {
        const rowId = String(log.id || (log.loginAt ? `ts:${Number(log.loginAt)}` : '')).trim();
        const hasId = !!rowId;
        return `
        <tr>
          <td class="td-check">${hasId ? `<input type="checkbox" class="admin-all-login-log-checkbox" data-id="${escHtml(rowId)}">` : ''}</td>
          <td>${escHtml(formatLoginAt(log.loginAt))}</td>
          <td>${escHtml(log.email || '')}</td>
          <td>${escHtml(log.displayName || '-')}</td>
          <td>${log.isAdminLogin ? '<span class="type-badge income">管理員</span>' : '<span class="type-badge">一般</span>'}</td>
          <td>${escHtml(log.ipAddress || 'unknown')}</td>
          <td>${escHtml(formatCountryCode(log.country))}</td>
          <td>${escHtml(formatLoginMethod(log.loginMethod))}</td>
          <td>${log.isSuccess ? '<span class="type-badge income">成功</span>' : '<span class="type-badge expense">失敗</span>'}</td>
          <td>${escHtml(log.isSuccess ? '-' : formatFailureReason(log.failureReason))}</td>
          <td>${hasId ? `<button class="btn-icon danger admin-all-login-log-delete-btn" data-id="${escHtml(rowId)}" title="刪除"><i class="fas fa-trash"></i></button>` : '<span class="import-hint">-</span>'}</td>
        </tr>`;
      }).join('');
    }
    updateAdminAllLoginLogSelectionUI();
    renderAdminLogPagination('adminAllLoginLogPagination', adminAllLoginLogPage, totalPages, 'App.adminAllLoginLogGoPage');
  }

  function renderAdminLoginLogTables(loginLogData) {
    if (!el('adminLoginLogBody') || !el('adminAllLoginLogBody')) return;

    const adminLogs = Array.isArray(loginLogData?.adminLogs) ? [...loginLogData.adminLogs] : [];
    const allUserLogs = Array.isArray(loginLogData?.allUserLogs) ? [...loginLogData.allUserLogs] : [];

    if (latestLoginRecord?.loginAt && currentUser?.isAdmin) {
      const hasAdminLatest = adminLogs.some(log => Number(log.loginAt) === Number(latestLoginRecord.loginAt) && String(log.ipAddress || '') === String(latestLoginRecord.ipAddress || ''));
      if (!hasAdminLatest) {
        adminLogs.unshift({
          id: latestLoginRecord.id || (latestLoginRecord.loginAt ? `ts:${latestLoginRecord.loginAt}` : ''),
          loginAt: latestLoginRecord.loginAt,
          ipAddress: latestLoginRecord.ipAddress,
          country: latestLoginRecord.country || '-',
          loginMethod: latestLoginRecord.loginMethod,
        });
      }

      const hasAllLatest = allUserLogs.some(log => Number(log.loginAt) === Number(latestLoginRecord.loginAt) && String(log.ipAddress || '') === String(latestLoginRecord.ipAddress || '') && String(log.userId || '') === String(currentUser?.id || ''));
      if (!hasAllLatest) {
        allUserLogs.unshift({
          id: latestLoginRecord.id || (latestLoginRecord.loginAt ? `ts:${latestLoginRecord.loginAt}` : ''),
          userId: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.displayName,
          loginAt: latestLoginRecord.loginAt,
          ipAddress: latestLoginRecord.ipAddress,
          country: latestLoginRecord.country || '-',
          loginMethod: latestLoginRecord.loginMethod,
          isAdminLogin: !!latestLoginRecord.isAdminLogin,
          isSuccess: true,
          failureReason: '',
        });
      }
    }

    _cachedAdminLoginLogs = adminLogs;
    _cachedAdminAllLoginLogs = allUserLogs;
    adminLoginLogPage = 1;
    adminAllLoginLogPage = 1;
    _renderAdminLoginLogPage();
    _renderAdminAllLoginLogPage();
  }

  function openAdminResetPasswordModal(userId, userEmail, userName) {
    if (el('adminResetPasswordUserId')) el('adminResetPasswordUserId').value = userId || '';
    const target = el('adminResetPasswordTarget');
    if (target) {
      const label = userName ? `${userName}（${userEmail}）` : (userEmail || '—');
      target.textContent = label;
    }
    if (el('adminResetPasswordNew')) el('adminResetPasswordNew').value = '';
    if (el('adminResetPasswordConfirm')) el('adminResetPasswordConfirm').value = '';
    const errEl = el('adminResetPasswordError');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    openModal('modalAdminResetPassword');
    setTimeout(() => el('adminResetPasswordNew')?.focus(), 50);
  }

  function renderAdminUserTable(users) {
    const tbody = el('adminUserBody');
    if (!tbody) return;
    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-hint">尚無使用者</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isSelf = u.id === currentUser?.id;
      const canDelete = !isSelf;
      return `<tr>
        <td>${escHtml(u.email || '')}</td>
        <td>${escHtml(u.displayName || '')}</td>
        <td>${u.isAdmin ? '<span class="type-badge income">管理員</span>' : '<span class="type-badge">一般</span>'}</td>
        <td>${u.googleLinked ? 'Google' : '密碼'}</td>
        <td>${escHtml(u.createdAt || '-')}</td>
        <td>
          <button class="btn-icon admin-reset-password-btn" data-user-id="${u.id}" data-user-email="${escHtml(u.email || '')}" data-user-name="${escHtml(u.displayName || '')}" title="重設密碼">
            <i class="fas fa-key"></i>
          </button>
          <button class="btn-icon danger admin-delete-user-btn" data-user-id="${u.id}" data-user-email="${escHtml(u.email || '')}" ${canDelete ? '' : 'disabled'} title="${canDelete ? '刪除' : '不可刪除自己'}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  async function renderAdminSettings() {
    if (!currentUser?.isAdmin) return;
    try {
      const [settings, users] = await Promise.all([
        API.get('/api/admin/settings'),
        API.get('/api/admin/users'),
      ]);

      const toggle = el('adminPublicRegistrationToggle');
      const emails = el('adminAllowedEmails');
      const ipAllowlist = el('adminIpAllowlist');
      if (toggle) toggle.checked = !!settings.publicRegistration;
      if (emails) emails.value = Array.isArray(settings.allowedRegistrationEmails)
        ? settings.allowedRegistrationEmails.join('\n')
        : '';
      if (ipAllowlist) ipAllowlist.value = Array.isArray(settings.adminIpAllowlist)
        ? settings.adminIpAllowlist.join('\n')
        : '';
      renderAdminUserTable(users);
      await syncAdminLoginLogs({ silent: true });
    } catch (e) {
      toast(e.message || '載入管理員設定失敗', 'error');
    }
    await renderAdminCerts();

    if (adminSettingsBound) return;

    el('saveAdminSettingsBtn')?.addEventListener('click', async () => {
      try {
        const publicRegistration = !!el('adminPublicRegistrationToggle')?.checked;
        const allowedRegistrationEmails = el('adminAllowedEmails')?.value || '';
        const adminIpAllowlist = el('adminIpAllowlist')?.value || '';
        await API.put('/api/admin/settings', { publicRegistration, allowedRegistrationEmails, adminIpAllowlist });
        const config = await (await fetch('/api/config', { cache: 'no-store' })).json();
        authConfig = {
          registrationEnabled: !!config.registrationEnabled,
          publicRegistration: !!config.publicRegistration,
          allowlistEnabled: !!config.allowlistEnabled,
        };
        updateRegisterEntryVisibility();
        toast('管理員設定已儲存', 'success');
        await renderAdminSettings();
      } catch (e) {
        toast(e.message || '儲存管理員設定失敗', 'error');
      }
    });

    el('adminCreateUserForm')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const errEl = el('adminCreateUserError');
      if (errEl) errEl.textContent = '';
      try {
        const email = el('adminCreateEmail')?.value?.trim() || '';
        const displayName = el('adminCreateName')?.value?.trim() || '';
        const password = el('adminCreatePassword')?.value || '';
        const isAdmin = !!el('adminCreateIsAdmin')?.checked;
        await API.post('/api/admin/users', { email, displayName, password, isAdmin });
        el('adminCreateUserForm')?.reset();
        toast('使用者已建立', 'success');
        await renderAdminSettings();
      } catch (e) {
        if (errEl) errEl.textContent = e.message || '建立使用者失敗';
      }
    });

    el('adminUserBody')?.addEventListener('click', async (ev) => {
      const resetBtn = ev.target.closest('.admin-reset-password-btn');
      if (resetBtn) {
        const userId = resetBtn.dataset.userId || '';
        const userEmail = resetBtn.dataset.userEmail || '';
        const userName = resetBtn.dataset.userName || '';
        if (!userId) return;
        openAdminResetPasswordModal(userId, userEmail, userName);
        return;
      }
      const btn = ev.target.closest('.admin-delete-user-btn');
      if (!btn || btn.disabled) return;
      const userId = btn.dataset.userId;
      const userEmail = btn.dataset.userEmail || '此使用者';
      if (!userId) return;
      if (!confirm(`確定要刪除 ${userEmail} 嗎？\n此操作會刪除此帳號的所有資料，且無法復原。`)) return;
      try {
        await API.del('/api/admin/users/' + userId);
        toast('使用者已刪除', 'success');
        await renderAdminSettings();
      } catch (e) {
        toast(e.message || '刪除使用者失敗', 'error');
      }
    });

    el('adminResetPasswordForm')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const errEl = el('adminResetPasswordError');
      const showError = (msg) => {
        if (errEl) { errEl.textContent = msg; errEl.style.display = ''; }
      };
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
      const userId = el('adminResetPasswordUserId')?.value || '';
      const newPassword = el('adminResetPasswordNew')?.value || '';
      const confirmPassword = el('adminResetPasswordConfirm')?.value || '';
      if (!userId) { showError('缺少使用者 ID'); return; }
      if (!newPassword) { showError('請輸入新密碼'); return; }
      if (newPassword.length < 8) { showError('新密碼長度至少 8 字元'); return; }
      if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) {
        showError('新密碼需包含大寫字母、小寫字母、數字與特殊符號'); return;
      }
      if (newPassword !== confirmPassword) { showError('兩次輸入的新密碼不一致'); return; }
      try {
        await API.put('/api/admin/users/' + userId + '/password', { newPassword });
        closeModal('modalAdminResetPassword');
        toast('密碼已重設', 'success');
        await renderAdminSettings();
      } catch (e) {
        showError(e.message || '重設密碼失敗');
      }
    });

    el('adminLoginLogBody')?.addEventListener('change', (ev) => {
      const cb = ev.target.closest('.admin-login-log-checkbox');
      if (!cb) return;
      toggleAdminLoginLogSelect(cb.dataset.id || '', !!cb.checked);
    });

    el('adminAllLoginLogBody')?.addEventListener('change', (ev) => {
      const cb = ev.target.closest('.admin-all-login-log-checkbox');
      if (!cb) return;
      toggleAdminAllLoginLogSelect(cb.dataset.id || '', !!cb.checked);
    });

    el('adminLoginLogBody')?.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.admin-login-log-delete-btn');
      if (!btn) return;
      const id = btn.dataset.id || '';
      if (!id) return;
      await deleteAdminLoginLog(id);
    });

    el('adminAllLoginLogBody')?.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.admin-all-login-log-delete-btn');
      if (!btn) return;
      const id = btn.dataset.id || '';
      if (!id) return;
      await deleteAdminAllLoginLog(id);
    });

    el('selectAllAdminLoginLogs')?.addEventListener('change', (ev) => {
      toggleAllAdminLoginLogs(!!ev.target.checked);
    });

    el('selectAllAdminAllLoginLogs')?.addEventListener('change', (ev) => {
      toggleAllAdminAllLoginLogs(!!ev.target.checked);
    });

    el('adminLoginLogDeleteSelectedBtn')?.addEventListener('click', deleteSelectedAdminLoginLogs);
    el('adminAllLoginLogDeleteSelectedBtn')?.addEventListener('click', deleteSelectedAdminAllLoginLogs);

    el('adminLoginLogPageSizeGroup')?.querySelectorAll('.pagesize-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.v;
        el('adminLoginLogPageSizeGroup').querySelectorAll('.pagesize-opt').forEach(b => b.classList.remove('pagesize-opt-active'));
        btn.classList.add('pagesize-opt-active');
        if (v === 'custom') {
          el('adminLoginLogPageSizeCustom').style.display = '';
          el('adminLoginLogPageSizeCustom').focus();
        } else {
          el('adminLoginLogPageSizeCustom').style.display = 'none';
          adminLoginLogPageSize = parseInt(v);
          adminLoginLogPage = 1;
          _renderAdminLoginLogPage();
        }
      });
    });
    el('adminLoginLogPageSizeCustom')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = parseInt(el('adminLoginLogPageSizeCustom').value);
        if (v > 0) { adminLoginLogPageSize = v; adminLoginLogPage = 1; _renderAdminLoginLogPage(); }
      }
    });

    el('adminAllLoginLogPageSizeGroup')?.querySelectorAll('.pagesize-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.v;
        el('adminAllLoginLogPageSizeGroup').querySelectorAll('.pagesize-opt').forEach(b => b.classList.remove('pagesize-opt-active'));
        btn.classList.add('pagesize-opt-active');
        if (v === 'custom') {
          el('adminAllLoginLogPageSizeCustom').style.display = '';
          el('adminAllLoginLogPageSizeCustom').focus();
        } else {
          el('adminAllLoginLogPageSizeCustom').style.display = 'none';
          adminAllLoginLogPageSize = parseInt(v);
          adminAllLoginLogPage = 1;
          _renderAdminAllLoginLogPage();
        }
      });
    });
    el('adminAllLoginLogPageSizeCustom')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = parseInt(el('adminAllLoginLogPageSizeCustom').value);
        if (v > 0) { adminAllLoginLogPageSize = v; adminAllLoginLogPage = 1; _renderAdminAllLoginLogPage(); }
      }
    });
    el('adminLoginLogSyncBtn')?.addEventListener('click', async () => {
      try {
        await syncAdminLoginLogs({ silent: false });
      } catch (e) {
        toast(e.message || '同步管理員登入紀錄失敗', 'error');
      }
    });
    el('adminAllLoginLogSyncBtn')?.addEventListener('click', async () => {
      try {
        await syncAdminLoginLogs({ silent: false });
      } catch (e) {
        toast(e.message || '同步全部使用者登入紀錄失敗', 'error');
      }
    });

    adminSettingsBound = true;
  }

  function formatCertInfo(info) {
    if (!info) return '（未部署）';
    if (info.error) return `<span style="color:var(--danger)">${escHtml(info.error)}</span>`;
    const subj = info.subject?.split('\n').find(l => l.startsWith('CN='))?.replace('CN=', '') || info.subject || '';
    const from = info.validFrom ? new Date(info.validFrom).toLocaleDateString('zh-TW') : '-';
    const to   = info.validTo   ? new Date(info.validTo).toLocaleDateString('zh-TW')   : '-';
    return `主旨：${escHtml(subj)}　有效期：${escHtml(from)} ~ ${escHtml(to)}`;
  }

  async function renderAdminCerts() {
    try {
      const data = await API.get('/api/admin/certs');

      const originCaInfo = el('adminOriginCaInfo');
      if (originCaInfo) originCaInfo.innerHTML = 'Origin CA：' + formatCertInfo(data.originCa);

      const originInfo = el('adminOriginCertInfo');
      if (originInfo) {
        const keyNote = data.originKeyExists ? '（私鑰已存在）' : '（私鑰未設定）';
        originInfo.innerHTML = 'Origin Certificate：' + formatCertInfo(data.originCert) + ' ' + escHtml(keyNote);
      }
    } catch (e) {
      // silent — cert section might not affect normal usage
    }

    if (adminCertsBound) return;

    // Origin CA
    el('adminSaveOriginCaBtn')?.addEventListener('click', async () => {
      const pem = el('adminOriginCaPem')?.value?.trim() || '';
      if (!pem) { toast('請貼入 Origin CA PEM', 'error'); return; }
      try {
        await API.post('/api/admin/certs/origin/ca', { cert: pem });
        toast('Origin CA 已部署，請重啟伺服器', 'success');
        el('adminOriginCaPem').value = '';
        await renderAdminCerts();
      } catch (e) {
        toast(e.message || '部署 Origin CA 失敗', 'error');
      }
    });

    el('adminDeleteOriginCaBtn')?.addEventListener('click', async () => {
      if (!confirm('確定要刪除 Origin CA 憑證？刪除後需重啟伺服器才完全生效。')) return;
      try {
        await API.del('/api/admin/certs/origin/ca');
        toast('Origin CA 已刪除，請重啟伺服器', 'success');
        await renderAdminCerts();
      } catch (e) {
        toast(e.message || '刪除 Origin CA 失敗', 'error');
      }
    });

    // Origin Certificate + Key
    el('adminSaveOriginCertBtn')?.addEventListener('click', async () => {
      const cert = el('adminOriginCertPem')?.value?.trim() || '';
      const key  = el('adminOriginKeyPem')?.value?.trim()  || '';
      if (!cert && !key) { toast('請貼入 Origin Certificate 或私鑰（可擇一或同時上傳）', 'error'); return; }
      try {
        await API.post('/api/admin/certs/origin', { ...(cert && { cert }), ...(key && { key }) });
        toast('Origin Certificate 已儲存，請重啟伺服器以套用 HTTPS', 'success');
        if (cert) el('adminOriginCertPem').value = '';
        if (key)  el('adminOriginKeyPem').value  = '';
        await renderAdminCerts();
      } catch (e) {
        toast(e.message || '部署 Origin Certificate 失敗', 'error');
      }
    });

    el('adminDeleteOriginCertBtn')?.addEventListener('click', async () => {
      if (!confirm('確定要刪除 Origin Certificate、私鑰與 Origin CA？刪除後需重啟伺服器才完全生效。')) return;
      try {
        await API.del('/api/admin/certs/origin');
        toast('Origin Certificate 全部已刪除，請重啟伺服器', 'success');
        await renderAdminCerts();
      } catch (e) {
        toast(e.message || '刪除 Origin Certificate 失敗', 'error');
      }
    });

    adminCertsBound = true;
  }

  function initGoogleLinkButton() {
    if (!window.google?.accounts?.id || !googleClientId) {
      el('googleLinkBtnWrap').innerHTML = '<p style="color:var(--text-muted);font-size:13px">Google SSO 未設定或載入中</p>';
      return;
    }
    el('googleLinkBtnWrap').innerHTML = '';
    google.accounts.id.renderButton(el('googleLinkBtnWrap'), {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 280,
      click_listener: () => {}
    });
    // 設定回調為綁定流程
    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleLink,
      ux_mode: 'popup',
      auto_select: false
    });
    // 重新渲染按鈕以套用新 callback
    el('googleLinkBtnWrap').innerHTML = '';
    google.accounts.id.renderButton(el('googleLinkBtnWrap'), {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 280
    });
  }

  async function handleGoogleLink(response) {
    try {
      const res = await API.post('/api/account/link-google', { credential: response.credential });
      toast('Google 帳號綁定成功！');
      // 重新初始化 Google callback 回登入用途
      if (window.google?.accounts?.id && googleClientId) {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
          ux_mode: 'popup',
          auto_select: false
        });
      }
      renderAccountSettings();
    } catch (e) {
      toast(e.message || '綁定失敗', 'error');
      // 恢復登入用途的 callback
      if (window.google?.accounts?.id && googleClientId) {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
          ux_mode: 'popup',
          auto_select: false
        });
      }
    }
  }

  function bindExport() {
    el('exportCsvBtn').onclick = exportCsv;
    el('exportCatBtn').onclick = exportCategories;
    el('importCatInput').addEventListener('change', importCategories);
    el('exportStockTxBtn').onclick = exportStockTx;
    el('exportStockDivBtn').onclick = exportStockDiv;
    el('importStockTxInput').addEventListener('change', e => {
      if (e.target.files[0]) importStockCsv(e.target.files[0], 'tx');
      e.target.value = '';
    });
    el('importStockDivInput').addEventListener('change', e => {
      if (e.target.files[0]) importStockCsv(e.target.files[0], 'div');
      e.target.value = '';
    });
    bindImport();
    initDbBackupUI();
  }

  async function exportCsv() {
    const params = new URLSearchParams();
    const from = el('exportFrom').value;
    const to = el('exportTo').value;
    if (from) params.set('dateFrom', from);
    if (to) params.set('dateTo', to);
    params.set('limit', '99999');

    const result = await API.get('/api/transactions?' + params.toString());
    const txs = result.data;

    const BOM = '\uFEFF';
    let csv = BOM + '日期,類型,分類,金額,帳戶,備註\n';
    txs.forEach(t => {
      const cat = getCat(t.categoryId || t.category_id);
      const acc = getAcc(t.accountId || t.account_id);
      let type = '支出';
      if (t.type === 'income') type = '收入';
      else if (t.type === 'transfer_out') type = '轉出';
      else if (t.type === 'transfer_in') type = '轉入';
      let catName = '';
      if (cat) {
        if (cat.parentId) {
          const parentCat = getCat(cat.parentId);
          catName = parentCat ? parentCat.name + ' > ' + cat.name : cat.name;
        } else {
          catName = cat.name;
        }
      } else if (t.type === 'transfer_out' || t.type === 'transfer_in') {
        catName = '轉帳';
      }
      csv += `${t.date},${type},"${catName}",${t.amount},"${acc ? acc.name : ''}","${(t.note || '').replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `記帳記錄_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('已匯出 CSV 檔案', 'success');
  }

  // ─── 分類匯出 ───
  function exportCategories() {
    const cats = cachedCategories;
    const parents = cats.filter(c => !c.parentId);
    const BOM = '\uFEFF';
    let csv = BOM + '類型,分類名稱,上層分類,顏色\n';
    parents.forEach(p => {
      const typeName = p.type === 'income' ? '收入' : '支出';
      csv += `${typeName},"${escCsv(p.name)}","",${p.color}\n`;
      const children = cats.filter(c => c.parentId === p.id);
      children.forEach(c => {
        csv += `${typeName},"${escCsv(c.name)}","${escCsv(p.name)}",${c.color}\n`;
      });
    });
    // 沒有 parent 的獨立分類（parentId 為空但不在 parents 中的不會有）
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `分類管理_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('已匯出分類 CSV', 'success');
  }

  function escCsv(s) { return (s || '').replace(/"/g, '""'); }

  // ─── 分類匯入 ───
  async function importCategories(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
    if (lines.length < 2) { toast('CSV 檔案無有效資料', 'error'); e.target.value = ''; return; }

    // 解析（跳過標題列）
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 3) continue;
      const type = cols[0].trim();
      const name = cols[1].trim();
      const parentName = cols[2].trim();
      const color = (cols[3] || '').trim() || '#6366f1';
      if (!name || (type !== '支出' && type !== '收入')) continue;
      rows.push({ type: type === '收入' ? 'income' : 'expense', name, parentName, color });
    }

    if (rows.length === 0) { toast('CSV 無有效分類資料', 'error'); e.target.value = ''; return; }

    // 先建立父分類，再建立子分類
    let created = 0, skipped = 0;
    const parentRows = rows.filter(r => !r.parentName);
    const childRows = rows.filter(r => r.parentName);

    for (const r of parentRows) {
      const existing = cachedCategories.find(c => c.name === r.name && c.type === r.type && !c.parentId);
      if (existing) { skipped++; continue; }
      try {
        await API.post('/api/categories', { name: r.name, type: r.type, color: r.color, parentId: '' });
        created++;
      } catch { skipped++; }
    }

    // 重新載入快取以取得新建父分類的 ID
    await refreshCache();

    for (const r of childRows) {
      const parent = cachedCategories.find(c => c.name === r.parentName && c.type === r.type && !c.parentId);
      if (!parent) { skipped++; continue; }
      const existing = cachedCategories.find(c => c.name === r.name && c.type === r.type && c.parentId === parent.id);
      if (existing) { skipped++; continue; }
      try {
        await API.post('/api/categories', { name: r.name, type: r.type, color: r.color, parentId: parent.id });
        created++;
      } catch { skipped++; }
    }

    await refreshCache();
    await renderPage(currentPage);
    toast(`匯入完成：新增 ${created} 個分類${skipped ? `，略過 ${skipped} 個（已存在或無效）` : ''}`, 'success');
    e.target.value = '';
  }

  // ─── CSV 匯入 ───
  let importParsedRows = [];

  function bindImport() {
    const area = el('importArea');
    const fileInput = el('importFileInput');

    area.onclick = () => fileInput.click();

    area.ondragover = (e) => { e.preventDefault(); area.classList.add('dragover'); };
    area.ondragleave = () => area.classList.remove('dragover');
    area.ondrop = (e) => {
      e.preventDefault();
      area.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) handleImportFile(file);
      else toast('請選擇 .csv 檔案', 'error');
    };

    fileInput.onchange = () => {
      if (fileInput.files[0]) handleImportFile(fileInput.files[0]);
    };

    el('importClearBtn').onclick = clearImport;
    el('importConfirmBtn').onclick = confirmImport;
  }

  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { result.push(current.trim()); current = ''; }
        else current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  function handleImportFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target.result;
      // 移除 BOM
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast('CSV 檔案無有效資料', 'error'); return; }

      // 跳過標題列
      const dataLines = lines.slice(1);
      importParsedRows = [];

      dataLines.forEach(line => {
        const cols = parseCsvLine(line);
        if (cols.length < 4) return;
        importParsedRows.push({
          date: cols[0] || '',
          type: cols[1] || '',
          category: cols[2] || '',
          amount: cols[3] || '',
          account: cols[4] || '',
          note: cols[5] || '',
        });
      });

      if (importParsedRows.length === 0) { toast('CSV 檔案無有效資料', 'error'); return; }

      // 顯示預覽
      el('importArea').style.display = 'none';
      el('importPreview').style.display = 'block';
      el('importResult').style.display = 'none';
      el('importFileName').textContent = file.name;
      el('importRowCount').textContent = `共 ${importParsedRows.length} 筆`;

      const tbody = el('importPreviewBody');
      tbody.innerHTML = '';
      const preview = importParsedRows.slice(0, 20);
      preview.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${esc(r.date)}</td><td>${esc(r.type)}</td><td>${esc(r.category)}</td><td>${esc(r.amount)}</td><td>${esc(r.account)}</td><td>${esc(r.note)}</td>`;
        tbody.appendChild(tr);
      });
      if (importParsedRows.length > 20) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;color:var(--text-secondary)">...還有 ${importParsedRows.length - 20} 筆未顯示</td>`;
        tbody.appendChild(tr);
      }

      // 檢查並顯示缺少的分類與帳戶
      showMissingImportItems();
    };
    reader.readAsText(file, 'UTF-8');
  }

  function showMissingImportItems() {
    const { missingCats, missingAccs } = findMissingImportItems();
    const container = el('importMissing');

    if (missingCats.length === 0 && missingAccs.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    let html = '<div class="import-missing-title"><i class="fas fa-triangle-exclamation"></i> 發現尚未建立的項目</div>';
    html += '<div class="import-missing-list">';
    if (missingCats.length > 0) {
      html += '<div class="import-missing-group"><b>分類：</b>';
      missingCats.forEach(c => { html += `<span>${esc(c)}</span>`; });
      html += '</div>';
    }
    if (missingAccs.length > 0) {
      html += '<div class="import-missing-group"><b>帳戶：</b>';
      missingAccs.forEach(a => { html += `<span>${esc(a)}</span>`; });
      html += '</div>';
    }
    html += '</div>';
    html += '<div class="import-missing-actions">';
    html += '<label><input type="checkbox" id="importAutoCreate" checked> 匯入時自動新增這些分類與帳戶</label>';
    html += '</div>';

    container.innerHTML = html;
    container.style.display = 'block';
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function clearImport() {
    importParsedRows = [];
    el('importArea').style.display = '';
    el('importPreview').style.display = 'none';
    el('importResult').style.display = 'none';
    el('importMissing').style.display = 'none';
    el('importFileInput').value = '';
  }

  function findMissingImportItems() {
    const catNames = new Set(cachedCategories.map(c => c.name));
    const accNames = new Set(cachedAccounts.map(a => a.name));
    const missingCats = new Set();
    const missingAccs = new Set();

    importParsedRows.forEach(r => {
      const isTransfer = (r.type === '轉出' || r.type === '轉入');
      if (!isTransfer && r.category && !catNames.has(r.category)) {
        missingCats.add(r.category);
      }
      if (r.account && !accNames.has(r.account)) {
        missingAccs.add(r.account);
      }
    });
    return { missingCats: [...missingCats], missingAccs: [...missingAccs] };
  }

  async function confirmImport() {
    if (importParsedRows.length === 0) return;

    // 檢查是否有未對應的分類或帳戶
    const { missingCats, missingAccs } = findMissingImportItems();
    const autoCreateCheckbox = el('importAutoCreate');
    const autoCreate = (missingCats.length > 0 || missingAccs.length > 0) && autoCreateCheckbox && autoCreateCheckbox.checked;

    el('importConfirmBtn').disabled = true;
    el('importConfirmBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> 匯入中...';
    try {
      const result = await API.post('/api/transactions/import', {
        rows: importParsedRows,
        autoCreate
      });
      // 組裝匯入結果訊息
      let html = `<div class="import-result-success"><i class="fas fa-circle-check"></i> 成功匯入 <strong>${result.imported}</strong> 筆`;
      if (result.skipped > 0) html += `，跳過 <strong>${result.skipped}</strong> 筆`;
      html += '</div>';
      if (result.created && (result.created.categories.length > 0 || result.created.accounts.length > 0)) {
        html += '<div class="import-result-created"><i class="fas fa-circle-plus"></i> 自動新增：';
        if (result.created.categories.length > 0) html += `分類（${result.created.categories.map(c => escHtml(c)).join('、')}）`;
        if (result.created.categories.length > 0 && result.created.accounts.length > 0) html += '、';
        if (result.created.accounts.length > 0) html += `帳戶（${result.created.accounts.map(a => escHtml(a)).join('、')}）`;
        html += '</div>';
      }
      if (result.errors && result.errors.length > 0) {
        html += '<div class="import-result-errors"><ul>';
        result.errors.forEach(err => { html += `<li>${esc(err)}</li>`; });
        html += '</ul></div>';
      }

      // 清空匯入區域，回到初始狀態
      clearImport();

      // 顯示匯入結果（在初始拖曳區上方）
      el('importResult').style.display = 'block';
      el('importResult').innerHTML = html;

      toast(`已匯入 ${result.imported} 筆交易`, 'success');
      // 重新載入資料
      await refreshCache();
    } catch (err) {
      toast('匯入失敗: ' + (err.message || '未知錯誤'), 'error');
    }
    el('importConfirmBtn').disabled = false;
    el('importConfirmBtn').innerHTML = '<i class="fas fa-file-import"></i> 確認匯入';
  }

  // ─── 資料庫匯出匯入 ───
  let dbImportFile = null;

  function initDbBackupUI() {
    const card = el('dbBackupCard');
    if (!card) return;
    card.style.display = currentUser?.isAdmin ? '' : 'none';
    if (!currentUser?.isAdmin) return;

    el('exportDbBtn').onclick = exportDatabase;

    const area = el('dbImportArea');
    const input = el('dbImportFileInput');
    area.addEventListener('click', () => input.click());
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('dragover');
      if (e.dataTransfer.files[0]) selectDbFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', e => {
      if (e.target.files[0]) selectDbFile(e.target.files[0]);
      e.target.value = '';
    });
    el('dbImportConfirmBtn').onclick = importDatabase;
    el('dbImportCancelBtn').onclick = cancelDbImport;
  }

  async function exportDatabase() {
    const btn = el('exportDbBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 匯出中…';
    try {
      const res = await fetch('/api/database/export', { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '匯出失敗');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : `asset_backup_${new Date().toISOString().slice(0,10)}.db`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      toast('資料庫匯出成功', 'success');
    } catch (e) {
      toast(e.message || '資料庫匯出失敗', 'error');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-download"></i> 匯出資料庫';
  }

  function selectDbFile(file) {
    dbImportFile = file;
    el('dbImportArea').style.display = 'none';
    el('dbImportConfirm').style.display = '';
    el('dbImportFileName').textContent = file.name;
    el('dbImportFileSize').textContent = `（${(file.size / 1024 / 1024).toFixed(2)} MB）`;
    el('dbImportResult').style.display = 'none';
  }

  function cancelDbImport() {
    dbImportFile = null;
    el('dbImportArea').style.display = '';
    el('dbImportConfirm').style.display = 'none';
    el('dbImportResult').style.display = 'none';
  }

  async function importDatabase() {
    if (!dbImportFile) return;
    if (!confirm('確定要匯入此資料庫嗎？\n\n⚠️ 此操作會取代所有現有資料，匯入前會自動備份現有資料庫。\n匯入後需要重新登入。')) return;

    const btn = el('dbImportConfirmBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 匯入中…';
    const resultEl = el('dbImportResult');

    try {
      const buffer = await dbImportFile.arrayBuffer();
      const res = await fetch('/api/database/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '匯入失敗');

      resultEl.style.display = '';
      resultEl.className = 'import-result success';
      resultEl.innerHTML = '<i class="fas fa-circle-check"></i> ' + escHtml(data.message) + '<br>即將自動登出，請重新登入…';
      toast('資料庫匯入成功，即將登出', 'success');

      // 2 秒後自動登出
      setTimeout(() => {
        logout();
      }, 2000);
    } catch (e) {
      resultEl.style.display = '';
      resultEl.className = 'import-result error';
      resultEl.innerHTML = '<i class="fas fa-circle-xmark"></i> ' + escHtml(e.message);
      toast(e.message || '資料庫匯入失敗', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-import"></i> 確認匯入（取代現有資料）';
    }
  }

  // ─── 電子發票 QRCode 掃描 ───
  let invoiceScannerStream = null;
  let invoiceScanRaf = 0;
  let invoiceBarcodeDetector = null;

  function setInvoiceScanStatus(msg, type = 'info') {
    const statusEl = el('invoiceScannerStatus');
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = `invoice-scanner-status ${type}`;
  }

  function stopInvoiceScanner() {
    if (invoiceScanRaf) {
      cancelAnimationFrame(invoiceScanRaf);
      invoiceScanRaf = 0;
    }
    if (invoiceScannerStream) {
      invoiceScannerStream.getTracks().forEach(t => t.stop());
      invoiceScannerStream = null;
    }
    const v = el('invoiceScannerVideo');
    if (v) v.srcObject = null;
  }

  function normalizeInvoiceDate(rocDate7) {
    if (!/^\d{7}$/.test(rocDate7 || '')) return '';
    const year = 1911 + Number(rocDate7.slice(0, 3));
    const month = rocDate7.slice(3, 5);
    const day = rocDate7.slice(5, 7);
    return `${year}-${month}-${day}`;
  }

  function parseTaiwanInvoiceQRCode(rawText) {
    const raw = String(rawText || '').trim();
    if (!raw) return null;
    const clean = raw.replace(/\s+/g, '');
    if (!/^[A-Za-z]{2}\d{8}/.test(clean)) return null;

    const invoiceNo = clean.slice(0, 10).toUpperCase();
    const rocDate = clean.slice(10, 17);
    const randomCode = clean.slice(17, 21);
    const saleAmountHex = clean.slice(21, 29);
    const totalAmountHex = clean.slice(29, 37);

    const amountCandidates = [
      Number.parseInt(totalAmountHex, 16),
      Number.parseInt(saleAmountHex, 16),
    ];
    const amount = amountCandidates.find(v => Number.isFinite(v) && v > 0) || null;

    const noteParts = [`電子發票 ${invoiceNo}`];
    if (/^\d{4}$/.test(randomCode)) noteParts.push(`隨機碼${randomCode}`);

    return {
      invoiceNo,
      date: normalizeInvoiceDate(rocDate),
      amount,
      note: noteParts.join(' '),
    };
  }

  function applyInvoiceToTransactionForm(parsed) {
    if (!parsed) return;

    const selectedType = document.querySelector('input[name="txType"]:checked')?.value;
    if (selectedType === 'transfer') {
      const expenseRadio = document.querySelector('input[name="txType"][value="expense"]');
      if (expenseRadio) {
        expenseRadio.checked = true;
        updateTxFormForType('expense');
      }
    }

    if (parsed.amount && parsed.amount > 0) {
      el('txAmount').value = parsed.amount;
    }
    if (parsed.date) {
      el('txDate').value = parsed.date;
    }

    if (parsed.note) {
      const oldNote = (el('txNote').value || '').trim();
      if (!oldNote) {
        el('txNote').value = parsed.note;
      } else if (!oldNote.includes(parsed.invoiceNo)) {
        el('txNote').value = `${oldNote}｜${parsed.note}`;
      }
    }
  }

  function handleInvoiceScanText(rawText) {
    const parsed = parseTaiwanInvoiceQRCode(rawText);
    if (!parsed) return false;
    applyInvoiceToTransactionForm(parsed);
    closeModal('modalInvoiceScanner');
    toast('已自動帶入電子發票金額與日期', 'success');
    return true;
  }

  async function startInvoiceScanner() {
    const videoEl = el('invoiceScannerVideo');
    if (!videoEl) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setInvoiceScanStatus('此瀏覽器不支援相機掃描', 'error');
      return;
    }

    if (!('BarcodeDetector' in window)) {
      setInvoiceScanStatus('此瀏覽器不支援即時 QR 掃描，請改用「貼上 QR 文字解析」', 'error');
      return;
    }

    try {
      invoiceBarcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      setInvoiceScanStatus('正在啟動相機...', 'info');
      invoiceScannerStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      videoEl.srcObject = invoiceScannerStream;
      await videoEl.play();
      setInvoiceScanStatus('請將電子發票 QRCode 對準掃描框', 'success');

      const tick = async () => {
        if (!invoiceScannerStream) return;
        try {
          const codes = await invoiceBarcodeDetector.detect(videoEl);
          for (const c of codes || []) {
            const raw = c?.rawValue || '';
            if (raw && handleInvoiceScanText(raw)) return;
          }
        } catch {
          // 忽略單次偵測錯誤，持續掃描。
        }
        invoiceScanRaf = requestAnimationFrame(tick);
      };
      invoiceScanRaf = requestAnimationFrame(tick);
    } catch (e) {
      stopInvoiceScanner();
      setInvoiceScanStatus('無法啟動相機，請確認已允許相機權限', 'error');
    }
  }

  function openInvoiceScannerModal() {
    openModal('modalInvoiceScanner');
    startInvoiceScanner();
  }

  async function parseInvoiceFromClipboard() {
    let text = '';
    try {
      if (navigator.clipboard?.readText) {
        text = (await navigator.clipboard.readText()) || '';
      }
    } catch {
      // 忽略，改用 prompt。
    }
    if (!text) {
      text = prompt('請貼上電子發票 QRCode 內容') || '';
    }
    if (!text) return;
    if (!handleInvoiceScanText(text)) {
      setInvoiceScanStatus('無法辨識此 QRCode 內容，請確認為台灣電子發票 QRCode', 'error');
      toast('無法辨識電子發票 QRCode 內容', 'error');
    }
  }

  // ─── Modal 操作 ───
  function openModal(id) { el(id).classList.add('active'); }
  function closeModal(id) {
    if (id === 'modalInvoiceScanner') stopInvoiceScanner();
    el(id).classList.remove('active');
  }

  // 交易
  async function openTransactionModal(txId) {
    const form = el('transactionForm');
    form.reset();
    el('txDate').value = today();
    renderCurrencySelectOptions('txCurrency', 'TWD');
    el('txCurrency').value = 'TWD';
    el('txFxRate').value = '';
    el('txConvertedHint').textContent = '';
    el('txFxFee').value = '';
    el('txFxFeeRate').value = '1.5';
    txFxFeeManual = false;
    el('txExcludeFromStats').checked = false;
    populateTxSelects();
    if (txId) {
      const result = await API.get('/api/transactions?limit=99999');
      const t = result.data.find(x => x.id === txId);
      if (!t) return;
      el('txId').value = t.id;
      el('modalTransactionTitle').textContent = '編輯交易';
      const formType = (t.type === 'transfer_in' || t.type === 'transfer_out') ? 'transfer' : t.type;
      form.querySelector(`input[name="txType"][value="${formType}"]`).checked = true;
      updateTxFormForType(formType);
      el('txAmount').value = Number(t.originalAmount) > 0 ? t.originalAmount : t.amount;
      renderCurrencySelectOptions('txCurrency', t.currency, [t.currency]);
      el('txCurrency').value = normalizeCurrencyCode(t.currency);
      el('txFxRate').value = Number(t.fxRate) > 0 ? t.fxRate : '';
      el('txDate').value = t.date;
      el('txCategory').value = t.categoryId || t.category_id;
      el('txAccount').value = t.accountId || t.account_id;
      el('txNote').value = t.note || '';
      el('txExcludeFromStats').checked = !!t.excludeFromStats;
      if (Number(t.fxFee) > 0) {
        el('txFxFee').value = t.fxFee;
        txFxFeeManual = true; // 保留編輯時的手續費金額
      }
      refreshTxFxUi();
    } else {
      el('txId').value = '';
      el('modalTransactionTitle').textContent = '新增交易';
      updateTxFormForType('expense');
      applyAccountCurrencyToTx();
      refreshTxFxUi();
    }
    openModal('modalTransaction');
  }

  function populateTxSelects() {
    const opts = cachedAccounts.map(a => `<option value="${a.id}">${escHtml(a.name)} (${normalizeCurrencyCode(a.currency)})</option>`).join('');
    el('txAccount').innerHTML = opts;
    el('txFromAccount').innerHTML = opts;
    const type = document.querySelector('input[name="txType"]:checked')?.value || 'expense';
    updateTxFormForType(type);
    applyAccountCurrencyToTx();
  }

  async function applyAndFetchCurrencyRate(c) {
    if (c === 'TWD') {
      el('txFxRate').value = '';
      refreshTxFxUi();
      return;
    }
    const cached = Number(cachedExchangeRates[c]);
    if (cached > 0) {
      el('txFxRate').value = cached;
      refreshTxFxUi();
      return;
    }
    // 幣別無匯率 → 自動向外部 API 查詢並即時更新
    el('txFxRate').disabled = true;
    el('txFxRate').placeholder = '查詢匯率中…';
    el('txFxRate').value = '';
    refreshTxFxUi();
    try {
      const result = await API.post('/api/exchange-rates/refresh', { currencies: [c] });
      const found = (result.rates || []).find(r => normalizeCurrencyCode(r.currency) === c);
      if (found && Number(found.rateToTwd) > 0) {
        cachedExchangeRates[c] = Number(found.rateToTwd);
        el('txFxRate').value = Number(found.rateToTwd);
        toast(`已自動取得 ${c} 匯率：${found.rateToTwd}`, 'success');
      } else {
        toast(`無法自動取得 ${c} 匯率，請手動輸入`, 'warning');
      }
    } catch (e) {
      toast(`取得 ${c} 匯率失敗，請手動輸入`, 'error');
    } finally {
      el('txFxRate').disabled = false;
      el('txFxRate').placeholder = '';
      refreshTxFxUi();
    }
  }

  async function applyAccountCurrencyToTx() {
    const type = document.querySelector('input[name="txType"]:checked')?.value || 'expense';
    if (type === 'transfer') return;
    const accountId = el('txAccount').value;
    const account = cachedAccounts.find(a => a.id === accountId);
    if (!account) return;
    const c = normalizeCurrencyCode(account.currency);
    el('txCurrency').value = c;
    await applyAndFetchCurrencyRate(c);
  }

  let txFxFeeManual = false; // 使用者是否手動修改了手續費金額

  function isTxAccountCreditCard() {
    const accountId = el('txAccount')?.value;
    if (!accountId) return false;
    const account = cachedAccounts.find(a => a.id === accountId);
    return (account?.account_type || '') === '信用卡';
  }

  function refreshTxFxUi() {
    const type = document.querySelector('input[name="txType"]:checked')?.value || 'expense';
    const isTransfer = type === 'transfer';
    const currency = normalizeCurrencyCode(el('txCurrency').value);
    const showFx = !isTransfer && currency !== 'TWD';
    el('txFxRateRow').style.display = showFx ? '' : 'none';
    el('txFxRate').required = showFx;

    const original = Number(el('txAmount').value) || 0;
    const rate = showFx ? (Number(el('txFxRate').value) > 0 ? Number(el('txFxRate').value) : getRateToTwd(currency)) : 1;
    const twd = calcTwdAmount(original, currency, rate);
    el('txConvertedHint').textContent = showFx && original > 0
      ? `約為 ${fmt(twd)}（匯率 ${rate}）`
      : '';

    // 海外刷卡手續費：外幣 + 信用卡 + 支出
    const showFee = showFx && type === 'expense' && isTxAccountCreditCard();
    el('txFxFeeRow').style.display = showFee ? '' : 'none';
    if (showFee && !txFxFeeManual) {
      const feeRate = Number(el('txFxFeeRate').value) || 0;
      const fee = Math.round(twd * feeRate / 100);
      el('txFxFee').value = fee > 0 ? fee : '';
    }
    // 手續費摘要
    const fee = Number(el('txFxFee').value) || 0;
    const summaryEl = el('txFxFeeSummary');
    if (showFee && twd > 0 && fee > 0) {
      summaryEl.textContent = `${fmt(twd)} + 手續費 ${fmt(fee)} = 合計 ${fmt(twd + fee)}`;
    } else {
      summaryEl.textContent = '';
    }
  }

  function buildCategoryOptions(type) {
    if (type === 'transfer') type = 'expense';
    const cats = cachedCategories.filter(c => c.type === type && !c.isHidden);
    const parents = cats.filter(c => !c.parentId);
    let html = '';
    parents.forEach(p => {
      const children = cats.filter(c => c.parentId === p.id);
      if (children.length > 0) {
        html += `<optgroup label="${escHtml(p.name)}">`;
        children.forEach(c => { html += `<option value="${c.id}">${escHtml(c.name)}</option>`; });
        html += '</optgroup>';
      } else {
        html += `<option value="${p.id}">${escHtml(p.name)}</option>`;
      }
    });
    return html;
  }

  function updateCategorySelect(type) {
    el('txCategory').innerHTML = buildCategoryOptions(type);
  }

  function updateTxFormForType(type) {
    const isTransfer = type === 'transfer';
    // 分類：轉帳時隱藏
    el('txCategoryRow').style.display = isTransfer ? 'none' : '';
    el('txCategory').required = !isTransfer;
    // 轉出帳戶：轉帳時顯示
    el('txFromAccountRow').style.display = isTransfer ? '' : 'none';
    el('txFromAccount').required = isTransfer;
    // 帳戶標籤切換
    el('txAccountLabel').innerHTML = isTransfer
      ? '轉入帳戶 <span class="required">*</span>'
      : '帳戶 <span class="required">*</span>';
    if (!isTransfer) {
      updateCategorySelect(type);
      applyAccountCurrencyToTx();
    } else {
      el('txFxRateRow').style.display = 'none';
      el('txFxRate').required = false;
      el('txConvertedHint').textContent = '';
    }
  }

  // 帳戶
  function onAccTypeChange(type) {
    const iconMap = { '銀行': 'fa-building-columns', '信用卡': 'fa-credit-card', '現金': 'fa-money-bill', '虛擬錢包': 'fa-wallet' };
    if (iconMap[type]) el('accIcon').value = iconMap[type];
    const bankRow = el('accLinkedBankRow');
    if (type === '信用卡') {
      bankRow.style.display = '';
      const banks = cachedAccounts.filter(a => a.account_type === '銀行');
      el('accLinkedBank').innerHTML = '<option value="">不分組</option>' +
        banks.map(b => `<option value="${b.id}">${escHtml(b.name)}</option>`).join('');
    } else {
      bankRow.style.display = 'none';
    }
  }

  function openAccountModal(accId) {
    const form = el('accountForm');
    form.reset();
    if (accId) {
      const a = cachedAccounts.find(x => x.id === accId);
      if (!a) return;
      el('accId').value = a.id;
      el('modalAccountTitle').textContent = '編輯帳戶';
      el('accName').value = a.name;
      el('accBalance').value = a.initial_balance ?? a.initialBalance ?? 0;
      el('accType').value = a.account_type || '現金';
      onAccTypeChange(a.account_type || '現金');
      if ((a.account_type || '') === '信用卡') {
        el('accLinkedBank').value = a.linkedBankId || '';
      }
      el('accIcon').value = normalizeAccountIcon(a.icon);
      el('accExclude').checked = !!(a.exclude_from_total);
      renderCurrencySelectOptions('accCurrency', a.currency, [a.currency]);
      el('accCurrency').value = normalizeCurrencyCode(a.currency);
    } else {
      el('accId').value = '';
      el('modalAccountTitle').textContent = '新增帳戶';
      el('accType').value = accountTypeFilter !== 'all' ? accountTypeFilter : '現金';
      onAccTypeChange(el('accType').value);
      renderCurrencySelectOptions('accCurrency', 'TWD');
      el('accCurrency').value = 'TWD';
    }
    openModal('modalAccount');
  }

  // 轉帳
  function openTransferModal() {
    const form = el('transferForm');
    form.reset();
    el('tfDate').value = today();
    const opts = cachedAccounts.map(a => `<option value="${a.id}">${escHtml(a.name)}</option>`).join('');
    el('tfFrom').innerHTML = opts;
    el('tfTo').innerHTML = opts;
    updateTransferAmountLabel();
    openModal('modalTransfer');
  }

  function updateTransferAmountLabel() {
    const fromId = el('tfFrom')?.value;
    const from = cachedAccounts.find(a => a.id === fromId);
    const c = normalizeCurrencyCode(from?.currency || 'TWD');
    el('tfAmountLabel').innerHTML = `金額（${c}） <span class="required">*</span>`;
  }

  function openCreditRepaymentModal(bankId) {
    const bankAcc = cachedAccounts.find(a => a.id === bankId);
    if (!bankAcc) return;
    const cards = cachedAccounts.filter(a => a.linkedBankId === bankId && a.account_type === '信用卡');
    if (cards.length === 0) return toast('此銀行目前沒有已連結的信用卡', 'error');
    el('creditRepaymentTitle').textContent = `信用卡還款（${bankAcc.name}）`;
    el('crDate').value = today();
    const opts = cachedAccounts
      .filter(a => a.account_type !== '信用卡')
      .map(a =>
        `<option value="${a.id}"${a.id === bankId ? ' selected' : ''}>${escHtml(a.name)}</option>`
      ).join('');
    el('crFromAccount').innerHTML = opts;
    el('crCardList').innerHTML = `<table class="cr-card-table">
      <thead><tr><th>信用卡</th><th>目前欠款</th><th>還款金額</th></tr></thead>
      <tbody>${cards.map(c => {
        const currency = normalizeCurrencyCode(c.currency);
        const debt = Math.round(Math.max(0, -(c.balance)) * 100) / 100;
        return `<tr>
          <td>${escHtml(c.name)}</td>
          <td>${fmtByCurrency(c.balance, currency)}</td>
          <td><input type="number" class="cr-amount-input" data-card-id="${c.id}" data-debt="${debt}"
            value="${debt}" min="0" step="0.01" oninput="App.crUpdateTotal()"></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
    crUpdateTotal();
    openModal('modalCreditRepayment');
  }

  function crUpdateTotal() {
    const inputs = document.querySelectorAll('.cr-amount-input');
    const total = Array.from(inputs).reduce((sum, inp) => sum + (Number(inp.value) || 0), 0);
    el('crTotal').textContent = fmt(total);
  }

  function crSetAll() {
    document.querySelectorAll('.cr-amount-input').forEach(inp => {
      inp.value = inp.dataset.debt || 0;
    });
    crUpdateTotal();
  }

  function crClearAll() {
    document.querySelectorAll('.cr-amount-input').forEach(inp => { inp.value = ''; });
    crUpdateTotal();
  }

  // 分類
  function openCategoryModal(type, catId, parentId) {
    const form = el('categoryForm');
    form.reset();
    el('catType').value = type;
    // 填充父分類下拉
    const parentCats = cachedCategories.filter(c => c.type === type && !c.parentId && !c.isHidden);
    let parentOpts = '<option value="">（頂層分類）</option>';
    parentCats.forEach(c => { parentOpts += `<option value="${c.id}">${escHtml(c.name)}</option>`; });
    el('catParent').innerHTML = parentOpts;

    if (catId) {
      const c = cachedCategories.find(x => x.id === catId);
      if (!c) return;
      el('catId').value = c.id;
      el('catType').value = c.type;
      el('modalCategoryTitle').textContent = '編輯分類';
      el('catName').value = c.name;
      el('catColor').value = c.color || '#6366f1';
      el('catParent').value = c.parentId || '';
      // 編輯時：若為父分類（有子分類），不可改為子分類
      const hasChildren = cachedCategories.some(x => x.parentId === c.id);
      el('catParentRow').style.display = hasChildren ? 'none' : '';
    } else {
      el('catId').value = '';
      el('modalCategoryTitle').textContent = parentId ? '新增子分類' : '新增分類';
      el('catParent').value = parentId || '';
      el('catParentRow').style.display = '';
    }
    openModal('modalCategory');
  }

  // 預算
  async function openBudgetModal(budId) {
    const form = el('budgetForm');
    form.reset();
    el('budMonth').value = thisMonth();
    el('budCategory').innerHTML = '<option value="">總預算（不分類）</option>' +
      buildCategoryOptions('expense');
    if (budId) {
      const budgets = await API.get('/api/budgets');
      const b = budgets.find(x => x.id === budId);
      if (!b) return;
      el('budId').value = b.id;
      el('modalBudgetTitle').textContent = '編輯預算';
      el('budCategory').value = b.categoryId || '';
      el('budAmount').value = b.amount;
      el('budMonth').value = b.yearMonth || b.year_month;
    } else {
      el('budId').value = '';
      el('modalBudgetTitle').textContent = '設定預算';
    }
    openModal('modalBudget');
  }

  // 固定收支
  async function openRecurringModal(recId) {
    const form = el('recurringForm');
    form.reset();
    el('recStartDate').value = today();
    el('recAccount').innerHTML = cachedAccounts.map(a => `<option value="${a.id}">${escHtml(a.name)}</option>`).join('');
    updateRecCategorySelect('expense');
    renderCurrencySelectOptions('recCurrency', 'TWD');
    el('recFxRateRow').style.display = 'none';
    el('recFxRate').required = false;
    el('recConvertedHint').textContent = '';
    if (recId) {
      const recs = await API.get('/api/recurring');
      const r = recs.find(x => x.id === recId);
      if (!r) return;
      el('recId').value = r.id;
      el('modalRecurringTitle').textContent = '編輯固定收支';
      form.querySelector(`input[name="recType"][value="${r.type}"]`).checked = true;
      updateRecCategorySelect(r.type);
      const recCurrency = normalizeCurrencyCode(r.currency || 'TWD');
      const origAmount = recCurrency === 'TWD' ? r.amount : (Number(r.fx_rate) > 0 ? Math.round(r.amount / r.fx_rate * 10000) / 10000 : r.amount);
      renderCurrencySelectOptions('recCurrency', recCurrency, [recCurrency]);
      el('recCurrency').value = recCurrency;
      el('recAmount').value = origAmount;
      if (recCurrency !== 'TWD') {
        el('recFxRate').value = r.fxRate || r.fx_rate || '';
        el('recFxRateRow').style.display = '';
        el('recFxRate').required = true;
      }
      el('recCategory').value = r.categoryId;
      el('recAccount').value = r.accountId;
      el('recFrequency').value = r.frequency;
      el('recStartDate').value = r.startDate || r.start_date;
      el('recNote').value = r.note || '';
      refreshRecFxUi();
    } else {
      el('recId').value = '';
      el('modalRecurringTitle').textContent = '新增固定收支';
    }
    openModal('modalRecurring');
  }

  function refreshRecFxUi() {
    const c = normalizeCurrencyCode(el('recCurrency')?.value || 'TWD');
    const showFx = c !== 'TWD';
    el('recFxRateRow').style.display = showFx ? '' : 'none';
    el('recFxRate').required = showFx;
    const original = Number(el('recAmount')?.value) || 0;
    if (showFx && original > 0) {
      const rate = Number(el('recFxRate').value) > 0 ? Number(el('recFxRate').value) : getRateToTwd(c);
      const twd = Math.round(original * rate * 100) / 100;
      el('recConvertedHint').textContent = `≈ TWD ${fmtNum(twd)}`;
    } else {
      el('recConvertedHint').textContent = '';
    }
  }

  function updateRecCategorySelect(type) {
    el('recCategory').innerHTML = buildCategoryOptions(type);
  }

  // ─── 表單綁定 ───
  function bindForms() {
    // 交易類型切換
    document.querySelectorAll('input[name="txType"]').forEach(r => {
      r.addEventListener('change', () => updateTxFormForType(r.value));
    });
    document.querySelectorAll('input[name="recType"]').forEach(r => {
      r.addEventListener('change', () => updateRecCategorySelect(r.value));
    });
    el('txCurrency')?.addEventListener('change', async () => {
      const c = normalizeCurrencyCode(el('txCurrency').value);
      await applyAndFetchCurrencyRate(c);
    });
    el('txFxRate')?.addEventListener('input', refreshTxFxUi);
    el('txAmount')?.addEventListener('input', refreshTxFxUi);

    el('recCurrency')?.addEventListener('change', () => {
      const c = normalizeCurrencyCode(el('recCurrency').value);
      if (c !== 'TWD' && !(Number(el('recFxRate').value) > 0)) {
        el('recFxRate').value = getRateToTwd(c);
      }
      refreshRecFxUi();
    });
    el('recFxRate')?.addEventListener('input', refreshRecFxUi);
    el('recAmount')?.addEventListener('input', refreshRecFxUi);
    el('txAccount')?.addEventListener('change', () => { applyAccountCurrencyToTx(); refreshTxFxUi(); });
    el('txFxFeeRate')?.addEventListener('input', () => { txFxFeeManual = false; refreshTxFxUi(); });
    el('txFxFee')?.addEventListener('input', () => { txFxFeeManual = true; refreshTxFxUi(); });

    // FAB
    el('fabBtn').addEventListener('click', () => {
      const action = el('fabBtn').dataset.action;
      if (action === 'stock-transaction') {
        openStockTxModal();
        return;
      }
      if (action === 'transaction') {
        openTransactionModal();
      }
    });
    el('scanInvoiceQrBtn')?.addEventListener('click', openInvoiceScannerModal);
    el('invoiceScanPasteBtn')?.addEventListener('click', parseInvoiceFromClipboard);

    // 交易表單
    el('transactionForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = el('txId').value;
      const type = document.querySelector('input[name="txType"]:checked').value;
      const amount = Number(el('txAmount').value);
      const date = el('txDate').value;
      const note = el('txNote').value.trim();

      try {
        if (type === 'transfer') {
          const fromId = el('txFromAccount').value;
          const toId = el('txAccount').value;
          if (fromId === toId) { toast('轉出與轉入帳戶不可相同', 'error'); return; }
          await API.post('/api/transactions/transfer', { fromId, toId, amount, date, note });
          closeModal('modalTransaction');
          toast('轉帳成功', 'success');
        } else {
          const categoryId = el('txCategory').value;
          const accountId = el('txAccount').value;
          const currency = normalizeCurrencyCode(el('txCurrency').value);
          const originalAmount = amount;
          const fxRate = currency === 'TWD' ? 1 : Number(el('txFxRate').value || getRateToTwd(currency));
          const showFee = currency !== 'TWD' && type === 'expense' && isTxAccountCreditCard();
          const fxFee = showFee ? (Number(el('txFxFee').value) || 0) : 0;
          const excludeFromStats = el('txExcludeFromStats').checked;
          if (id) {
            await API.put('/api/transactions/' + id, { type, amount, originalAmount, currency, fxRate, fxFee, date, categoryId, accountId, note, excludeFromStats });
          } else {
            await API.post('/api/transactions', { type, amount, originalAmount, currency, fxRate, fxFee, date, categoryId, accountId, note, excludeFromStats });
          }
          closeModal('modalTransaction');
          toast(id ? '交易已更新' : '交易已新增', 'success');
        }
        await refreshCache();
        await renderPage(currentPage);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // 帳戶表單
    el('accountForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = el('accId').value;
      const name = el('accName').value.trim();
      const initialBalance = Number(el('accBalance').value) || 0;
      const icon = normalizeAccountIcon(el('accIcon').value);
      const currency = normalizeCurrencyCode(el('accCurrency').value);
      const accountType = el('accType').value;
      const excludeFromTotal = el('accExclude').checked;
      const linkedBankId = accountType === '信用卡' ? (el('accLinkedBank').value || null) : null;
      if (!name) return;

      try {
        if (id) {
          await API.put('/api/accounts/' + id, { name, initialBalance, icon, currency, accountType, excludeFromTotal, linkedBankId });
        } else {
          await API.post('/api/accounts', { name, initialBalance, icon, currency, accountType, excludeFromTotal, linkedBankId });
        }
        closeModal('modalAccount');
        toast(id ? '帳戶已更新' : '帳戶已新增', 'success');
        await refreshCache();
        await renderPage(currentPage);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // 轉帳表單
    el('transferForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fromId = el('tfFrom').value;
      const toId = el('tfTo').value;
      const amount = Number(el('tfAmount').value);
      const date = el('tfDate').value || today();
      const note = el('tfNote').value.trim();

      try {
        await API.post('/api/transactions/transfer', { fromId, toId, amount, date, note });
        closeModal('modalTransfer');
        toast('轉帳成功', 'success');
        await renderPage(currentPage);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    el('tfFrom')?.addEventListener('change', updateTransferAmountLabel);
    el('creditRepaymentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fromAccountId = el('crFromAccount').value;
      const date = el('crDate').value || today();
      const inputs = document.querySelectorAll('.cr-amount-input');
      const repayments = Array.from(inputs)
        .map(inp => ({ cardId: inp.dataset.cardId, amount: Number(inp.value) || 0 }))
        .filter(r => r.amount > 0);
      if (repayments.length === 0) return toast('請輸入至少一筆還款金額', 'error');
      try {
        await API.post('/api/accounts/credit-card-repayment', { fromAccountId, date, repayments });
        closeModal('modalCreditRepayment');
        toast('還款成功', 'success');
        await refreshCache();
        await renderPage(currentPage);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // 分類表單
    el('categoryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = el('catId').value;
      const type = el('catType').value;
      const name = el('catName').value.trim();
      const color = el('catColor').value;
      const parentId = el('catParent').value;
      if (!name) return;

      try {
        if (id) {
          await API.put('/api/categories/' + id, { name, color });
        } else {
          await API.post('/api/categories', { name, type, color, parentId });
        }
        closeModal('modalCategory');
        toast(id ? '分類已更新' : '分類已新增', 'success');
        await refreshCache();
        await renderPage(currentPage);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // 預算表單
    el('budgetForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const categoryId = el('budCategory').value || null;
      const amount = Number(el('budAmount').value);
      const yearMonth = el('budMonth').value;

      try {
        await API.post('/api/budgets', { categoryId, amount, yearMonth });
        closeModal('modalBudget');
        toast('預算已儲存', 'success');
        await renderPage(currentPage);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // 固定收支表單
    el('recurringForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = el('recId').value;
      const type = document.querySelector('input[name="recType"]:checked').value;
      const amount = Number(el('recAmount').value);
      const currency = normalizeCurrencyCode(el('recCurrency').value || 'TWD');
      const fxRate = currency === 'TWD' ? 1 : (Number(el('recFxRate').value) || getRateToTwd(currency));
      const categoryId = el('recCategory').value;
      const accountId = el('recAccount').value;
      const frequency = el('recFrequency').value;
      const startDate = el('recStartDate').value;
      const note = el('recNote').value.trim();

      try {
        if (id) {
          await API.put('/api/recurring/' + id, { type, amount, currency, fxRate, categoryId, accountId, frequency, startDate, note });
        } else {
          await API.post('/api/recurring', { type, amount, currency, fxRate, categoryId, accountId, frequency, startDate, note });
        }
        closeModal('modalRecurring');
        toast(id ? '固定收支已更新' : '固定收支已新增', 'success');
        await renderPage(currentPage);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // ESC 關閉 modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      }
    });

    // 點擊 overlay 關閉
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });
  }

  // ─── 刪除操作 ───
  function confirmDelete(msg, callback) {
    el('confirmMsg').textContent = msg;
    deleteCallback = callback;
    el('confirmDeleteBtn').onclick = async () => {
      if (deleteCallback) await deleteCallback();
      closeModal('modalConfirm');
      deleteCallback = null;
    };
    openModal('modalConfirm');
  }

  function deleteTransaction(id) {
    confirmDelete('確定要刪除此交易記錄嗎？', async () => {
      await API.del('/api/transactions/' + id);
      toast('交易已刪除', 'success');
      await renderPage(currentPage);
    });
  }

  function deleteCategory(id) {
    confirmDelete('確定要刪除此分類嗎？', async () => {
      try {
        await API.del('/api/categories/' + id);
        toast('分類已刪除', 'success');
        await refreshCache();
        await renderPage(currentPage);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  function deleteAccount(id) {
    confirmDelete('確定要刪除此帳戶嗎？', async () => {
      try {
        await API.del('/api/accounts/' + id);
        toast('帳戶已刪除', 'success');
        await refreshCache();
        await renderPage(currentPage);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  function deleteBudget(id) {
    confirmDelete('確定要刪除此預算嗎？', async () => {
      await API.del('/api/budgets/' + id);
      toast('預算已刪除', 'success');
      await renderPage(currentPage);
    });
  }

  function deleteRecurring(id) {
    confirmDelete('確定要刪除此固定收支嗎？', async () => {
      await API.del('/api/recurring/' + id);
      toast('固定收支已刪除', 'success');
      await renderPage(currentPage);
    });
  }

  async function toggleRecurring(id) {
    await API.patch('/api/recurring/' + id + '/toggle');
    toast('狀態已更新', 'success');
    await renderPage(currentPage);
  }

  // ─── 輔助函式 ───
  function getCat(id) { return cachedCategories.find(c => c.id === id) || null; }
  function getCatDisplayName(cat) {
    if (!cat) return '-';
    if (cat.parentId) {
      const parent = getCat(cat.parentId);
      return parent ? escHtml(parent.name) + ' &gt; ' + escHtml(cat.name) : escHtml(cat.name);
    }
    return escHtml(cat.name);
  }
  function getAcc(id) { return cachedAccounts.find(a => a.id === id) || null; }
  function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function toast(msg, type = '') {
    const container = el('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
  }

  // ─── 版本更新資訊 ───
  let lastChangelogCheckAt = null;

  function compareVersions(a, b) {
    const pa = String(a).split('.').map(n => parseInt(n) || 0);
    const pb = String(b).split('.').map(n => parseInt(n) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  async function fetchChangelog(forceRefresh = true) {
    const url = forceRefresh ? '/api/changelog?refresh=1' : '/api/changelog';
    const data = await (await fetch(url, { cache: 'no-store' })).json();
    lastChangelogCheckAt = new Date();
    return data;
  }

  function formatLastCheckTime(d) {
    if (!d) return '尚未檢查';
    return localDateTimeStr(d) || '時間格式錯誤';
  }

  // 載入版本號到側邊欄
  async function loadVersionLabel() {
    try {
      const data = await fetchChangelog(true);
      if (data.currentVersion) {
        el('appVersionLabel').textContent = data.currentVersion;
      }
      const badge = el('updateBadge');
      // 檢查是否有新版本
      if (data.latestVersion && compareVersions(data.latestVersion, data.currentVersion) > 0) {
        if (badge) {
          badge.style.display = '';
          badge.title = `有新版本 v${data.latestVersion} 可更新`;
        }
      } else if (badge) {
        badge.style.display = 'none';
        badge.title = '';
      }
    } catch (e) { /* ignore */ }
  }

  async function openChangelog() {
    openModal('modalChangelog');
    const content = el('changelogContent');
    content.innerHTML = '<div class="empty-hint">載入中...</div>';

    const render = async (showRefreshing = false) => {
      if (showRefreshing) {
        content.innerHTML = '<div class="empty-hint">正在重新檢查更新...</div>';
      }
      try {
        const data = await fetchChangelog(true);
        await loadVersionLabel();

        if (!data.releases || data.releases.length === 0) {
          content.innerHTML = '<div class="empty-hint">暫無版本資訊</div>';
          return;
        }
        const tagLabels = {
          'new': { text: '新增', cls: 'cl-tag-new' },
          'improved': { text: '改進', cls: 'cl-tag-improved' },
          'fixed': { text: '修正', cls: 'cl-tag-fixed' },
          'removed': { text: '移除', cls: 'cl-tag-removed' }
        };
        const hasUpdate = data.latestVersion && compareVersions(data.latestVersion, data.currentVersion) > 0;
        const canRunUpdate = hasUpdate && !!currentUser?.isAdmin;
        const updateBanner = hasUpdate ? `
          <div class="cl-update-banner">
            <i class="fas fa-arrow-circle-up"></i>
            <div>
              <strong>有新版本可更新！</strong>
              <span>目前 v${escHtml(data.currentVersion)} → 最新 v${escHtml(data.latestVersion)}</span>
            </div>
            ${canRunUpdate
              ? `<button type="button" class="btn btn-sm" id="runAppUpdateBtn"><i class="fas fa-download"></i> 立即更新</button>`
              : '<span class="import-hint">僅管理員可執行更新</span>'}
          </div>
        ` : '';
        content.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 12px;flex-wrap:wrap;">
            <div id="changelogLastCheck" style="font-size:12px;color:var(--text-muted);">
              上次檢查時間：${escHtml(formatLastCheckTime(lastChangelogCheckAt))}
            </div>
            <button type="button" class="btn btn-ghost" id="refreshChangelogBtn">
              <i class="fas fa-rotate-right"></i> 手動重新檢查更新
            </button>
          </div>
          ${updateBanner}
          <div class="cl-current">目前安裝版本 <strong>v${escHtml(data.currentVersion)}</strong></div>
          ${data.releases.map((r, i) => {
            const isCurrent = r.version === data.currentVersion;
            const isNewer = compareVersions(r.version, data.currentVersion) > 0;
            const isLatest = i === 0;
            return `
            <div class="cl-release ${isLatest ? 'cl-latest' : ''} ${isNewer ? 'cl-newer' : ''}">
              <div class="cl-release-header">
                <div class="cl-version-badge">v${escHtml(r.version)}</div>
                <div class="cl-release-info">
                  <span class="cl-release-title">${escHtml(r.title)}</span>
                  <span class="cl-release-date">${escHtml(r.date)}</span>
                </div>
                ${isLatest ? '<span class="cl-latest-badge">最新</span>' : ''}
                ${isCurrent ? '<span class="cl-current-badge">已安裝</span>' : ''}
                ${isNewer && !isLatest ? '<span class="cl-new-badge">新版本</span>' : ''}
              </div>
              <ul class="cl-changes">
                ${r.changes.map(c => {
                  const tag = tagLabels[c.tag] || { text: c.tag, cls: 'cl-tag-new' };
                  return `<li><span class="cl-tag ${tag.cls}">${tag.text}</span>${escHtml(c.text)}</li>`;
                }).join('')}
              </ul>
            </div>
          `}).join('')}
        `;

        const refreshBtn = el('refreshChangelogBtn');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 重新檢查中...';
            await render(true);
          }, { once: true });
        }

        const updateBtn = el('runAppUpdateBtn');
        if (updateBtn) {
          updateBtn.addEventListener('click', async () => {
            if (!confirm('將自動下載並套用最新版本，是否繼續？')) return;
            updateBtn.disabled = true;
            if (refreshBtn) refreshBtn.disabled = true;
            updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 更新中...';
            try {
              const result = await API.post('/api/system/update-app', {});
              toast(result.message || '更新完成', 'success');
              await render(true);
              if (confirm('更新已完成，是否立即重新整理頁面套用最新前端？')) {
                location.reload();
              }
            } catch (e) {
              toast('更新失敗：' + e.message, 'error');
              updateBtn.disabled = false;
              if (refreshBtn) refreshBtn.disabled = false;
              updateBtn.innerHTML = '<i class="fas fa-download"></i> 立即更新';
            }
          }, { once: true });
        }
      } catch (e) {
        content.innerHTML = '<div class="empty-hint">載入版本資訊失敗</div>';
      }
    };

    await render(false);
  }

  // ─── 公開 API ───
  // ─── Passkey (WebAuthn) ───
  const passkeyAvailable = typeof window.PublicKeyCredential !== 'undefined';

  function initPasskeyUI() {
    if (!passkeyAvailable) return;
    const wrap = el('passkeyLoginWrap');
    if (wrap) wrap.style.display = '';
    const altWrap = el('altLoginWrap');
    if (altWrap) altWrap.style.display = '';
  }

  async function passkeyLogin() {
    if (!passkeyAvailable) { toast('此瀏覽器不支援 Passkey', 'error'); return; }
    const errEl = el('loginError');
    if (errEl) errEl.textContent = '';
    try {
      // 1. 取得 challenge
      const { key, challenge } = await (await fetch('/api/auth/passkey/challenge')).json();

      // 2. 呼叫瀏覽器 WebAuthn API
      const { client } = await import('/vendor/webauthn.min.js');
      const authentication = await client.authenticate({
        challenge,
        userVerification: 'preferred',
      });

      // 3. 送到後端驗證
      const r = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authentication, challengeKey: key }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Passkey 登入失敗');

      currentUser = data.user;
      latestLoginRecord = data.currentLogin || null;
      await enterApp();
    } catch (err) {
      if (err.name === 'NotAllowedError') return; // 使用者取消
      if (errEl) errEl.textContent = err.message || 'Passkey 登入失敗';
    }
  }

  async function registerPasskey() {
    if (!passkeyAvailable) { toast('此瀏覽器不支援 Passkey', 'error'); return; }
    try {
      // 1. 取得 challenge
      const { key, challenge } = await API.get('/api/account/passkey/challenge');

      // 2. 呼叫瀏覽器 WebAuthn API
      const { client } = await import('/vendor/webauthn.min.js');
      const registration = await client.register({
        user: currentUser?.displayName || currentUser?.email || 'User',
        challenge,
        discoverable: 'required',
        userVerification: 'required',
      });

      // 3. 命名
      const deviceName = prompt('為此 Passkey 命名（例如：MacBook、iPhone）：', 'Passkey') || 'Passkey';

      // 4. 送到後端驗證並儲存
      await API.post('/api/account/passkey/register', {
        registration,
        challengeKey: key,
        deviceName: deviceName.trim(),
      });

      toast('Passkey 已註冊成功', 'success');
      await renderPasskeyList();
    } catch (err) {
      if (err.name === 'NotAllowedError') return; // 使用者取消
      toast(err.message || 'Passkey 註冊失敗', 'error');
    }
  }

  async function renderPasskeyList() {
    const container = el('passkeyList');
    if (!container) return;
    try {
      const { passkeys } = await API.get('/api/account/passkeys');
      if (!passkeys || passkeys.length === 0) {
        container.innerHTML = `<div class="passkey-empty"><i class="fas fa-key" style="color:var(--text-muted);margin-right:6px"></i>尚未註冊任何 Passkey</div>`;
        return;
      }
      container.innerHTML = passkeys.map(pk => `
        <div class="passkey-item">
          <div class="passkey-info">
            <i class="fas fa-fingerprint" style="color:var(--primary);margin-right:8px"></i>
            <span class="passkey-name">${escHtml(pk.deviceName || 'Passkey')}</span>
            <span class="passkey-date">${pk.createdAt || ''}</span>
          </div>
          <button class="btn-icon danger" onclick="App.deletePasskey('${escHtml(pk.id)}')" title="刪除">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `).join('');
    } catch {
      container.innerHTML = '<span style="color:var(--text-muted);font-size:13px">載入 Passkey 列表失敗</span>';
    }
  }

  async function deletePasskey(credId) {
    if (!confirm('確定要刪除此 Passkey？刪除後將無法使用此裝置進行無密碼登入。')) return;
    try {
      await API.delete('/api/account/passkey/' + encodeURIComponent(credId));
      toast('Passkey 已刪除', 'success');
      await renderPasskeyList();
    } catch (err) {
      toast(err.message || '刪除失敗', 'error');
    }
  }

  return {
    init,
    closeModal,
    openCategoryModal,
    editTransaction: openTransactionModal,
    deleteTransaction,
    editCategory: (id) => { const c = cachedCategories.find(x => x.id === id); if (c) openCategoryModal(c.type, id); },
    deleteCategory,
    editAccount: openAccountModal,
    deleteAccount,
    setAccountTypeFilter: (type) => { accountTypeFilter = type; renderAccounts(); },
    openCreditRepaymentModal,
    crUpdateTotal,
    crSetAll,
    crClearAll,
    onAccTypeChange,
    editBudget: openBudgetModal,
    deleteBudget,
    editRecurring: openRecurringModal,
    deleteRecurring,
    toggleRecurring,
    txGoPage: (p) => applyFilters(p),
    toggleTxSelect,
    // 股票
    openFormulaModal,
    openStockModal,
    editStock: openStockModal,
    deleteStock,
    openStockTxModal,
    editStockTx: openStockTxModal,
    deleteStockTx,
    openStockDivModal,
    editStockDiv: openStockDivModal,
    deleteStockDiv,
    editStockRecurring: openStockRecurringModal,
    deleteStockRecurring,
    toggleStockRecurring,
    openPriceUpdateModal,
    syncDividends,
    toggleStkTxSelect,
    toggleStkDivSelect,
    stkTxGoPage: (p) => renderStockTransactions(p),
    stkTxSort,
    stkDivSort,
    stkDivGoPage: (p) => renderStockDividends(p),
    toggleAdminLoginLogSelect,
    toggleAllAdminLoginLogs,
    toggleAdminAllLoginLogSelect,
    toggleAllAdminAllLoginLogs,
    deleteAdminLoginLog,
    deleteAdminAllLoginLog,
    accountLogGoPage,
    adminLoginLogGoPage,
    adminAllLoginLogGoPage,
    openChangelog,
    googleFallbackLogin,
    passkeyLogin,
    registerPasskey,
    deletePasskey,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);

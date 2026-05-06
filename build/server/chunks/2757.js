exports.id=2757,exports.ids=[2757],exports.modules={9256:(a,b,c)=>{"use strict";c.d(b,{OB:()=>i,VX:()=>h,ZT:()=>j,oC:()=>f,si:()=>k,ts:()=>g});var d=c(86802),e=c(66147);async function f(a){return await (0,e.requireAuth)()}function g(a){return{id:a.id,email:a.email,displayName:a.display_name,isAdmin:!!a.is_admin,themeMode:a.theme_mode}}async function h(a,b){return(await (0,d.cookies)()).set("authToken",b,{httpOnly:!0,secure:!0,sameSite:"strict",path:"/",maxAge:604800}),a}async function i(){(await (0,d.cookies)()).delete("authToken")}async function j(){return await f()}function k(a){let b=String(a||"").trim().toLowerCase();return"light"===b||"dark"===b||"system"===b?b:"system"}c(30477)},16825:(a,b,c)=>{"use strict";let d=c(33873),e=c(29021),f=c(55511),g=process.env.DB_PATH||d.join(process.cwd(),"database.db"),h=process.env.DB_ENCRYPTION_KEY||"",i=Buffer.from("EADB");function j(a,b){return f.pbkdf2Sync(a,b,1e5,32,"sha256")}function k(a,b){let c=f.randomBytes(16),d=j(b,c),e=f.randomBytes(12),g=f.createCipheriv("chacha20-poly1305",d,e,{authTagLength:16}),h=Buffer.concat([g.update(a),g.final()]),k=g.getAuthTag();return Buffer.concat([i,c,e,k,h])}function l(a,b){if(a.length<48)throw Error("加密檔案格式錯誤：檔案太小");if(!a.subarray(0,4).equals(i))throw Error("非加密資料庫檔案");let c=a.subarray(4,20),d=a.subarray(20,32),e=a.subarray(32,48),g=a.subarray(48),h=j(b,c),k=f.createDecipheriv("chacha20-poly1305",h,d,{authTagLength:16});return k.setAuthTag(e),Buffer.concat([k.update(g),k.final()])}function m(a){return!!Buffer.isBuffer(a)&&a.length>=4&&a.subarray(0,4).equals(i)}let n=globalThis.__sqlDb||null,o=!1,p=!1;function q(){if(o){p=!0;return}o=!0,(async()=>{try{for(;;){p=!1;let a=n.export(),b=Buffer.from(a),c=h?k(b,h):b,d=g+".tmp";if(await e.promises.writeFile(d,c),await e.promises.rename(d,g),!p)break}}catch(a){console.error("saveDB failed:",a?.message??a)}finally{o=!1}})()}function r(){let a=n.export(),b=Buffer.from(a),c=h?k(b,h):b;e.writeFileSync(g,c)}function s(){if(n||(n=globalThis.__sqlDb??null),!n)throw Error("DB 尚未初始化，請確認 instrumentation.js 已執行");return n}async function t(){let a=n;a.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT
  )`),a.run(`CREATE TABLE IF NOT EXISTS login_audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    login_at INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    login_method TEXT DEFAULT 'password',
    is_admin_login INTEGER DEFAULT 0
  )`),a.run("CREATE INDEX IF NOT EXISTS idx_login_audit_user_time ON login_audit_logs(user_id, login_at DESC)"),a.run("CREATE INDEX IF NOT EXISTS idx_login_audit_time ON login_audit_logs(login_at DESC)"),a.run(`CREATE TABLE IF NOT EXISTS data_operation_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    timestamp TEXT NOT NULL,
    result TEXT NOT NULL,
    is_admin_operation INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}'
  )`),a.run("CREATE INDEX IF NOT EXISTS idx_data_audit_user_time ON data_operation_audit_log(user_id, timestamp DESC)"),a.run("CREATE INDEX IF NOT EXISTS idx_data_audit_time ON data_operation_audit_log(timestamp DESC)"),a.run("CREATE INDEX IF NOT EXISTS idx_data_audit_action ON data_operation_audit_log(action)"),a.run(`CREATE TABLE IF NOT EXISTS login_attempt_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT '',
    email TEXT NOT NULL,
    login_at INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    login_method TEXT DEFAULT 'password',
    is_admin_login INTEGER DEFAULT 0,
    is_success INTEGER DEFAULT 0,
    failure_reason TEXT DEFAULT ''
  )`),a.run("CREATE INDEX IF NOT EXISTS idx_login_attempt_time ON login_attempt_logs(login_at DESC)"),a.run("CREATE INDEX IF NOT EXISTS idx_login_attempt_email_time ON login_attempt_logs(email, login_at DESC)"),a.run(`CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    public_registration INTEGER DEFAULT 1,
    allowed_registration_emails TEXT DEFAULT '',
    admin_ip_allowlist TEXT DEFAULT '',
    updated_at INTEGER DEFAULT 0,
    updated_by TEXT DEFAULT ''
  )`);let b=b=>{try{a.run(b)}catch{}};b("ALTER TABLE system_settings ADD COLUMN admin_ip_allowlist TEXT DEFAULT ''"),b("ALTER TABLE system_settings ADD COLUMN report_schedule_freq TEXT DEFAULT 'off'"),b("ALTER TABLE system_settings ADD COLUMN report_schedule_hour INTEGER DEFAULT 9"),b("ALTER TABLE system_settings ADD COLUMN report_schedule_weekday INTEGER DEFAULT 1"),b("ALTER TABLE system_settings ADD COLUMN report_schedule_day_of_month INTEGER DEFAULT 1"),b("ALTER TABLE system_settings ADD COLUMN report_schedule_last_run INTEGER DEFAULT 0"),b("ALTER TABLE system_settings ADD COLUMN report_schedule_last_summary TEXT DEFAULT ''"),b("ALTER TABLE system_settings ADD COLUMN report_schedule_user_ids TEXT DEFAULT ''"),b("ALTER TABLE system_settings ADD COLUMN server_time_offset INTEGER DEFAULT 0"),b("ALTER TABLE system_settings ADD COLUMN audit_log_retention_days TEXT DEFAULT '90'"),b("ALTER TABLE system_settings ADD COLUMN route_audit_mode TEXT DEFAULT 'security'"),a.run("INSERT OR IGNORE INTO system_settings (id, public_registration, allowed_registration_emails, admin_ip_allowlist, updated_at, updated_by) VALUES (1, 1, '', '', ?, '')",[Date.now()]),a.run(`CREATE TABLE IF NOT EXISTS report_schedules (
    id              TEXT    PRIMARY KEY,
    user_id         TEXT    NOT NULL,
    freq            TEXT    NOT NULL,
    hour            INTEGER NOT NULL DEFAULT 9,
    weekday         INTEGER NOT NULL DEFAULT 1,
    day_of_month    INTEGER NOT NULL DEFAULT 1,
    enabled         INTEGER NOT NULL DEFAULT 1,
    last_run        INTEGER NOT NULL DEFAULT 0,
    last_summary    TEXT    NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL DEFAULT 0,
    updated_at      INTEGER NOT NULL DEFAULT 0
  )`),b("CREATE INDEX IF NOT EXISTS idx_report_schedules_user ON report_schedules(user_id)"),b("CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled_freq ON report_schedules(enabled, freq)"),a.run(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    color TEXT DEFAULT '#6366f1',
    is_default INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    parent_id TEXT DEFAULT ''
  )`),a.run(`CREATE TABLE IF NOT EXISTS deleted_defaults (
    user_id TEXT NOT NULL,
    default_key TEXT NOT NULL,
    deleted_at INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, default_key)
  )`),b("CREATE INDEX IF NOT EXISTS idx_cat_user_parent_sort ON categories(user_id, parent_id, sort_order)"),b("CREATE INDEX IF NOT EXISTS idx_cat_user_type ON categories(user_id, type)"),a.run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    initial_balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'TWD',
    icon TEXT DEFAULT 'fa-wallet',
    created_at TEXT
  )`),a.run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'TWD',
    original_amount REAL DEFAULT 0,
    fx_rate REAL DEFAULT 1,
    date TEXT NOT NULL,
    category_id TEXT,
    account_id TEXT,
    note TEXT DEFAULT '',
    linked_id TEXT DEFAULT '',
    created_at INTEGER,
    updated_at INTEGER
  )`),a.run(`CREATE TABLE IF NOT EXISTS exchange_rates (
    user_id TEXT NOT NULL,
    currency TEXT NOT NULL,
    rate_to_twd REAL NOT NULL,
    updated_at INTEGER,
    PRIMARY KEY (user_id, currency)
  )`),a.run(`CREATE TABLE IF NOT EXISTS exchange_rate_settings (
    user_id TEXT PRIMARY KEY,
    auto_update INTEGER DEFAULT 0,
    last_synced_at INTEGER DEFAULT 0,
    updated_at INTEGER
  )`),a.run(`CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT,
    amount REAL NOT NULL,
    period TEXT DEFAULT 'monthly',
    year INTEGER,
    month INTEGER,
    created_at INTEGER,
    updated_at INTEGER
  )`),a.run(`CREATE TABLE IF NOT EXISTS recurring (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'TWD',
    category_id TEXT,
    account_id TEXT,
    freq TEXT NOT NULL,
    next_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER
  )`),a.run(`CREATE TABLE IF NOT EXISTS stocks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    shares REAL DEFAULT 0,
    avg_cost REAL DEFAULT 0,
    currency TEXT DEFAULT 'TWD',
    account_id TEXT DEFAULT '',
    created_at INTEGER,
    updated_at INTEGER
  )`),a.run(`CREATE TABLE IF NOT EXISTS stock_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    type TEXT NOT NULL,
    shares REAL NOT NULL,
    price REAL NOT NULL,
    fee REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at INTEGER
  )`),a.run(`CREATE TABLE IF NOT EXISTS stock_dividends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    amount REAL NOT NULL,
    shares REAL DEFAULT 0,
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at INTEGER
  )`),a.run(`CREATE TABLE IF NOT EXISTS stock_recurring (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    stock_id TEXT NOT NULL,
    freq TEXT NOT NULL,
    shares REAL NOT NULL,
    price REAL DEFAULT 0,
    next_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER
  )`),a.run(`CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    pinned_currencies TEXT DEFAULT '[]',
    updated_at INTEGER
  )`),b("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'"),b("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"),b("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Asia/Taipei'"),b("ALTER TABLE users ADD COLUMN theme_mode TEXT DEFAULT 'system'"),b("ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT ''"),b("ALTER TABLE users ADD COLUMN google_sub TEXT DEFAULT ''"),b("ALTER TABLE users ADD COLUMN has_password INTEGER DEFAULT 1"),b("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''"),b("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0"),b("ALTER TABLE users ADD COLUMN passkey_credentials TEXT DEFAULT '[]'"),b("ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN type TEXT DEFAULT 'checking'"),b("ALTER TABLE accounts ADD COLUMN balance REAL DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN color TEXT DEFAULT '#6366f1'"),b("ALTER TABLE accounts ADD COLUMN sort_order INTEGER DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1"),b("ALTER TABLE accounts ADD COLUMN updated_at INTEGER DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN note TEXT DEFAULT ''"),b("ALTER TABLE transactions ADD COLUMN transfer_to_account_id TEXT DEFAULT ''"),b("ALTER TABLE transactions ADD COLUMN tags TEXT DEFAULT '[]'"),b("ALTER TABLE stock_transactions ADD COLUMN realized_pl REAL DEFAULT 0");let d=c(33873).join(process.cwd(),"backups");c(29021).existsSync(d)||c(29021).mkdirSync(d,{recursive:!0}),q()}async function u(a){let b=c(33296),e=await b({locateFile:a=>d.join(process.cwd(),"node_modules","sql.js","dist",a)});if(n)try{n.close()}catch(a){}n=new e.Database(a),q(),await t()}a.exports={initDB:async function a(){if(n)return;let a=c(33296),b=await a({locateFile:a=>d.join(process.cwd(),"node_modules","sql.js","dist",a)});if(e.existsSync(g)){let a=e.readFileSync(g),c=m(a);if(c&&!h&&(console.error("錯誤：資料庫已加密但未設定 DB_ENCRYPTION_KEY，無法啟動"),process.exit(1)),c)try{let c=l(a,h);n=new b.Database(c),console.log("已載入加密資料庫（ChaCha20-Poly1305）")}catch(a){console.error("資料庫解密失敗（金鑰可能不正確）:",a.message),process.exit(1)}else h?(n=new b.Database(a),console.log("偵測到未加密資料庫，自動加密中..."),q(),console.log("資料庫已自動加密完成")):n=new b.Database(a)}else n=new b.Database,h&&console.log("將使用加密模式儲存新資料庫");globalThis.__sqlDb=n,await t(),console.log("資料庫初始化完成")},getDB:s,saveDB:q,saveDBSync:r,flushOnExit:()=>{try{r()}catch{}},queryOne:function(a,b=[]){let c=s().prepare(a);if(c.bind(b),c.step()){let a=c.getAsObject();return c.free(),a}return c.free(),null},queryAll:function(a,b=[]){let c=s().prepare(a);c.bind(b);let d=[];for(;c.step();)d.push(c.getAsObject());return c.free(),d},isEncryptedDB:m,encryptBuffer:k,decryptBuffer:l,replaceDB:u}},30477:(a,b,c)=>{"use strict";c.d(b,{A:()=>e});var d=c(88015);let e=c.n(d)()({level:process.env.LOG_LEVEL||"info",transport:void 0})},58983:(a,b,c)=>{"use strict";let{getDB:d,queryOne:e,queryAll:f,saveDB:g}=c(16825),h={TWD:1,USD:31.5,JPY:.21,EUR:34.2,CNY:4.35,HKD:4.03};function i(a){let b=String(a||"TWD").trim().toUpperCase();return/^[A-Z]{3}$/.test(b)?b:"TWD"}function j(a){let b=String(a||"").trim().toLowerCase();return/^fa-[a-z0-9-]{1,40}$/.test(b)?b:"fa-wallet"}function k(a){switch(a){case"銀行":return"bank";case"信用卡":return"credit_card";case"虛擬錢包":case"虛擬":return"virtual_wallet";default:return"cash"}}function l(a,b){let c=i(b);if("TWD"===c)return 1;let d=e("SELECT rate_to_twd FROM exchange_rates WHERE user_id = ? AND currency = ?",[a,c]);return d&&Number(d.rate_to_twd)>0?Number(d.rate_to_twd):Number(h[c])||1}function m(a,b,c){let d=i(b),e=Number(a)||0;if("TWD"===d)return e;let f=l(c,d);return f>0?Math.round(e/f*100)/100:e}function n(a,b,c,d="TWD"){let e=Number(b)||0;return f("SELECT type, amount, currency, original_amount FROM transactions WHERE account_id = ? AND user_id = ?",[a,c]).forEach(a=>{let b=i(a.currency)===d?Number(a.original_amount)>0?Number(a.original_amount):Number(a.amount)||0:m(a.amount,d,c);"income"===a.type||"transfer_in"===a.type?e+=b:("expense"===a.type||"transfer_out"===a.type)&&(e-=b)}),Math.round(100*e)/100}a.exports={normalizeCurrency:i,parseCurrencyCode:function(a){let b=String(a||"").trim().toUpperCase();return/^[A-Z]{3}$/.test(b)?b:""},normalizeAccountIcon:j,categoryFromAccountType:k,accountTypeFromCategory:function(a){switch(a){case"bank":return"銀行";case"credit_card":return"信用卡";case"virtual_wallet":return"虛擬錢包";default:return"現金"}},getUserExchangeRateMap:function(a){let b=f("SELECT currency, rate_to_twd FROM exchange_rates WHERE user_id = ?",[a]),c={TWD:1};return b.forEach(a=>{let b=i(a.currency),d=Number(a.rate_to_twd);d>0&&(c[b]=d)}),c.TWD=1,c},getExchangeRateToTwd:l,convertFromTwd:m,convertToTwd:function(a,b,c,d){let e=i(b),f=Number(a);if(!(f>0))throw Error("金額必須大於 0");let g="TWD"===e?1:Number(c)>0?Number(c):l(d,e),h=Math.round(f*g*100)/100;return{currency:e,originalAmount:f,fxRate:g,twdAmount:h}},normalizeDate:function(a){if(!a)return"";let b=String(a).trim(),c="";if(/^\d{4}-\d{2}-\d{2}$/.test(b))c=b;else if(/^\d{8}$/.test(b))c=b.slice(0,4)+"-"+b.slice(4,6)+"-"+b.slice(6,8);else{if(!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(b))return"";let[a,d,e]=b.split("/");c=`${a}-${d.padStart(2,"0")}-${e.padStart(2,"0")}`}let[d,e,f]=c.split("-").map(Number),g=new Date(Date.UTC(d,e-1,f));return g.getUTCFullYear()!==d||g.getUTCMonth()+1!==e||g.getUTCDate()!==f?"":c},calcBalance:n,getExchangeRateSettings:function(a){let b=e("SELECT * FROM exchange_rate_settings WHERE user_id = ?",[a]);return b||(d().run("INSERT INTO exchange_rate_settings (user_id, auto_update, last_synced_at, updated_at) VALUES (?, 0, 0, ?)",[a,Date.now()]),g(),b=e("SELECT * FROM exchange_rate_settings WHERE user_id = ?",[a])),{autoUpdate:!!b?.auto_update,lastSyncedAt:Number(b?.last_synced_at)||0}},formatAccount:function(a,b,c){return{...a,icon:j(a.icon),initialBalance:a.initial_balance,currency:i(a.currency),balance:b??n(a.id,a.initial_balance,a.user_id,i(a.currency)),twdAccumulated:c??0,linkedBankId:a.linked_bank_id||null,category:a.category||k(a.account_type),overseasFeeRate:a.overseas_fee_rate??null,excludeFromTotal:1===a.exclude_from_total,updatedAt:Number(a.updated_at)||0}},DEFAULT_EXCHANGE_RATES:h}},66147:(a,b,c)=>{"use strict";c.r(b),c.d(b,{AUTH_COOKIE_OPTIONS:()=>m,getSession:()=>i,requireAuth:()=>j,signToken:()=>k,verifyToken:()=>l});var d=c(86802),e=c(82161),f=c(48318),g=c.n(f);let h=process.env.JWT_SECRET||"default_secret";async function i(){let a=(await (0,d.cookies)()).get("authToken");return a?a.value:null}async function j(){let a=await i();return a||(0,e.redirect)("/login"),a}function k(a,b){return g().sign({userId:a,tokenVersion:b},h,{expiresIn:"7d"})}function l(a){return g().verify(a,h)}let m={httpOnly:!0,secure:!0,sameSite:"strict",path:"/"}},70374:(a,b,c)=>{"use strict";let{queryOne:d}=c(16825),{NextResponse:e}=c(10641),f={accounts:1,transactions:1,user_settings:1},g={id:1,user_id:1};a.exports={ownsResource:function(a,b,c,e){return a&&b&&null!=c&&e&&f[a]&&g[b]?d(`SELECT * FROM ${a} WHERE ${b} = ? AND user_id = ? LIMIT 1`,[String(c),String(e)]):null},assertOptimisticLock:function(a,b,c,e){if(!f[a]||!g[b])throw{status:500,error:"InvalidLockTarget"};let h=d(`SELECT updated_at FROM ${a} WHERE ${b} = ? LIMIT 1`,[String(c)]);if(!h)throw{status:404,error:"NotFound"};let i=Number(e);if(!Number.isFinite(i)||i<=0)throw{status:400,error:"MissingExpectedUpdatedAt",message:"請帶 expected_updated_at"};if(Number(h.updated_at)!==i)throw{status:409,error:"OptimisticLockConflict",serverUpdatedAt:Number(h.updated_at),message:"此筆已被其他裝置修改，請重新整理後再操作"}},lockErrorResponse:function(a){if(a&&"object"==typeof a&&a.status){let b={error:a.message||a.error||"Error",code:a.error||"Error"};return a.serverUpdatedAt&&(b.serverUpdatedAt=a.serverUpdatedAt),e.json(b,{status:a.status})}return e.json({error:"伺服器內部錯誤",code:"InternalServerError"},{status:500})}}},78335:()=>{},96487:()=>{}};
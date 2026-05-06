exports.id=4453,exports.ids=[4453],exports.modules={9256:(a,b,c)=>{"use strict";c.d(b,{OB:()=>i,VX:()=>h,ZT:()=>j,oC:()=>f,si:()=>k,ts:()=>g});var d=c(86802),e=c(66147);async function f(a){return await (0,e.requireAuth)()}function g(a){return{id:a.id,email:a.email,displayName:a.display_name,isAdmin:!!a.is_admin,themeMode:a.theme_mode}}async function h(a,b){return(await (0,d.cookies)()).set("authToken",b,{httpOnly:!0,secure:!0,sameSite:"strict",path:"/",maxAge:604800}),a}async function i(){(await (0,d.cookies)()).delete("authToken")}async function j(){return await f()}function k(a){let b=String(a||"").trim().toLowerCase();return"light"===b||"dark"===b||"system"===b?b:"system"}c(30477)},16825:(a,b,c)=>{"use strict";let d=c(33873),e=c(29021),f=c(55511),g=process.env.DB_PATH||d.join(process.cwd(),"database.db"),h=process.env.DB_ENCRYPTION_KEY||"",i=Buffer.from("EADB");function j(a,b){return f.pbkdf2Sync(a,b,1e5,32,"sha256")}function k(a,b){let c=f.randomBytes(16),d=j(b,c),e=f.randomBytes(12),g=f.createCipheriv("chacha20-poly1305",d,e,{authTagLength:16}),h=Buffer.concat([g.update(a),g.final()]),k=g.getAuthTag();return Buffer.concat([i,c,e,k,h])}function l(a,b){if(a.length<48)throw Error("加密檔案格式錯誤：檔案太小");if(!a.subarray(0,4).equals(i))throw Error("非加密資料庫檔案");let c=a.subarray(4,20),d=a.subarray(20,32),e=a.subarray(32,48),g=a.subarray(48),h=j(b,c),k=f.createDecipheriv("chacha20-poly1305",h,d,{authTagLength:16});return k.setAuthTag(e),Buffer.concat([k.update(g),k.final()])}function m(a){return!!Buffer.isBuffer(a)&&a.length>=4&&a.subarray(0,4).equals(i)}let n=globalThis.__sqlDb||null,o=!1,p=!1;function q(){if(o){p=!0;return}o=!0,(async()=>{try{for(;;){p=!1;let a=n.export(),b=Buffer.from(a),c=h?k(b,h):b,d=g+".tmp";if(await e.promises.writeFile(d,c),await e.promises.rename(d,g),!p)break}}catch(a){console.error("saveDB failed:",a?.message??a)}finally{o=!1}})()}function r(){let a=n.export(),b=Buffer.from(a),c=h?k(b,h):b;e.writeFileSync(g,c)}function s(){if(n||(n=globalThis.__sqlDb??null),!n)throw Error("DB 尚未初始化，請確認 instrumentation.js 已執行");return n}async function t(){let a=n;a.run(`CREATE TABLE IF NOT EXISTS users (
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
  )`),b("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'"),b("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"),b("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Asia/Taipei'"),b("ALTER TABLE users ADD COLUMN theme_mode TEXT DEFAULT 'system'"),b("ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT ''"),b("ALTER TABLE users ADD COLUMN google_sub TEXT DEFAULT ''"),b("ALTER TABLE users ADD COLUMN has_password INTEGER DEFAULT 1"),b("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''"),b("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0"),b("ALTER TABLE users ADD COLUMN passkey_credentials TEXT DEFAULT '[]'"),b("ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN type TEXT DEFAULT 'checking'"),b("ALTER TABLE accounts ADD COLUMN balance REAL DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN color TEXT DEFAULT '#6366f1'"),b("ALTER TABLE accounts ADD COLUMN sort_order INTEGER DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1"),b("ALTER TABLE accounts ADD COLUMN updated_at INTEGER DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN note TEXT DEFAULT ''"),b("ALTER TABLE transactions ADD COLUMN transfer_to_account_id TEXT DEFAULT ''"),b("ALTER TABLE transactions ADD COLUMN tags TEXT DEFAULT '[]'"),b("ALTER TABLE stock_transactions ADD COLUMN realized_pl REAL DEFAULT 0");let d=c(33873).join(process.cwd(),"backups");c(29021).existsSync(d)||c(29021).mkdirSync(d,{recursive:!0}),q()}async function u(a){let b=c(33296),e=await b({locateFile:a=>d.join(process.cwd(),"node_modules","sql.js","dist",a)});if(n)try{n.close()}catch(a){}n=new e.Database(a),q(),await t()}a.exports={initDB:async function a(){if(n)return;let a=c(33296),b=await a({locateFile:a=>d.join(process.cwd(),"node_modules","sql.js","dist",a)});if(e.existsSync(g)){let a=e.readFileSync(g),c=m(a);if(c&&!h&&(console.error("錯誤：資料庫已加密但未設定 DB_ENCRYPTION_KEY，無法啟動"),process.exit(1)),c)try{let c=l(a,h);n=new b.Database(c),console.log("已載入加密資料庫（ChaCha20-Poly1305）")}catch(a){console.error("資料庫解密失敗（金鑰可能不正確）:",a.message),process.exit(1)}else h?(n=new b.Database(a),console.log("偵測到未加密資料庫，自動加密中..."),q(),console.log("資料庫已自動加密完成")):n=new b.Database(a)}else n=new b.Database,h&&console.log("將使用加密模式儲存新資料庫");globalThis.__sqlDb=n,await t(),console.log("資料庫初始化完成")},getDB:s,saveDB:q,saveDBSync:r,flushOnExit:()=>{try{r()}catch{}},queryOne:function(a,b=[]){let c=s().prepare(a);if(c.bind(b),c.step()){let a=c.getAsObject();return c.free(),a}return c.free(),null},queryAll:function(a,b=[]){let c=s().prepare(a);c.bind(b);let d=[];for(;c.step();)d.push(c.getAsObject());return c.free(),d},isEncryptedDB:m,encryptBuffer:k,decryptBuffer:l,replaceDB:u}},30477:(a,b,c)=>{"use strict";c.d(b,{A:()=>e});var d=c(88015);let e=c.n(d)()({level:process.env.LOG_LEVEL||"info",transport:void 0})},54398:(a,b,c)=>{"use strict";let d=c(55511),{getDB:e,queryOne:f,queryAll:g,saveDB:h}=c(16825);function i(){return d.randomUUID().replace(/-/g,"")}function j(){let a=new Date;return`${a.getFullYear()}-${String(a.getMonth()+1).padStart(2,"0")}-${String(a.getDate()).padStart(2,"0")}`}let k=[["餐飲","#ef4444"],["交通","#f97316"],["購物","#eab308"],["娛樂","#8b5cf6"],["居住","#06b6d4"],["醫療","#ec4899"],["教育","#3b82f6"],["其他","#64748b"]],l=[["薪資","#10b981"],["獎金","#14b8a6"],["投資","#6366f1"],["兼職","#f59e0b"],["其他","#71717a"]],m={expense:{餐飲:[["早餐","#fca5a5"],["午餐","#f87171"],["晚餐","#dc2626"],["飲料","#fb923c"],["點心","#fdba74"]],交通:[["大眾運輸","#fdba74"],["計程車","#fb923c"],["加油","#f97316"],["停車費","#ea580c"],["高鐵/火車","#c2410c"]],購物:[["日用品","#fde047"],["服飾","#facc15"],["3C用品","#eab308"],["家電","#ca8a04"],["美妝保養","#a16207"]],娛樂:[["電影/影音","#a78bfa"],["遊戲","#8b5cf6"],["旅遊","#7c3aed"],["運動健身","#6d28d9"],["訂閱服務","#5b21b6"]],居住:[["房租/房貸","#22d3ee"],["水電費","#06b6d4"],["瓦斯費","#0891b2"],["網路費","#0e7490"],["管理費","#155e75"]],醫療:[["掛號費","#f9a8d4"],["藥品","#f472b6"],["保健食品","#ec4899"],["牙科","#db2777"],["健檢","#be185d"]],教育:[["學費","#93c5fd"],["書籍","#60a5fa"],["線上課程","#3b82f6"],["補習費","#2563eb"]],其他:[["雜支","#94a3b8"],["禮金/紅包","#64748b"],["捐款","#475569"],["罰款","#334155"]]},income:{薪資:[["月薪","#34d399"],["加班費","#10b981"]],獎金:[["年終獎金","#5eead4"],["績效獎金","#2dd4bf"],["節日禮金","#14b8a6"]],投資:[["股利","#a5b4fc"],["利息","#818cf8"],["資本利得","#6366f1"]],兼職:[["接案","#fbbf24"],["家教","#f59e0b"],["打工","#d97706"]],其他:[["退稅","#a1a1aa"],["贈與/紅包","#71717a"],["雜項","#52525b"]]}},n={feeRate:.001425,feeDiscount:1,feeMinLot:20,feeMinOdd:1,sellTaxRateStock:.003,sellTaxRateEtf:.001,sellTaxRateWarrant:.001,sellTaxMin:1};function o(a,b,c){return null==b||""===b?`${a}:${c}`:`${a}:${b}:${c}`}a.exports={uid:i,todayStr:j,createDefaultsForUser:function(a){let b=e(),c=0;for(let[d,e]of k){let f=i();for(let[g,h]of(c++,b.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,'')",[f,a,d,"expense",e,c]),(m.expense||{})[d]||[]))c++,b.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,?)",[i(),a,g,"expense",h,c,f])}for(let[d,e]of l){let f=i();for(let[g,h]of(c++,b.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,'')",[f,a,d,"income",e,c]),(m.income||{})[d]||[]))c++,b.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,?)",[i(),a,g,"income",h,c,f])}let d=Date.now();b.run("INSERT INTO accounts (id, user_id, name, category, initial_balance, currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate, account_type, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",[i(),a,"現金","cash",0,"TWD","fa-wallet",0,null,null,"現金",j(),d]),b.run("INSERT OR IGNORE INTO user_settings (user_id, pinned_currencies, updated_at) VALUES (?, ?, ?)",[a,'["TWD"]',d]),b.run("INSERT OR IGNORE INTO exchange_rate_settings (user_id, auto_update, last_synced_at, updated_at) VALUES (?, 0, 0, ?)",[a,d]),b.run(`INSERT OR IGNORE INTO stock_settings (user_id, fee_rate, fee_discount, fee_min_lot, fee_min_odd, sell_tax_rate_stock, sell_tax_rate_etf, sell_tax_rate_warrant, sell_tax_min, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[a,n.feeRate,n.feeDiscount,n.feeMinLot,n.feeMinOdd,n.sellTaxRateStock,n.sellTaxRateEtf,n.sellTaxRateWarrant,n.sellTaxMin,d])},backfillDefaultsForUser:function(a){let b=e(),c=new Set(g("SELECT default_key FROM deleted_defaults WHERE user_id = ?",[a]).map(a=>a.default_key)),d=f("SELECT COALESCE(MAX(sort_order),0) AS m FROM categories WHERE user_id = ?",[a])?.m||0,h=0;b.run("BEGIN");try{for(let[e,g]of[["expense",k],["income",l]])for(let[j,k]of g){let g=o(e,null,j);if(c.has(g))continue;let l=f("SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? AND (parent_id = '' OR parent_id IS NULL)",[a,e,j]);if(!l){let c=i();d++,b.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,'')",[c,a,j,e,k,d]),l={id:c},h++}for(let[g,k]of(m[e]||{})[j]||[]){let m=o(e,j,g);!c.has(m)&&!f("SELECT id FROM categories WHERE user_id = ? AND parent_id = ? AND name = ?",[a,l.id,g])&&(d++,b.run("INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order, parent_id) VALUES (?,?,?,?,?,1,?,?)",[i(),a,g,e,k,d,l.id]),h++)}}b.run("COMMIT")}catch(a){try{b.run("ROLLBACK")}catch(a){}throw a}return h},DEFAULT_EXPENSE_PARENTS:k,DEFAULT_INCOME_PARENTS:l,DEFAULT_SUBCATEGORIES:m,DEFAULT_STOCK_SETTINGS:n,categoryDefaultKey:o}},66147:(a,b,c)=>{"use strict";c.r(b),c.d(b,{AUTH_COOKIE_OPTIONS:()=>m,getSession:()=>i,requireAuth:()=>j,signToken:()=>k,verifyToken:()=>l});var d=c(86802),e=c(82161),f=c(48318),g=c.n(f);let h=process.env.JWT_SECRET||"default_secret";async function i(){let a=(await (0,d.cookies)()).get("authToken");return a?a.value:null}async function j(){let a=await i();return a||(0,e.redirect)("/login"),a}function k(a,b){return g().sign({userId:a,tokenVersion:b},h,{expiresIn:"7d"})}function l(a){return g().verify(a,h)}let m={httpOnly:!0,secure:!0,sameSite:"strict",path:"/"}},78335:()=>{},96487:()=>{}};
(()=>{var a={};a.id=4618,a.ids=[4618],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},8086:a=>{"use strict";a.exports=require("module")},9256:(a,b,c)=>{"use strict";c.d(b,{OB:()=>i,VX:()=>h,ZT:()=>j,oC:()=>f,si:()=>k,ts:()=>g});var d=c(86802),e=c(66147);async function f(a){return await (0,e.requireAuth)()}function g(a){return{id:a.id,email:a.email,displayName:a.display_name,isAdmin:!!a.is_admin,themeMode:a.theme_mode}}async function h(a,b){return(await (0,d.cookies)()).set("authToken",b,{httpOnly:!0,secure:!0,sameSite:"strict",path:"/",maxAge:604800}),a}async function i(){(await (0,d.cookies)()).delete("authToken")}async function j(){return await f()}function k(a){let b=String(a||"").trim().toLowerCase();return"light"===b||"dark"===b||"system"===b?b:"system"}c(30477)},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},12412:a=>{"use strict";a.exports=require("assert")},16825:(a,b,c)=>{"use strict";let d=c(33873),e=c(29021),f=c(55511),g=process.env.DB_PATH||d.join(process.cwd(),"database.db"),h=process.env.DB_ENCRYPTION_KEY||"",i=Buffer.from("EADB");function j(a,b){return f.pbkdf2Sync(a,b,1e5,32,"sha256")}function k(a,b){let c=f.randomBytes(16),d=j(b,c),e=f.randomBytes(12),g=f.createCipheriv("chacha20-poly1305",d,e,{authTagLength:16}),h=Buffer.concat([g.update(a),g.final()]),k=g.getAuthTag();return Buffer.concat([i,c,e,k,h])}function l(a,b){if(a.length<48)throw Error("加密檔案格式錯誤：檔案太小");if(!a.subarray(0,4).equals(i))throw Error("非加密資料庫檔案");let c=a.subarray(4,20),d=a.subarray(20,32),e=a.subarray(32,48),g=a.subarray(48),h=j(b,c),k=f.createDecipheriv("chacha20-poly1305",h,d,{authTagLength:16});return k.setAuthTag(e),Buffer.concat([k.update(g),k.final()])}function m(a){return!!Buffer.isBuffer(a)&&a.length>=4&&a.subarray(0,4).equals(i)}let n=globalThis.__sqlDb||null,o=!1,p=!1;function q(){if(o){p=!0;return}o=!0,(async()=>{try{for(;;){p=!1;let a=n.export(),b=Buffer.from(a),c=h?k(b,h):b,d=g+".tmp";if(await e.promises.writeFile(d,c),await e.promises.rename(d,g),!p)break}}catch(a){console.error("saveDB failed:",a?.message??a)}finally{o=!1}})()}function r(){let a=n.export(),b=Buffer.from(a),c=h?k(b,h):b;e.writeFileSync(g,c)}function s(){if(n||(n=globalThis.__sqlDb??null),!n)throw Error("DB 尚未初始化，請確認 instrumentation.js 已執行");return n}async function t(){let a=n;a.run(`CREATE TABLE IF NOT EXISTS users (
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
  )`),b("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'"),b("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"),b("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Asia/Taipei'"),b("ALTER TABLE users ADD COLUMN theme_mode TEXT DEFAULT 'system'"),b("ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT ''"),b("ALTER TABLE users ADD COLUMN google_sub TEXT DEFAULT ''"),b("ALTER TABLE users ADD COLUMN has_password INTEGER DEFAULT 1"),b("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''"),b("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0"),b("ALTER TABLE users ADD COLUMN passkey_credentials TEXT DEFAULT '[]'"),b("ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN type TEXT DEFAULT 'checking'"),b("ALTER TABLE accounts ADD COLUMN balance REAL DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN color TEXT DEFAULT '#6366f1'"),b("ALTER TABLE accounts ADD COLUMN sort_order INTEGER DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1"),b("ALTER TABLE accounts ADD COLUMN updated_at INTEGER DEFAULT 0"),b("ALTER TABLE accounts ADD COLUMN note TEXT DEFAULT ''"),b("ALTER TABLE transactions ADD COLUMN transfer_to_account_id TEXT DEFAULT ''"),b("ALTER TABLE transactions ADD COLUMN tags TEXT DEFAULT '[]'"),b("ALTER TABLE stock_transactions ADD COLUMN realized_pl REAL DEFAULT 0");let d=c(33873).join(process.cwd(),"backups");c(29021).existsSync(d)||c(29021).mkdirSync(d,{recursive:!0}),q()}async function u(a){let b=c(33296),e=await b({locateFile:a=>d.join(process.cwd(),"node_modules","sql.js","dist",a)});if(n)try{n.close()}catch(a){}n=new e.Database(a),q(),await t()}a.exports={initDB:async function a(){if(n)return;let a=c(33296),b=await a({locateFile:a=>d.join(process.cwd(),"node_modules","sql.js","dist",a)});if(e.existsSync(g)){let a=e.readFileSync(g),c=m(a);if(c&&!h&&(console.error("錯誤：資料庫已加密但未設定 DB_ENCRYPTION_KEY，無法啟動"),process.exit(1)),c)try{let c=l(a,h);n=new b.Database(c),console.log("已載入加密資料庫（ChaCha20-Poly1305）")}catch(a){console.error("資料庫解密失敗（金鑰可能不正確）:",a.message),process.exit(1)}else h?(n=new b.Database(a),console.log("偵測到未加密資料庫，自動加密中..."),q(),console.log("資料庫已自動加密完成")):n=new b.Database(a)}else n=new b.Database,h&&console.log("將使用加密模式儲存新資料庫");globalThis.__sqlDb=n,await t(),console.log("資料庫初始化完成")},getDB:s,saveDB:q,saveDBSync:r,flushOnExit:()=>{try{r()}catch{}},queryOne:function(a,b=[]){let c=s().prepare(a);if(c.bind(b),c.step()){let a=c.getAsObject();return c.free(),a}return c.free(),null},queryAll:function(a,b=[]){let c=s().prepare(a);c.bind(b);let d=[];for(;c.step();)d.push(c.getAsObject());return c.free(),d},isEncryptedDB:m,encryptBuffer:k,decryptBuffer:l,replaceDB:u}},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},26340:(a,b,c)=>{"use strict";c.d(b,{H:()=>f,t:()=>g});var d=c(30477),e=c(66147);function f(a){let b=new Map;for(let c of a){let a=Number(c.amount)||0;if(a<=0)continue;let d=c.category_id||"",e=c.cat_name||"未分類",f=c.cat_color||"#94a3b8",g=c.cat_parent_id||"",h=!!g,i=h?g:d||`name:${e}`,j=h?c.cat_parent_name||"未分類":e,k=h&&c.cat_parent_color||f;b.has(i)||b.set(i,{parentId:i,parentName:j,parentColor:k,total:0,children:new Map,otherTotal:0});let l=b.get(i);if(l.total+=a,h){let b=d||`name:${e}`;l.children.has(b)||l.children.set(b,{categoryId:d,name:e,color:f,total:0}),l.children.get(b).total+=a}else l.otherTotal+=a}let c=Array.from(b.values()).sort((a,b)=>b.total-a.total),d=[];for(let a of c){for(let b of Array.from(a.children.values()).sort((a,b)=>b.total-a.total))d.push({categoryId:b.categoryId,name:b.name,color:b.color,parentId:a.parentId,parentName:a.parentName,parentColor:a.parentColor,total:b.total,isOtherGroup:!1});a.otherTotal>0&&d.push({categoryId:null,name:"（其他）",color:a.parentColor,parentId:a.parentId,parentName:a.parentName,parentColor:a.parentColor,total:a.otherTotal,isOtherGroup:!0})}return d}async function g(a){let b=await (0,e.requireAuth)(),c=a?`http://localhost:3000/api/dashboard?yearMonth=${a}`:"http://localhost:3000/api/dashboard";d.A.info({url:c},"Fetching dashboard data");let f=await fetch(c,{headers:{Cookie:`authToken=${b}`}});if(!f.ok)throw d.A.error({status:f.status},"Failed to fetch dashboard data"),Error("Failed to fetch dashboard data");return f.json()}},27910:a=>{"use strict";a.exports=require("stream")},28354:a=>{"use strict";a.exports=require("util")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},30477:(a,b,c)=>{"use strict";c.d(b,{A:()=>e});var d=c(88015);let e=c.n(d)()({level:process.env.LOG_LEVEL||"info",transport:void 0})},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},48161:a=>{"use strict";a.exports=require("node:os")},53053:a=>{"use strict";a.exports=require("node:diagnostics_channel")},55511:a=>{"use strict";a.exports=require("crypto")},56009:a=>{"use strict";let b=/^\d{4}-\d{2}-\d{2}$/,c=null;function d(){if(null!=c)return c;let a=process.env.FAKE_NOW;if(a){let b=Date.parse(a);if(!isNaN(b))return b}return Date.now()}function e(a,b){let c=new Intl.DateTimeFormat("en-CA",{timeZone:a,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1,weekday:"short"}).formatToParts(new Date(b)),d={};for(let a of c)d[a.type]=a.value;return d}let f={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};function g(a){let b=e(a||"Asia/Taipei",d());return`${b.year}-${b.month}-${b.day}`}function h(a){if("string"!=typeof a||!b.test(a))return!1;let[c,d,e]=a.split("-").map(a=>parseInt(a,10));if(d<1||d>12||e<1||e>31)return!1;let f=new Date(Date.UTC(c,d-1,e));return f.getUTCFullYear()===c&&f.getUTCMonth()===d-1&&f.getUTCDate()===e}a.exports={isValidIanaTimezone:function(a){if("string"!=typeof a||0===a.length||/^UTC[+\-]\d/.test(a)||/^GMT[+\-]\d/.test(a))return!1;if(["UTC","GMT","Etc/UTC","Etc/GMT","Z"].includes(a))try{return new Intl.DateTimeFormat("en-CA",{timeZone:a}).format(new Date),!0}catch(a){return!1}if(/^[A-Z]{2,5}$/.test(a)&&!a.includes("/"))return!1;try{return new Intl.DateTimeFormat("en-CA",{timeZone:a}).format(new Date),!0}catch(a){return!1}},todayInUserTz:g,monthInUserTz:function(a,b){let c=e(a||"Asia/Taipei",null==b?d():"number"==typeof b?b:b instanceof Date?b.getTime():d());return`${c.year}-${c.month}`},isFutureDateForTz:function(a,b){return!!h(b)&&String(b)>g(a)},partsInTz:function(a,b){let c=e(a||"Asia/Taipei",null==b?d():"number"==typeof b?b:b instanceof Date?b.getTime():d());return{year:parseInt(c.year,10),month:parseInt(c.month,10),day:parseInt(c.day,10),hour:parseInt(c.hour,10)%24,minute:parseInt(c.minute,10),weekday:null!=f[c.weekday]?f[c.weekday]:0}},toIsoUtc:function(a){let b;if(null==a||""===a)throw TypeError(`toIsoUtc: 不接受空值（got ${a}）`);if("number"==typeof a)b=new Date(a);else if(a instanceof Date)b=a;else if("string"==typeof a){if(/[+\-]\d{2}:?\d{2}$/.test(a))throw TypeError(`toIsoUtc: 不接受帶時區偏移的輸入（${a}），必須為 UTC Z`);let c=a;/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(c)?c=c.replace(" ","T")+"Z":/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(c)&&(c+="Z"),b=new Date(c)}else throw TypeError(`toIsoUtc: 不支援的型別 ${typeof a}`);if(isNaN(b.getTime()))throw TypeError(`toIsoUtc: 無法解析的時間值 ${JSON.stringify(a)}`);return b.toISOString()},isValidIsoDate:h,__nowMs:d,__setNowMs:function(a){c=null==a?null:Number(a)}}},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},66147:(a,b,c)=>{"use strict";c.r(b),c.d(b,{AUTH_COOKIE_OPTIONS:()=>m,getSession:()=>i,requireAuth:()=>j,signToken:()=>k,verifyToken:()=>l});var d=c(86802),e=c(82161),f=c(48318),g=c.n(f);let h=process.env.JWT_SECRET||"default_secret";async function i(){let a=(await (0,d.cookies)()).get("authToken");return a?a.value:null}async function j(){let a=await i();return a||(0,e.redirect)("/login"),a}function k(a,b){return g().sign({userId:a,tokenVersion:b},h,{expiresIn:"7d"})}function l(a){return g().verify(a,h)}let m={httpOnly:!0,secure:!0,sameSite:"strict",path:"/"}},73024:a=>{"use strict";a.exports=require("node:fs")},73136:a=>{"use strict";a.exports=require("node:url")},73566:a=>{"use strict";a.exports=require("worker_threads")},75535:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>F,patchFetch:()=>E,routeModule:()=>A,serverHooks:()=>D,workAsyncStorage:()=>B,workUnitAsyncStorage:()=>C});var d={};c.r(d),c.d(d,{GET:()=>z});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(9256),w=c(16825),x=c(56009),y=c(26340);async function z(a){let b=await (0,v.oC)(a);if(b instanceof u.NextResponse)return b;let{searchParams:c}=new URL(a.url),d=String(c.get("yearMonth")||""),e=/^\d{4}-(0[1-9]|1[0-2])$/.test(d)?d:(0,x.monthInUserTz)(b.userTimezone),f=(0,x.todayInUserTz)(b.userTimezone),g=(0,w.queryOne)("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='income' AND date LIKE ? AND exclude_from_stats = 0",[b.userId,e+"%"])?.total||0,h=(0,w.queryOne)("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0",[b.userId,e+"%"])?.total||0,i=(0,w.queryOne)("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date = ? AND exclude_from_stats = 0",[b.userId,f])?.total||0,j=(0,w.queryAll)(`
    SELECT t.category_id, t.amount,
           c.name as cat_name, c.color as cat_color,
           c.parent_id as cat_parent_id,
           p.name as cat_parent_name, p.color as cat_parent_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date LIKE ? AND t.exclude_from_stats = 0
  `,[b.userId,e+"%"]),k=(0,y.H)(j),l=(0,w.queryAll)(`
    SELECT t.category_id, t.amount,
           c.name as cat_name, c.color as cat_color,
           c.parent_id as cat_parent_id,
           p.name as cat_parent_name, p.color as cat_parent_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = 'income' AND t.date LIKE ? AND t.exclude_from_stats = 0
  `,[b.userId,e+"%"]),m=(0,y.H)(l),n=(0,w.queryAll)(`
    SELECT t.*, c.name as cat_name, c.color as cat_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type IN ('income','expense') AND t.exclude_from_stats = 0 AND t.date LIKE ?
    ORDER BY t.date DESC, t.created_at DESC LIMIT 5
  `,[b.userId,e+"%"]);return u.NextResponse.json({yearMonth:e,income:g,expense:h,net:g-h,todayExpense:i,catBreakdown:k,incomeCatBreakdown:m,recent:n})}let A=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/dashboard/route",pathname:"/api/dashboard",filename:"route",bundlePath:"app/api/dashboard/route"},distDir:"build",relativeProjectDir:"",resolvedPagePath:"C:\\Users\\hongyu\\SynologyDrive\\web\\AssetPilot\\app\\api\\dashboard\\route.js",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:B,workUnitAsyncStorage:C,serverHooks:D}=A;function E(){return(0,g.patchFetch)({workAsyncStorage:B,workUnitAsyncStorage:C})}async function F(a,b,c){var d;let e="/api/dashboard/route";"/index"===e&&(e="/");let g=await A.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||A.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===A.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>A.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>A.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await A.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},z),b}},l=await A.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await A.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},76760:a=>{"use strict";a.exports=require("node:path")},77598:a=>{"use strict";a.exports=require("node:crypto")},78335:()=>{},78474:a=>{"use strict";a.exports=require("node:events")},79428:a=>{"use strict";a.exports=require("buffer")},79551:a=>{"use strict";a.exports=require("url")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},94735:a=>{"use strict";a.exports=require("events")},96487:()=>{}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[1331,1667,8875,1692,3296,8015],()=>b(b.s=75535));module.exports=c})();
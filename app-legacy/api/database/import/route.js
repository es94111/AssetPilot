import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB, isEncryptedDB, saveDB, replaceDB } from '../../../../lib/db';
import { writeOperationAudit } from '../../../../lib/auditHelpers';

const BACKUPS_DIR = path.join(process.cwd(), 'backups');

function makeBackupTimestamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

function ensureBackupsDir() {
  try { fs.mkdirSync(BACKUPS_DIR, { recursive: true }); } catch (_) {}
}

function pruneBeforeRestoreBackups() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return;
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('before-restore-') && f.endsWith('.db'))
      .map(f => {
        const fp = path.join(BACKUPS_DIR, f);
        try { return { name: f, path: fp, mtime: fs.statSync(fp).mtimeMs }; } catch (_) { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime);
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    files.forEach((f, i) => {
      if (i >= 5 || (Date.now() - f.mtime) > NINETY_DAYS) {
        try { fs.unlinkSync(f.path); } catch (_) {}
      }
    });
  } catch (_) {}
}

export async function POST(request) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const ua = request.headers.get('user-agent') || '';

  let beforeRestorePath = '';
  try {
    const arrayBuffer = await request.arrayBuffer();
    const dbBuffer = Buffer.from(arrayBuffer);

    if (dbBuffer.length < 16) {
      return NextResponse.json({ error: '無效的資料庫檔案' }, { status: 400 });
    }
    if (isEncryptedDB(dbBuffer)) {
      return NextResponse.json({ error: '請上傳未加密的資料庫檔案（.db）' }, { status: 400 });
    }
    const sqliteMagic = dbBuffer.subarray(0, 16).toString('ascii');
    if (!sqliteMagic.startsWith('SQLite format 3')) {
      return NextResponse.json({ error: '檔案不是有效的 SQLite 資料庫' }, { status: 400 });
    }

    // 驗證必要資料表（不直接用主DB）
    const SqlJsDatabase = getDB().constructor;
    const testDb = new SqlJsDatabase(new Uint8Array(dbBuffer));
    const tables = testDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.length > 0 ? tables[0].values.map(r => r[0]) : [];
    const requiredTables = ['users', 'transactions', 'accounts', 'categories', 'stocks'];
    const missing = requiredTables.filter(t => !tableNames.includes(t));
    if (missing.length > 0) {
      testDb.close();
      return NextResponse.json({ error: `資料庫缺少必要資料表：${missing.join(', ')}` }, { status: 400 });
    }
    testDb.close();

    ensureBackupsDir();
    const backupTs = makeBackupTimestamp();
    beforeRestorePath = path.join(BACKUPS_DIR, `before-restore-${backupTs}.db`);
    try {
      const currentData = getDB().export();
      fs.writeFileSync(beforeRestorePath, Buffer.from(currentData));
    } catch (e) {
      return NextResponse.json({ error: '建立還原前備份失敗，請檢查 backups/ 目錄權限', message: String(e?.message || e) }, { status: 500 });
    }

    try {
      await replaceDB(new Uint8Array(dbBuffer));
    } catch (replaceErr) {
      console.error('替換主資料庫失敗，嘗試回滾:', replaceErr);
      try {
        const beforeBuf = fs.readFileSync(beforeRestorePath);
        await replaceDB(new Uint8Array(beforeBuf));
        writeOperationAudit({ userId: auth.userId, role: 'admin', action: 'restore_failed', ipAddress: ip, userAgent: ua, result: 'rolled_back', isAdminOperation: true, metadata: { failure_stage: 'replace_main_db', failure_reason: String(replaceErr?.message || replaceErr).slice(0, 200), before_restore_path: path.relative(process.cwd(), beforeRestorePath) } });
        return NextResponse.json({ error: 'RESTORE_FAILED_ROLLED_BACK', message: '還原失敗，已自動回復至還原前狀態', beforeRestorePath: path.relative(process.cwd(), beforeRestorePath) }, { status: 422 });
      } catch (rollbackErr) {
        const availableBackups = (() => { try { return fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.db')).map(f => path.relative(process.cwd(), path.join(BACKUPS_DIR, f))); } catch (_) { return []; } })();
        writeOperationAudit({ userId: auth.userId, role: 'admin', action: 'restore_failed', ipAddress: ip, userAgent: ua, result: 'failed', isAdminOperation: true, metadata: { failure_stage: 'rollback', failure_reason: String(rollbackErr?.message || rollbackErr).slice(0, 200) } });
        return NextResponse.json({ error: 'RESTORE_FAILED_DB_UNKNOWN', message: '主資料庫狀態未知，請聯繫管理員', availableBackups }, { status: 500 });
      }
    }

    pruneBeforeRestoreBackups();

    writeOperationAudit({ userId: auth.userId, role: 'admin', action: 'restore_backup', ipAddress: ip, userAgent: ua, result: 'success', isAdminOperation: true, metadata: { byteSize: dbBuffer.length, before_restore_path: path.relative(process.cwd(), beforeRestorePath) } });
    return NextResponse.json({ ok: true, message: '資料庫還原成功，請重新登入', beforeRestorePath: path.relative(process.cwd(), beforeRestorePath) });
  } catch (e) {
    console.error('資料庫匯入失敗:', e);
    writeOperationAudit({ userId: auth.userId, role: 'admin', action: 'restore_failed', ipAddress: ip, userAgent: ua, result: 'failed', isAdminOperation: true, metadata: { failure_stage: 'pre_validation', failure_reason: String(e?.message || e).slice(0, 200) } });
    return NextResponse.json({ error: '資料庫匯入失敗：' + (e.message || '未知錯誤') }, { status: 500 });
  }
}

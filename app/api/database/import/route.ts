// @ts-nocheck
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { writeOperationAudit } from '../../../../lib/auditHelpers';
import { createPostgresBackupSql, restorePostgresBackupSql } from '../../../../lib/postgresBackup';

const BACKUPS_DIR = path.join(process.cwd(), 'backups');
const BEFORE_RESTORE_BACKUP_RE = /^before-restore-\d{14}\.sql$/;

function makeBackupTimestamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

function ensureBackupsDir() {
  try { fs.mkdirSync(BACKUPS_DIR, { recursive: true }); } catch (_) {}
}

function getBeforeRestoreBackupPath(name) {
  const basename = path.basename(String(name || ''));
  if (!BEFORE_RESTORE_BACKUP_RE.test(basename)) return null;
  return `${BACKUPS_DIR}${path.sep}${basename}`;
}

function pruneBeforeRestoreBackups() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return;
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => BEFORE_RESTORE_BACKUP_RE.test(f))
      .map(f => {
        const fp = getBeforeRestoreBackupPath(f);
        if (!fp) return null;
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
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const ua = request.headers.get('user-agent') || '';

  let beforeRestorePath = '';
  try {
    const arrayBuffer = await request.arrayBuffer();
    const dbBuffer = Buffer.from(arrayBuffer);

    const sql = dbBuffer.toString('utf8').replace(/^\uFEFF/, '');
    if (!sql.trimStart().startsWith('-- AssetPilot PostgreSQL backup')) {
      return NextResponse.json({ error: '請上傳 AssetPilot PostgreSQL SQL 備份檔（.sql）' }, { status: 400 });
    }

    ensureBackupsDir();
    const backupTs = makeBackupTimestamp();
    beforeRestorePath = getBeforeRestoreBackupPath(`before-restore-${backupTs}.sql`) || '';
    if (!beforeRestorePath) {
      return NextResponse.json({ error: '建立還原前備份檔名失敗' }, { status: 500 });
    }
    try {
      fs.writeFileSync(beforeRestorePath, createPostgresBackupSql(), 'utf8');
    } catch (e) {
      return NextResponse.json({ error: '建立還原前 PostgreSQL 備份失敗，請檢查 backups/ 目錄權限', message: String(e?.message || e) }, { status: 500 });
    }

    try {
      restorePostgresBackupSql(sql);
    } catch (restoreErr) {
      console.error('PostgreSQL 還原失敗，嘗試回滾:', restoreErr);
      try {
        restorePostgresBackupSql(fs.readFileSync(beforeRestorePath, 'utf8'));
        writeOperationAudit({ userId: auth.userId, role: 'admin', action: 'restore_failed', ipAddress: ip, userAgent: ua, result: 'rolled_back', isAdminOperation: true, metadata: { runtime: 'postgres', failure_stage: 'restore_postgres_sql', failure_reason: String(restoreErr?.message || restoreErr).slice(0, 200), before_restore_path: path.relative(process.cwd(), beforeRestorePath) } });
        return NextResponse.json({ error: 'RESTORE_FAILED_ROLLED_BACK', message: 'PostgreSQL 還原失敗，已自動回復至還原前狀態', beforeRestorePath: path.relative(process.cwd(), beforeRestorePath) }, { status: 422 });
      } catch (rollbackErr) {
        writeOperationAudit({ userId: auth.userId, role: 'admin', action: 'restore_failed', ipAddress: ip, userAgent: ua, result: 'failed', isAdminOperation: true, metadata: { runtime: 'postgres', failure_stage: 'rollback_postgres_sql', failure_reason: String(rollbackErr?.message || rollbackErr).slice(0, 200) } });
        return NextResponse.json({ error: 'RESTORE_FAILED_DB_UNKNOWN', message: 'PostgreSQL 主資料庫狀態未知，請聯繫管理員', beforeRestorePath: path.relative(process.cwd(), beforeRestorePath) }, { status: 500 });
      }
    }

    pruneBeforeRestoreBackups();
    writeOperationAudit({ userId: auth.userId, role: 'admin', action: 'restore_backup', ipAddress: ip, userAgent: ua, result: 'success', isAdminOperation: true, metadata: { runtime: 'postgres', byteSize: dbBuffer.length, before_restore_path: path.relative(process.cwd(), beforeRestorePath) } });
    return NextResponse.json({ ok: true, message: 'PostgreSQL 資料庫還原成功，請重新登入', beforeRestorePath: path.relative(process.cwd(), beforeRestorePath) });
  } catch (e) {
    console.error('資料庫匯入失敗:', e);
    writeOperationAudit({ userId: auth.userId, role: 'admin', action: 'restore_failed', ipAddress: ip, userAgent: ua, result: 'failed', isAdminOperation: true, metadata: { failure_stage: 'pre_validation', failure_reason: String(e?.message || e).slice(0, 200) } });
    return NextResponse.json({ error: '資料庫匯入失敗：' + (e.message || '未知錯誤') }, { status: 500 });
  }
}

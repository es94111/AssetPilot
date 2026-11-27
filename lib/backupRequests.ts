import { NextResponse } from 'next/server';
import { BACKUP_ARCHIVE_OVERHEAD } from './backupArchive';
import { isValidBackupPassphrase } from './backupPassphrase';
import { MAX_RESTORE_SQL_BYTES } from './postgresBackup';

export const BACKUP_NO_STORE = { 'Cache-Control': 'no-store' };

const ERROR_MESSAGES = {
  invalid_request: '備份請求格式不正確，請確認檔案與密語。',
  invalid_passphrase: '請輸入至少 16 個字元且不超過 1 KiB 的單行備份密語。',
  invalid_file: '請選擇 AssetPilot 的 .apb 或舊版 .sql 備份檔。',
  unsupported_version: '這個加密備份版本目前無法還原。',
  decryption_failed: '無法解密備份。請確認密語和檔案是否完整。',
  invalid_sql: 'SQL 備份不完整或格式不正確。',
  restore_in_progress: '已有另一個資料庫還原正在執行，請稍後再試。',
  incomplete_upload: '上傳的備份未完整送達。請確認檔案及部署的上傳大小限制。',
  too_large: '備份超過 200 MiB 的 SQL 大小上限。',
  database_too_large: '目前資料庫超過備份的 SQL 大小或陳述式數量上限。',
  database_result_too_large: '目前資料庫回傳的資料超過讀取緩衝區，請檢查 POSTGRES_SYNC_RESULT_BUFFER_BYTES。',
  too_many_statements: '備份超過 50 萬條 SQL 陳述式的上限。',
};
const ERROR_STATUS: Partial<Record<keyof typeof ERROR_MESSAGES, number>> = {
  restore_in_progress: 409,
  too_large: 413,
  database_too_large: 422,
  database_result_too_large: 422,
  too_many_statements: 422,
};

export class BackupInputError extends Error {
  constructor(readonly code: keyof typeof ERROR_MESSAGES) {
    super(ERROR_MESSAGES[code]);
  }

  toResponse() {
    return NextResponse.json(
      { error: this.message, code: this.code },
      { status: ERROR_STATUS[this.code] ?? 400, headers: BACKUP_NO_STORE },
    );
  }
}

export function noStoreBackupResponse<T extends Response>(response: T): T {
  response.headers.set('Cache-Control', BACKUP_NO_STORE['Cache-Control']);
  return response;
}

function boundedBody(request: Request, limit: number): Response {
  const contentLength = request.headers.get('content-length');
  const expected = contentLength === null ? null : Number(contentLength);
  if (!request.body || (expected !== null && (!Number.isSafeInteger(expected) || expected < 0))) {
    throw new BackupInputError('invalid_request');
  }
  if (expected !== null && expected > limit) throw new BackupInputError('too_large');
  let received = 0;
  const stream = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > limit) throw new BackupInputError('too_large');
      controller.enqueue(chunk);
    },
    flush() {
      if (expected !== null && received !== expected) {
        throw new BackupInputError('incomplete_upload');
      }
    },
  }));
  return new Response(stream, { headers: { 'Content-Type': request.headers.get('content-type') || '' } });
}

function requireBackupPassphrase(passphrase: unknown): string {
  if (!isValidBackupPassphrase(passphrase)) throw new BackupInputError('invalid_passphrase');
  return passphrase;
}

export async function readBackupPassphrase(request: Request): Promise<string> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') throw new BackupInputError('invalid_request');

  let json: unknown;
  try {
    // 1 KiB of UTF-8 text can grow to 6 KiB if every byte is JSON-escaped.
    json = await boundedBody(request, 8 * 1024).json();
  } catch (error) {
    if (error instanceof BackupInputError && error.code !== 'too_large') throw error;
    throw new BackupInputError(error instanceof BackupInputError ? 'invalid_passphrase' : 'invalid_request');
  }
  const passphrase = json && typeof json === 'object' && 'passphrase' in json ? json.passphrase : undefined;
  return requireBackupPassphrase(passphrase);
}

export async function readBackupRestore(request: Request): Promise<{ file: Buffer; passphrase: string }> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'multipart/form-data') throw new BackupInputError('invalid_request');

  const fileLimit = MAX_RESTORE_SQL_BYTES + BACKUP_ARCHIVE_OVERHEAD;
  let form: FormData;
  try {
    form = await boundedBody(request, fileLimit + 64 * 1024).formData();
  } catch (error) {
    if (error instanceof BackupInputError) throw error;
    throw new BackupInputError('incomplete_upload');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) throw new BackupInputError('invalid_file');
  if (file.size > fileLimit) throw new BackupInputError('too_large');
  const passphrase = requireBackupPassphrase(form.get('passphrase'));
  return { file: Buffer.from(await file.arrayBuffer()), passphrase };
}

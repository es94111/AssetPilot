// POST /api/transactions/receipt-ocr — 收據影像辨識，回傳「草稿預填」欄位（issue #250）
//
// 設計：
//   - 讀取既有附件時，一律先以 (id, transaction_id, user_id) 查列，再走
//     readTransactionAttachment()（含 photoCrypto 解密與 S3 權限），
//     不新增任何繞過加密或儲存層權限的路徑。
//   - 直接上傳影像（新增交易尚未建立交易 id 時）僅在記憶體中處理，不落地儲存。
//   - 回應一律為草稿，不寫入 DB；使用者確認後才由 POST /api/transactions 儲存。
//   - 未設定供應商 / 供應商失敗時回 200 並帶 status，讓前端優雅降級為手動輸入。
//
// 授權：沿用 requireAuth()；寫入權限由後續交易建立流程把關，本端點只讀取附件。

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryOne } from '../../../../lib/db';
import { writeOperationAudit } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';
import {
  getReceiptOcrConfig,
  isAllowedOcrMimeType,
  readAttachmentImageForOcr,
  runReceiptOcr,
} from '../../../../lib/receiptOcr';
import type { TransactionAttachmentRow } from '../../../../lib/transactionAttachments';
import { RECEIPT_OCR_AUTH_OPTIONS, decodeReceiptOcrUpload, readJsonBodyWithLimit, RequestBodyTooLargeError } from '../../../../lib/receiptOcrRequest';

export const runtime = 'nodejs';

const REQUEST_BODY_OVERHEAD_BYTES = 32 * 1024;

function requestMeta(request: NextRequest) {
  return {
    ipAddress: getRequestIpFromHeaders(request.headers),
    userAgent: request.headers.get('user-agent') || '',
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, RECEIPT_OCR_AUTH_OPTIONS);
  if (auth instanceof NextResponse) return auth;

  const config = getReceiptOcrConfig();
  const maxBase64Length = Math.ceil(config.maxBytes * 4 / 3) + 1024;
  const maxRequestBytes = maxBase64Length + REQUEST_BODY_OVERHEAD_BYTES;
  let parsedBody: unknown;
  try {
    parsedBody = await readJsonBodyWithLimit(
      request.body,
      request.headers.get('content-length'),
      maxRequestBytes,
    );
  } catch (e) {
    if (e instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: '請求內容超過大小上限' }, { status: 413 });
    }
    return NextResponse.json({ error: '請求內容格式無效' }, { status: 400 });
  }
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: '請求內容格式無效' }, { status: 400 });
  }
  const body = parsedBody as {
    imageBase64?: unknown;
    mimeType?: unknown;
    transactionId?: unknown;
    attachmentId?: unknown;
  };
  const transactionId = String(body.transactionId || '').trim();
  const attachmentId = String(body.attachmentId || '').trim();

  let image: Buffer;
  let effectiveMimeType = '';

  if (transactionId || attachmentId) {
    if (!transactionId || !attachmentId) {
      return NextResponse.json({ error: '需同時提供交易與附件識別碼' }, { status: 400 });
    }
    // 以 user_id 過濾，確保只能讀取自己的附件（跨使用者一律 404，不洩漏存在性）。
    const row = queryOne(
      'SELECT * FROM transaction_attachments WHERE id = ? AND transaction_id = ? AND user_id = ?',
      [attachmentId, transactionId, auth.userId],
    ) as unknown as TransactionAttachmentRow | null;
    if (!row) return NextResponse.json({ error: 'NotFound' }, { status: 404 });
    try {
      image = await readAttachmentImageForOcr(row, config.maxBytes);
    } catch (e) {
      return NextResponse.json({
        status: 'failed',
        provider: config.provider || 'none',
        draft: null,
        warnings: ['image_unreadable'],
        message: String((e as Error)?.message || '附件讀取失敗'),
      });
    }
    effectiveMimeType = String(row.mime_type || '').toLowerCase();
  } else {
    const decoded = decodeReceiptOcrUpload(body.imageBase64, body.mimeType, maxBase64Length, config.maxBytes);
    if (!decoded.ok) return NextResponse.json({ error: decoded.error }, { status: decoded.status });
    image = decoded.image;
    effectiveMimeType = decoded.mimeType;
  }

  if (!isAllowedOcrMimeType(effectiveMimeType)) {
    return NextResponse.json({
      status: 'failed',
      provider: config.provider || 'none',
      draft: null,
      warnings: ['unsupported_mime_type'],
      message: '不支援的影像格式',
    });
  }

  const outcome = await runReceiptOcr({ image, mimeType: effectiveMimeType, timezone: auth.userTimezone });

  // 稽核：僅記錄供應商、狀態與欄位是否辨識成功，不記錄影像內容或金額。
  writeOperationAudit({
    userId: auth.userId,
    role: auth.isAdmin ? 'admin' : 'user',
    action: 'receipt_ocr',
    result: outcome.status === 'ok' ? 'success' : 'failed',
    isAdminOperation: false,
    ...requestMeta(request),
    metadata: {
      ledger_id: (auth as { ledgerId?: string }).ledgerId || '',
      provider: outcome.provider,
      status: outcome.status,
      source: transactionId ? 'attachment' : 'upload',
      fields: {
        amount: outcome.draft.amount !== null,
        date: outcome.draft.date !== null,
        merchant: outcome.draft.merchant !== null,
      },
      warnings: outcome.warnings,
    },
  });

  return NextResponse.json({
    status: outcome.status,
    provider: outcome.provider,
    draft: outcome.draft,
    warnings: outcome.warnings,
    message: outcome.message,
  });
}

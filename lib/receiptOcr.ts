// lib/receiptOcr.ts — 收據 OCR 的伺服器端整合層（issue #250）。
//
// 分工：
//   lib/receiptOcrCore.ts — 純解析／供應商介面（無 DB、可單測）
//   本檔                 — 環境變數設定、附件讀取（沿用 photoCrypto 解密路徑）與稽核
//
// 重要邊界：
//   - 只讀取「已屬於該使用者」的附件列，並經 readTransactionAttachment() 解密，
//     不新增任何繞過 photoCrypto / S3 權限的存取路徑。
//   - OCR 結果一律回傳草稿，不寫入 DB；寫入仍由一般新增交易流程負責。
//   - 任何 OCR 失敗都回報結構化結果（不再拋錯），前端據此降級為手動輸入。

import { readTransactionAttachment, type TransactionAttachmentRow } from './transactionAttachments';
import {
  RECEIPT_OCR_MAX_IMAGE_BYTES,
  type ReceiptOcrDraft,
  type ReceiptOcrProvider,
  parseReceiptOcrResult,
  resolveReceiptOcrProvider,
} from './receiptOcrCore';

export interface ReceiptOcrConfig {
  provider: string;
  endpoint: string;
  hasApiKey: boolean;
  timeoutMs: number;
  maxBytes: number;
}

export interface ReceiptOcrOutcome {
  status: 'ok' | 'unavailable' | 'failed';
  provider: string;
  draft: ReceiptOcrDraft;
  warnings: string[];
  /** 使用者可讀的降級訊息（status !== 'ok' 時提供，前端直接顯示）。 */
  message?: string;
}

const DEFAULT_MAX_BYTES = RECEIPT_OCR_MAX_IMAGE_BYTES;
const MAX_CONFIGURED_OCR_BYTES = 20 * 1024 * 1024;

/** 讀取環境變數設定；API 金鑰本身不回傳，只回報是否已設定（避免憑證外洩到回應）。 */
export function getReceiptOcrConfig(): ReceiptOcrConfig {
  const maxBytes = Number(process.env.RECEIPT_OCR_MAX_BYTES);
  const timeoutMs = Number(process.env.RECEIPT_OCR_TIMEOUT_MS);
  return {
    provider: String(process.env.RECEIPT_OCR_PROVIDER || '').trim().toLowerCase(),
    endpoint: String(process.env.RECEIPT_OCR_ENDPOINT || '').trim(),
    hasApiKey: !!String(process.env.RECEIPT_OCR_API_KEY || '').trim(),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000,
    maxBytes: Number.isFinite(maxBytes) && maxBytes >= 1
      ? Math.floor(Math.min(maxBytes, MAX_CONFIGURED_OCR_BYTES))
      : DEFAULT_MAX_BYTES,
  };
}

/** 解析目前生效的供應商；未設定或設定不完整時回傳 none（降級路徑）。 */
export function getReceiptOcrProvider(): ReceiptOcrProvider {
  const config = getReceiptOcrConfig();
  return resolveReceiptOcrProvider({
    provider: config.provider,
    endpoint: config.endpoint,
    apiKey: process.env.RECEIPT_OCR_API_KEY || null,
    timeoutMs: config.timeoutMs,
    maxBytes: config.maxBytes,
  });
}

/** 前端用：是否已啟用 OCR（未啟用時 UI 不顯示按鈕，維持手動輸入）。 */
export function isReceiptOcrEnabled(): boolean {
  return getReceiptOcrProvider().isConfigured();
}

export interface ReceiptOcrRequestBody {
  imageBase64?: string;
  mimeType?: string;
  /** 既有附件（編輯交易時）：直接讀取已加密存放的檔案，不重新上傳。 */
  transactionId?: string;
  attachmentId?: string;
  timezone: string;
  defaultCurrency?: string | null;
}/**
 * 執行一次 OCR：取得影像 → 呼叫供應商 → 解析草稿。
 * 永不拋錯；任何失敗都回傳 status='failed' 或 'unavailable' 讓前端降級。
 */
export async function runReceiptOcr(input: {
  image: Buffer;
  mimeType: string;
  timezone: string;
  defaultCurrency?: string | null;
  provider?: ReceiptOcrProvider;
}): Promise<ReceiptOcrOutcome> {
  const provider = input.provider || getReceiptOcrProvider();
  const base: Omit<ReceiptOcrOutcome, 'status' | 'warnings'> = {
    provider: provider.name,
    draft: { amount: null, currency: null, date: null, merchant: null },
  };

  if (provider.name === 'none' || !provider.isConfigured()) {
    return {
      ...base,
      status: 'unavailable',
      warnings: ['provider_not_configured'],
      message: '未設定 OCR 供應商',
    };
  }

  const config = getReceiptOcrConfig();
  if (input.image.length === 0) {
    return { ...base, status: 'failed', warnings: ['image_empty'], message: '影像內容為空' };
  }
  if (input.image.length > config.maxBytes) {
    return { ...base, status: 'failed', warnings: ['image_too_large'], message: '影像超過 OCR 上限' };
  }

  try {
    const raw = await provider.recognize({ image: input.image, mimeType: input.mimeType });
    const parsed = parseReceiptOcrResult(raw, {
      timezone: input.timezone,
      defaultCurrency: input.defaultCurrency ?? null,
    });
    return {
      status: 'ok',
      provider: provider.name,
      draft: parsed.draft,
      warnings: parsed.warnings,
    };
  } catch (e) {
    return {
      ...base,
      status: 'failed',
      warnings: ['provider_error'],
      message: `OCR 辨識失敗：${String((e as Error)?.message || e).slice(0, 120)}`,
    };
  }
}

/**
 * 讀取「該使用者既有交易附件」的已解密影像（沿用 photoCrypto / S3 存取路徑）。
 * row 必須已由呼叫端以 user_id + transaction_id 過濾，避免跨使用者讀取。
 */
export async function readAttachmentImageForOcr(
  row: TransactionAttachmentRow,
  maxBytes: number,
): Promise<Buffer> {
  const byteSize = Number(row.byte_size) || 0;
  if (byteSize > maxBytes) throw new Error('影像超過 OCR 上限');
  const file = await readTransactionAttachment(row);
  if (file.body.length > maxBytes) throw new Error('影像超過 OCR 上限');
  return file.body;
}

/** 允許的圖片 MIME 型別（與附件上傳的白名單一致；SVG 一律排除）。 */
export const RECEIPT_OCR_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'text/plain',
]);

export function isAllowedOcrMimeType(mimeType: string): boolean {
  return RECEIPT_OCR_ALLOWED_MIME_TYPES.has(String(mimeType || '').toLowerCase());
}

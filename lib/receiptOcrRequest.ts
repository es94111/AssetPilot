import { normalizeReceiptOcrMimeType } from './receiptOcrCore';

/** OCR is read-only and must not trigger implicit recurring writes or maintenance during auth. */
export const RECEIPT_OCR_AUTH_OPTIONS = { skipAutomaticProcessing: true } as const;

export type ReceiptOcrUploadDecodeResult =
  | { ok: true; image: Buffer; mimeType: string }
  | { ok: false; status: 400 | 413; error: string };

/** Validate the direct-upload API contract before handing bytes to an OCR provider. */
export function decodeReceiptOcrUpload(
  rawBase64: unknown,
  rawMimeType: unknown,
  maxBase64Length: number,
  maxBytes: number,
): ReceiptOcrUploadDecodeResult {
  const mimeType = normalizeReceiptOcrMimeType(rawMimeType);
  if (!mimeType) return { ok: false, status: 400, error: '直接上傳影像時必須提供 mimeType' };
  if (typeof rawBase64 !== 'string' || !rawBase64) {
    return { ok: false, status: 400, error: '請提供收據影像' };
  }
  if (rawBase64.length > maxBase64Length) {
    return { ok: false, status: 413, error: '影像超過 OCR 上限' };
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(rawBase64)) {
    return { ok: false, status: 400, error: '影像內容格式無效' };
  }
  const image = Buffer.from(rawBase64, 'base64');
  if (image.length === 0) return { ok: false, status: 400, error: '影像內容為空' };
  if (image.length > maxBytes) return { ok: false, status: 413, error: '影像超過 OCR 上限' };
  return { ok: true, image, mimeType };
}

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body exceeds the configured limit');
    this.name = 'RequestBodyTooLargeError';
  }
}

/**
 * Read and parse a JSON request body while enforcing a byte limit before JSON.parse.
 * Content-Length is an early rejection hint; the stream byte count is authoritative
 * so chunked requests and forged/missing headers remain bounded too.
 */
export async function readJsonBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  contentLength: string | null,
  maxBytes: number,
): Promise<unknown> {
  const declaredLength = contentLength?.trim() ? Number(contentLength) : NaN;
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }
  if (!body) throw new SyntaxError('Missing request body');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError('maxBytes must be a positive safe integer');
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

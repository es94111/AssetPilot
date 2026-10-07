// app/api/imports/invoice-carriers/route.ts — 手機條碼載具綁定／列表（issue #253）
//
// GET  → 列出目前登入者已綁定的載具（條碼以遮罩顯示，絕不回傳驗證碼）
// POST → 綁定載具；驗證碼以 AES-256-GCM 加密後存放（見 lib/einvoiceSecret.ts）
//
// 帳本邊界：本路徑刻意「不是」帳本資料路徑（見 lib/ledgerPolicy.ts 的清單——
// 僅 `/api/imports/progress` 屬帳本資料）。依 asset_openapi.yaml 既有慣例
// 「個人偏好、投資、登入憑證及 MCP/API Token/LINE 整合不採用共享帳本選擇」，
// 載具憑證屬個人整合憑證，一律以登入者本人 `auth.userId` 操作：
//  - 不會以共享帳本其他成員的憑證查詢或寫入帳本資料（避免憑證共用）
//  - 同步產生的交易草稿只屬於登入者本人，需本人確認後才入帳
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../lib/auditHelpers';
import {
  EinvoiceError,
  bindCarrier,
  carrierAuditMetadata,
  listCarriers,
} from '../../../../lib/einvoiceCarrier';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ carriers: listCarriers(auth.userId) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    carrierBarcode?: unknown;
    verifyCode?: unknown;
  };

  try {
    const carrier = bindCarrier(auth.userId, {
      barcode: body?.carrierBarcode,
      verifyCode: body?.verifyCode,
    });
    // 稽核只記錄遮罩後的條碼；驗證碼與其密文一律不進日誌。
    auditSensitiveAction(request, auth, {
      action: 'invoice_carrier_bind',
      metadata: carrierAuditMetadata(carrier),
    });
    return NextResponse.json({ carrier }, { status: 201 });
  } catch (e) {
    if (e instanceof EinvoiceError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    throw e;
  }
}

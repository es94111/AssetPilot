// app/api/v1/categories/route.ts — API Token 認證的公開分類端點（API 自動化）
//
// GET → 查詢分類清單（需 categories:read）。
//
// 分類資料依帳本解析（query/body ledgerId，預設個人帳本），回應只含對外穩定欄位。
// 回應一律帶 Cache-Control: no-store（見 lib/apiTokenRequestAuth.ts）。
import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '../../../../lib/db';
import { resolveLedgerScope } from '../../../../lib/ledgerScope';
import {
  requireApiToken,
  jsonNoStore,
  readRequestedLedgerId,
  ledgerScopeError,
} from '../../../../lib/apiTokenRequestAuth';

interface CategoryRow {
  id: string;
  name: string;
  type: string;
  color: string;
  is_default: number | null;
  sort_order: number;
  parent_id: string | null;
}

export async function GET(request: NextRequest) {
  const auth = requireApiToken(request, 'categories:read');
  if (auth instanceof NextResponse) return auth;

  const scope = resolveLedgerScope({
    userId: auth.userId,
    ledgerId: readRequestedLedgerId(request),
  });
  if (!scope.ok) return ledgerScopeError(scope.reason);

  const rows = queryAll(
    `SELECT id, name, type, color, is_default, sort_order, parent_id
       FROM categories
      WHERE user_id = ?
      ORDER BY sort_order`,
    [scope.dataOwnerId],
  ) as unknown as CategoryRow[];

  return jsonNoStore({
    categories: rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      type: String(row.type),
      color: String(row.color),
      isDefault: Number(row.is_default) === 1,
      sortOrder: Number(row.sort_order) || 0,
      parentId: row.parent_id || null,
    })),
  });
}

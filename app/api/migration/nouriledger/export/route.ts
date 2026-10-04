import { NextRequest, NextResponse } from 'next/server';
import { writeOperationAudit } from '@/lib/auditHelpers';
import { getRequestIpFromHeaders } from '@/lib/loginHelpers';
import { buildAssetPilotPackage, PackageTooLargeError, UnsupportedAccountError } from '@/lib/nouriledgerExport';
import { encodeWarnings } from '@/lib/nouriledgerHandoff';
import { failure, NO_STORE, resolveGrant } from '@/lib/nouriledgerGrant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 伺服器對伺服器：登入者本人的資料（精確 NUMERIC、含照片），不含其他任何人。消耗一次性 code。
// 內容是解密後的個資，永遠不可被快取。
export async function POST(request: NextRequest) {
  const grant = await resolveGrant(request, { consume: true, scope: 'export', limit: 5 });
  if (!grant.ok) return grant.response;
  const audit = (result: 'success' | 'failed', metadata: Record<string, unknown>) => writeOperationAudit({
    userId: grant.userId, role: 'user', action: 'export_to_nouriledger', result, isAdminOperation: false,
    ipAddress: getRequestIpFromHeaders(request.headers), userAgent: request.headers.get('user-agent') || '', metadata,
  });
  try {
    const result = await buildAssetPilotPackage(grant.userId);
    audit('success', { byteSize: result.buffer.length, rows: Object.values(result.counts).reduce((sum, count) => sum + count, 0), warnings: result.warnings.length });
    const headers: Record<string, string> = {
      ...NO_STORE, 'Content-Type': 'application/zip', 'Content-Length': String(result.buffer.length), 'X-Content-Type-Options': 'nosniff',
    };
    if (result.warnings.length) headers['X-Nouriledger-Export-Warnings'] = encodeWarnings(result.warnings);
    return new NextResponse(new Uint8Array(result.buffer), { status: 200, headers });
  } catch (error) {
    if (error instanceof UnsupportedAccountError) { audit('failed', { failure_reason: 'unsupported_account' }); return failure('unsupported_account', 422); }
    if (error instanceof PackageTooLargeError) { audit('failed', { failure_reason: 'too_large' }); return failure('too_large', 413); }
    audit('failed', { failure_reason: 'server_error' });
    console.error('export_to_nouriledger failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}

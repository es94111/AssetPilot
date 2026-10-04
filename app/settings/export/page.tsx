export const dynamic = 'force-dynamic';
import AppLayout from '../../../components/layout/AppLayout';
import DataTransferClient from '../../../components/features/data-transfer/DataTransferClient';
import { requireServerAuth } from '../../../lib/serverAuth';
import { getNouriLedgerOrigin } from '../../../lib/nouriledgerHandoff';

export default async function DataTransferPage() {
  const user = await requireServerAuth();
  // 只有設定了 NOURILEDGER_ORIGIN 才顯示「一鍵匯入 NouriLedger」；未設定則整個功能不存在。
  const nouriLedgerOrigin = getNouriLedgerOrigin();
  return (
    <AppLayout user={user}>
      <DataTransferClient user={user} nouriLedgerStartUrl={nouriLedgerOrigin ? `${nouriLedgerOrigin}/migrate/start?source=assetpilot` : null} />
    </AppLayout>
  );
}

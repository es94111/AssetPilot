import AppLayout from "@/components/layout/AppLayout";
import LedgerManagementClient from "@/components/features/ledgers/LedgerManagementClient";
import { requireServerAuth } from "@/lib/serverAuth";

type PageProps = {
  searchParams: Promise<{ invite?: string | string[] }>;
};

export default async function LedgerSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requestedInvite = Array.isArray(params.invite) ? params.invite[0] : params.invite;
  const inviteToken = requestedInvite && /^[a-f0-9]{64}$/i.test(requestedInvite)
    ? requestedInvite.toLowerCase()
    : "";
  const returnTo = inviteToken
    ? `/settings/ledgers?invite=${encodeURIComponent(inviteToken)}`
    : "/settings/ledgers";
  const user = await requireServerAuth(returnTo);

  return (
    <AppLayout user={user}>
      <LedgerManagementClient invitationToken={inviteToken} />
    </AppLayout>
  );
}

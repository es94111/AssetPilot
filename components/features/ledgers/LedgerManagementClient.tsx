'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/components/i18n/I18nProvider';
import {
  ACTIVE_LEDGER_STORAGE_KEY,
  setActiveLedgerId,
  apiFetch,
  apiGet,
  apiPatch,
  apiPost,
} from '@/lib/clientApi';

type LedgerItem = {
  id: string;
  name: string;
  isShared: boolean;
  isPersonal: boolean;
  role: 'owner' | 'editor' | 'viewer';
  memberCount: number;
};

type LedgerMember = {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: number;
};

type LedgerInvitation = {
  id: string;
  email: string;
  role: 'editor' | 'viewer';
  expiresAt: number;
};

type LedgerAuditEntry = {
  id: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  result: string;
  createdAt: number;
};

function getError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function LedgerManagementClient({ invitationToken }: { invitationToken: string }) {
  const { t } = useT();
  const router = useRouter();
  const [ledgers, setLedgers] = useState<LedgerItem[]>([]);
  const [activeId, setActiveId] = useState('');
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [invitations, setInvitations] = useState<LedgerInvitation[]>([]);
  const [audit, setAudit] = useState<LedgerAuditEntry[]>([]);
  const [ledgerName, setLedgerName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const detailLoadId = useRef(0);

  const activeLedger = useMemo(
    () => ledgers.find((ledger) => ledger.id === activeId) || null,
    [activeId, ledgers],
  );
  const ledgerPath = `/api/ledgers/${encodeURIComponent(activeId)}`;

  async function loadLedgers(preferredId = '') {
    const rows = await apiGet('/api/ledgers') as LedgerItem[];
    setLedgers(rows);
    const stored = window.localStorage.getItem(ACTIVE_LEDGER_STORAGE_KEY) || '';
    const selected = rows.find((ledger) => ledger.id === preferredId)
      || rows.find((ledger) => ledger.id === stored)
      || rows.find((ledger) => ledger.isPersonal)
      || rows[0];
    if (selected) {
      setActiveId(selected.id);
      setActiveLedgerId(selected.id);
    }
  }

  async function loadLedgerDetails(ledgerId: string) {
    const loadId = ++detailLoadId.current;
    setMembers([]);
    setInvitations([]);
    setAudit([]);
    const base = `/api/ledgers/${encodeURIComponent(ledgerId)}`;
    const details = await apiGet(`${base}/members`);
    if (loadId !== detailLoadId.current) return;
    setMembers(details.members || []);
    if (details.ledger?.isShared && details.ledger.role === 'owner') {
      const [pending, events] = await Promise.all([
        apiGet(`${base}/invitations`).catch(() => []),
        apiGet(`${base}/audit?limit=50`).catch(() => []),
      ]);
      if (loadId !== detailLoadId.current) return;
      setInvitations(pending || []);
      setAudit(events || []);
    } else {
      setInvitations([]);
      setAudit([]);
    }
  }

  useEffect(() => {
    let mounted = true;
    apiGet('/api/ledgers')
      .then((rows: LedgerItem[]) => {
        if (!mounted || !Array.isArray(rows)) return;
        setLedgers(rows);
        const stored = window.localStorage.getItem(ACTIVE_LEDGER_STORAGE_KEY) || '';
        const selected = rows.find((ledger) => ledger.id === stored)
          || rows.find((ledger) => ledger.isPersonal)
          || rows[0];
        if (selected) {
          setActiveId(selected.id);
          setActiveLedgerId(selected.id);
        }
      })
      .catch((loadError) => {
        if (mounted) setError(getError(loadError, t('ledger.loadError')));
      });
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (!activeId) return;
    let mounted = true;
    loadLedgerDetails(activeId).catch((loadError) => {
      if (mounted) setError(getError(loadError, t('ledger.loadError')));
    });
    return () => {
      mounted = false;
      detailLoadId.current += 1;
    };
  }, [activeId, ledgers, t]);

  async function createLedger(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    const name = ledgerName.trim();
    if (!name) {
      setError(t('ledger.createName'));
      return;
    }
    setBusy(true);
    try {
      const result = await apiPost('/api/ledgers', { name });
      setLedgerName('');
      await loadLedgers(result.id);
      setNotice(t('ledger.created'));
    } catch (createError) {
      setError(getError(createError, t('ledger.createError')));
    } finally {
      setBusy(false);
    }
  }

  async function sendInvitation(event: React.FormEvent) {
    event.preventDefault();
    if (!activeLedger) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await apiPost(`${ledgerPath}/members`, { email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      await loadLedgerDetails(activeId);
      setNotice(t('ledger.invited'));
    } catch (inviteError) {
      setError(getError(inviteError, t('ledger.error')));
    } finally {
      setBusy(false);
    }
  }

  async function acceptInvitation() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await apiPost('/api/ledgers/invitations/accept', { token: invitationToken });
      await loadLedgers(String(result.ledgerId));
      setNotice(t('ledger.inviteAccepted'));
      router.replace('/settings/ledgers');
    } catch (acceptError) {
      setError(getError(acceptError, t('ledger.error')));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(member: LedgerMember, role: 'editor' | 'viewer') {
    setError('');
    setBusy(true);
    try {
      await apiPatch(`${ledgerPath}/members`, { userId: member.id, role });
      await loadLedgerDetails(activeId);
    } catch (roleError) {
      setError(getError(roleError, t('ledger.error')));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member: LedgerMember) {
    if (!window.confirm(t('ledger.removeConfirm'))) return;
    setError('');
    setBusy(true);
    try {
      await apiFetch(`${ledgerPath}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id }),
      });
      await loadLedgerDetails(activeId);
    } catch (removeError) {
      setError(getError(removeError, t('ledger.error')));
    } finally {
      setBusy(false);
    }
  }

  async function transferOwnership(member: LedgerMember) {
    if (!window.confirm(t('ledger.transferConfirm'))) return;
    setError('');
    setBusy(true);
    try {
      await apiPost(`${ledgerPath}/transfer`, { userId: member.id });
      await loadLedgers(activeId);
      await loadLedgerDetails(activeId);
      setNotice(t('ledger.ownerTransferred'));
    } catch (transferError) {
      setError(getError(transferError, t('ledger.error')));
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvitation(invitationId: string) {
    setError('');
    setBusy(true);
    try {
      await apiFetch(`${ledgerPath}/invitations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });
      await loadLedgerDetails(activeId);
    } catch (revokeError) {
      setError(getError(revokeError, t('ledger.error')));
    } finally {
      setBusy(false);
    }
  }

  async function leaveLedger() {
    if (!activeLedger || !window.confirm(t('ledger.leaveConfirm'))) return;
    setError('');
    setBusy(true);
    try {
      await apiPost(`${ledgerPath}/leave`);
      const personal = ledgers.find((ledger) => ledger.isPersonal);
      if (personal) {
        setActiveLedgerId(personal.id);
        setActiveId(personal.id);
      }
      await loadLedgers(personal?.id || '');
      setNotice(t('ledger.left'));
    } catch (leaveError) {
      setError(getError(leaveError, t('ledger.error')));
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = (role: string) => t(`ledger.${role}`);
  const isOwner = activeLedger?.role === 'owner';
  const isShared = !!activeLedger?.isShared;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{t('ledger.title')}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('ledger.description')}</p>
      </header>

      {invitationToken && (
        <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--primary)', background: 'var(--primary-light-bg)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{t('ledger.inviteInstructions')}</h2>
          <button type="button" className="btn-primary mt-3" onClick={acceptInvitation} disabled={busy}>
            {t('ledger.acceptInvite')}
          </button>
        </section>
      )}

      {error && <p className="rounded-xl p-3 text-sm" role="alert" style={{ background: 'var(--danger-light-bg)', color: 'var(--danger)' }}>{error}</p>}
      {notice && <p className="rounded-xl p-3 text-sm" role="status" style={{ background: 'var(--success-light-bg)', color: 'var(--success)' }}>{notice}</p>}

      <section className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)] md:items-end">
          <div>
            <label htmlFor="ledger-select" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>{t('ledger.activeLedger')}</label>
            <select
              id="ledger-select"
              className="min-h-11 w-full rounded-lg border px-3 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              value={activeId}
              disabled={busy}
              onChange={(event) => {
                const nextId = event.target.value;
                setActiveLedgerId(nextId);
                setActiveId(nextId);
              }}
            >
              {ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>{ledger.isShared ? ledger.name : t('ledger.personal')}</option>
              ))}
            </select>
          </div>
          <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{t('ledger.emptySharedNotice')}</p>
        </div>
      </section>

      <section className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text)' }}>{t('ledger.create')}</h2>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={createLedger}>
          <input
            value={ledgerName}
            onChange={(event) => setLedgerName(event.target.value)}
            maxLength={80}
            placeholder={t('ledger.createName')}
            aria-label={t('ledger.createName')}
            className="min-h-11 flex-1 rounded-lg border px-3 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          />
          <button type="submit" className="btn-primary min-h-11" disabled={busy}>{t('ledger.createButton')}</button>
        </form>
      </section>

      {activeLedger && (
        <section className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{t('ledger.members')}</h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{activeLedger.isShared ? activeLedger.name : t('ledger.personal')}</p>
            </div>
            {isShared && activeLedger.role !== 'owner' && (
              <button type="button" className="btn-secondary" onClick={leaveLedger} disabled={busy}>{t('ledger.leave')}</button>
            )}
          </div>

          {isShared && isOwner && (
            <form className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={sendInvitation}>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder={t('ledger.inviteEmail')}
                aria-label={t('ledger.inviteEmail')}
                className="min-h-11 rounded-lg border px-3 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              />
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as 'editor' | 'viewer')}
                aria-label={t('ledger.role')}
                className="min-h-11 rounded-lg border px-3 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              >
                <option value="editor">{roleLabel('editor')}</option>
                <option value="viewer">{roleLabel('viewer')}</option>
              </select>
              <button type="submit" className="btn-primary min-h-11" disabled={busy}>{t('ledger.sendInvite')}</button>
            </form>
          )}

          {!isShared && <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('ledger.personalOnly')}</p>}
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {members.length === 0 && <p className="py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('ledger.noMembers')}</p>}
            {members.map((member) => (
              <div key={member.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>{member.displayName || member.email}</p>
                  <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{member.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2.5 py-1 text-xs" style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)' }}>{roleLabel(member.role)}</span>
                  {isShared && isOwner && member.role !== 'owner' && (
                    <>
                      <select
                        value={member.role}
                        aria-label={`${t('ledger.changeRole')}: ${member.displayName || member.email}`}
                        onChange={(event) => changeRole(member, event.target.value as 'editor' | 'viewer')}
                        disabled={busy}
                        className="min-h-9 rounded-lg border px-2 text-xs"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                      >
                        <option value="editor">{roleLabel('editor')}</option>
                        <option value="viewer">{roleLabel('viewer')}</option>
                      </select>
                      <button type="button" className="btn-secondary min-h-9 px-2 text-xs" onClick={() => transferOwnership(member)} disabled={busy}>{t('ledger.transferOwner')}</button>
                      <button type="button" className="btn-secondary min-h-9 px-2 text-xs" onClick={() => removeMember(member)} disabled={busy}>{t('ledger.remove')}</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {isShared && isOwner && (
        <>
          <section className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text)' }}>{t('ledger.pendingInvitations')}</h2>
            {invitations.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('ledger.noInvitations')}</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{invitation.email}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {roleLabel(invitation.role)} · {t('ledger.invitationExpires')} {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button type="button" className="btn-secondary min-h-9 px-3 text-xs" disabled={busy} onClick={() => revokeInvitation(invitation.id)}>{t('ledger.revoke')}</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text)' }}>{t('ledger.audit')}</h2>
            {audit.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('ledger.noAudit')}</p>
            ) : (
              <div className="max-h-96 divide-y overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                {audit.map((entry) => (
                  <div key={entry.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="truncate font-medium" style={{ color: 'var(--text)' }}>{entry.actorEmail || entry.actorUserId}</p>
                      <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{entry.action} · {entry.result}</p>
                    </div>
                    <time className="text-xs" style={{ color: 'var(--text-muted)' }} dateTime={new Date(entry.createdAt).toISOString()}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {isShared && activeLedger?.role === 'owner' && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('ledger.lastOwnerNotice')}</p>}
    </div>
  );
}

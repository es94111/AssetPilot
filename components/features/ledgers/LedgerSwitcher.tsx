'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useT } from '@/components/i18n/I18nProvider';
import { apiGet, ACTIVE_LEDGER_STORAGE_KEY, LEDGER_CHANGED_EVENT, setActiveLedgerId } from '@/lib/clientApi';

type LedgerOption = {
  id: string;
  name: string;
  isShared: boolean;
  isPersonal: boolean;
  role: 'owner' | 'editor' | 'viewer';
};

export default function LedgerSwitcher({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useT();
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    let active = true;
    apiGet('/api/ledgers')
      .then((rows: LedgerOption[]) => {
        if (!active || !Array.isArray(rows)) return;
        setLedgers(rows);
        const stored = window.localStorage.getItem(ACTIVE_LEDGER_STORAGE_KEY) || '';
        const selected = rows.find((ledger) => ledger.id === stored)
          || rows.find((ledger) => ledger.isPersonal)
          || rows[0];
        if (selected) {
          const previousCookie = document.cookie.split(';').map((value) => value.trim())
            .find((value) => value.startsWith('activeLedgerId='))?.slice('activeLedgerId='.length);
          setActiveId(selected.id);
          setActiveLedgerId(selected.id);
          if ((stored && stored !== selected.id && window.location.pathname !== '/dashboard')
            || (selected.isShared && window.location.pathname === '/dashboard' && previousCookie !== encodeURIComponent(selected.id))) {
            window.location.reload();
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onChange = (event: Event) => {
      const ledgerId = (event as CustomEvent<{ ledgerId: string }>).detail?.ledgerId;
      if (ledgerId) {
        setActiveId(ledgerId);
        void apiGet('/api/ledgers').then((rows) => {
          if (Array.isArray(rows)) setLedgers(rows);
        }).catch(() => {});
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_LEDGER_STORAGE_KEY) window.location.reload();
    };
    window.addEventListener(LEDGER_CHANGED_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LEDGER_CHANGED_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const selectLedger = (ledgerId: string) => {
    if (!ledgerId || ledgerId === activeId) return;
    try {
      setActiveLedgerId(ledgerId);
    } catch {
      return;
    }
    setActiveId(ledgerId);
    window.location.reload();
  };

  if (collapsed) {
    return (
      <div className="px-3 pt-2">
        <Link
          href="/settings/ledgers"
          onClick={onNavigate}
          title={t('ledger.manage')}
          aria-label={t('ledger.manage')}
          className="nav-link justify-center px-0"
        >
          <span aria-hidden="true">◫</span>
        </Link>
      </div>
    );
  }

  return (
    <section className="mx-3 my-3 rounded-xl p-3" style={{ background: 'var(--surface-subtle)' }} aria-label={t('ledger.activeLedger')}>
      <label htmlFor="active-ledger" className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {t('ledger.activeLedger')}
      </label>
      <select
        id="active-ledger"
        value={activeId}
        onChange={(event) => selectLedger(event.target.value)}
        className="min-h-10 w-full rounded-lg border px-2 text-sm"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        disabled={ledgers.length === 0}
      >
        {ledgers.map((ledger) => (
          <option key={ledger.id} value={ledger.id}>
            {ledger.isShared ? ledger.name : t('ledger.personal')}
          </option>
        ))}
      </select>
      {ledgers.find((ledger) => ledger.id === activeId)?.role === 'viewer' && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{t('ledger.viewer')}</p>
      )}
      <Link
        href="/settings/ledgers"
        onClick={onNavigate}
        className="mt-2 inline-flex min-h-8 items-center text-xs font-medium"
        style={{ color: 'var(--text)' }}
      >
        {t('ledger.manage')}
      </Link>
    </section>
  );
}

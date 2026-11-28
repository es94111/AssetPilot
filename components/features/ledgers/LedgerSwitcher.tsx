'use client';

import { BookOpen } from 'lucide-react';
import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { useT } from '@/components/i18n/I18nProvider';
import {
  ACTIVE_LEDGER_STORAGE_KEY, LEDGER_CHANGED_EVENT, apiGet, getActiveLedgerId, setActiveLedgerId,
} from '@/lib/clientApi';

type LedgerOption = {
  id: string;
  name: string;
  isShared: boolean;
  isPersonal: boolean;
  role: 'owner' | 'editor' | 'viewer';
};

type ActiveLedgerContextValue = {
  ledgers: LedgerOption[];
  activeId: string;
  canWrite: boolean;
  readOnly: boolean;
  selectLedger: (id: string) => void;
};

const ActiveLedgerContext = createContext<ActiveLedgerContextValue>({
  ledgers: [], activeId: '', canWrite: false, readOnly: false, selectLedger: () => {},
});

export function useActiveLedger() {
  return useContext(ActiveLedgerContext);
}

export function ActiveLedgerProvider({ children }: { children: ReactNode }) {
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    let mounted = true;
    let request = 0;
    let restoringSelection = false;

    async function load() {
      const current = ++request;
      try {
        const rows = await apiGet('/api/ledgers') as LedgerOption[];
        if (!mounted || current !== request || !Array.isArray(rows)) return;
        const stored = getActiveLedgerId();
        const selected = rows.find(ledger => ledger.id === stored)
          ?? rows.find(ledger => ledger.isPersonal)
          ?? rows[0];
        setLedgers(rows);
        setActiveId(selected?.id ?? '');
        if (!selected) return;

        const currentCookie = document.cookie.split('; ').find(item => item.startsWith('activeLedgerId='));
        if (stored === selected.id && currentCookie === `activeLedgerId=${encodeURIComponent(selected.id)}`) return;
        restoringSelection = true;
        try {
          setActiveLedgerId(selected.id);
          if ((stored && stored !== selected.id) || (window.location.pathname === '/dashboard' && (selected.isShared || currentCookie))) {
            window.location.reload();
          }
        } finally {
          restoringSelection = false;
        }
      } catch {
        // Retain the already loaded ledger when the connection drops.
      }
    }

    function onLedgerChange() {
      if (restoringSelection) return;
      setActiveId(getActiveLedgerId());
      void load();
    }
    function onStorage(event: StorageEvent) {
      if (event.key === ACTIVE_LEDGER_STORAGE_KEY) window.location.reload();
    }

    void load();
    window.addEventListener(LEDGER_CHANGED_EVENT, onLedgerChange);
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onLedgerChange);
    return () => {
      mounted = false;
      window.removeEventListener(LEDGER_CHANGED_EVENT, onLedgerChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', onLedgerChange);
    };
  }, []);

  const active = ledgers.find(ledger => ledger.id === activeId);
  function selectLedger(id: string) {
    if (!id || id === activeId || !ledgers.some(ledger => ledger.id === id)) return;
    try {
      setActiveLedgerId(id);
      window.location.reload();
    } catch {
      // A blocked storage operation leaves the current ledger selected.
    }
  }

  return (
    <ActiveLedgerContext.Provider value={{
      ledgers, activeId, selectLedger, canWrite: !!active && active.role !== 'viewer', readOnly: active?.role === 'viewer',
    }}>
      {children}
    </ActiveLedgerContext.Provider>
  );
}

export default function LedgerSwitcher({ compact = false, inline = false }: { compact?: boolean; inline?: boolean }) {
  const { t } = useT();
  const { ledgers, activeId, selectLedger } = useActiveLedger();
  const id = useId();
  const label = t('ledger.activeLedger');
  const picker = (
    <select
      id={id}
      aria-label={compact ? label : undefined}
      value={activeId}
      onChange={event => selectLedger(event.target.value)}
      className={compact
        ? 'absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default'
        : 'min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]'}
      disabled={ledgers.length === 0}
    >
      {ledgers.length === 0 && <option value="">{t('features.common.unspecified')}</option>}
      {ledgers.map(ledger => (
        <option key={ledger.id} value={ledger.id}>
          {ledger.isShared ? ledger.name : t('ledger.personal')}
        </option>
      ))}
    </select>
  );
  if (compact) {
    return (
      <div className="px-3 pt-2">
        <div title={label} className="nav-link relative min-h-11 justify-center focus-within:outline-2 focus-within:outline-[var(--focus-ring)]">
          <BookOpen size={18} aria-hidden="true" />
          {picker}
        </div>
      </div>
    );
  }

  return (
    <div className={inline ? 'flex min-h-12 items-center gap-3' : 'space-y-1 border-b border-[var(--border)] p-3'}>
      <label htmlFor={id} className="shrink-0 text-xs font-medium text-[var(--text-secondary)]">{label}</label>
      {picker}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config';
import { useT } from './I18nProvider';

export function PublicLanguageSwitcher({
  compact = false,
  tone = 'dark',
}: {
  compact?: boolean;
  tone?: 'dark' | 'light';
}) {
  const router = useRouter();
  const { locale, t } = useT();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  async function onChange(next: Locale) {
    if (next === locale || saving) return;
    setSaving(true);
    try {
      const response = await fetch('/api/i18n/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      });
      if (response.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setSaving(false);
    }
  }

  const selectClass = tone === 'light'
    ? 'rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none transition hover:border-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
    : 'rounded-lg border border-white/15 bg-white/10 px-2.5 py-2 text-sm text-white outline-none transition hover:border-white/30 disabled:opacity-60';

  return (
    <label className={`inline-flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} ${tone === 'light' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300'}`}>
      <span className="sr-only">{t('common.language')}</span>
      <select
        aria-label={t('common.language')}
        value={locale}
        disabled={saving || pending}
        onChange={(event) => onChange(event.target.value as Locale)}
        className={selectClass}
      >
        {LOCALES.map((loc) => (
          <option key={loc} value={loc} className={tone === 'light' ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
    </label>
  );
}

'use client';

// components/i18n/LanguageSwitcher.tsx — 語言切換器（示範端到端流程）
//
// 流程：選語言 → POST /api/account/settings/language（寫 DB + cookie）
//       → router.refresh() 讓 server layout 依新 cookie 重新解析 locale 並重渲染。

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config';
import { useT } from './I18nProvider';

export function LanguageSwitcher() {
  const router = useRouter();
  const { locale, t } = useT();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  async function onChange(next: Locale) {
    if (next === locale || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/account/settings/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label htmlFor="language-select" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
        {t('settings.language.title')}
      </label>
      <p style={{ margin: '0 0 8px', opacity: 0.7, fontSize: 14 }}>
        {t('settings.language.description')}
      </p>
      <select
        id="language-select"
        value={locale}
        disabled={saving || pending}
        onChange={(e) => onChange(e.target.value as Locale)}
      >
        {LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}

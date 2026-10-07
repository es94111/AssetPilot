'use client';

// components/features/reconciliation/ReconciliationClient.tsx — 銀行／券商對帳匯入與差異比對（issue #251）。
//
// 流程：選檔（OFX／CSV）→（CSV 時）設定欄位對應 → 送出匯入 → 顯示對帳結果三類差異。
// 匯入採「整批原子化」：伺服器端有任何一列解析失敗即整批拒絕，因此前端不自行略過
// 壞列，而是顯示後端回傳的錯誤列號讓使用者修正原檔。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';
import {
  RECONCILIATION_ACCEPT_EXTENSIONS,
  RECONCILIATION_DATE_FORMATS,
  RECONCILIATION_DIFF_BADGE_CLASSES,
  RECONCILIATION_DIFF_LABEL_KEYS,
  RECONCILIATION_PROFILE_TEMPLATES,
  buildReconciliationProfile,
  detectReconciliationFormat,
  groupReconciliationDiffs,
  validateReconciliationProfile,
  type ReconciliationDiffRow,
} from '@/lib/reconciliationUi';
import type { ReconciliationCsvProfile, ReconciliationDateFormat } from '@/lib/csvReconciliationParser';

interface AccountOption {
  id: string;
  name: string;
}

interface SessionSummary {
  id: string;
  sourceKind: string;
  sourceFormat: string;
  filename: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  statementTotal: number;
  ledgerTotal: number;
  matchedCount: number;
  counts: { ledger_only: number; statement_only: number; amount_mismatch: number };
  createdAt: number;
}

interface ImportResult {
  sessionId: string;
  sourceFormat: string;
  sourceKind: string;
  filename: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  statementTotal: number;
  ledgerTotal: number;
  matchedCount: number;
  counts: { ledger_only: number; statement_only: number; amount_mismatch: number };
  skippedTypes: Record<string, number>;
}

interface SavedProfile {
  id: string;
  name: string;
  profile: ReconciliationCsvProfile | null;
  updatedAt: number;
}

const CARD_CLASS =
  'rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const FIELD_CLASS =
  'w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400';
const DIFF_ORDER = ['amount_mismatch', 'statement_only', 'ledger_only'] as const;

export default function ReconciliationClient() {
  const { locale, t } = useT();
  const dateLocale = localeTag(locale);
  const ta = (key: string, vars?: Record<string, string | number>) =>
    t(`features.reconciliation.${key}`, vars);

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [rowErrors, setRowErrors] = useState<Array<{ line?: number; reason?: string }>>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [sessionItems, setSessionItems] = useState<ReconciliationDiffRow[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');

  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [profileId, setProfileId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [delimiter, setDelimiter] = useState(',');
  const [hasHeader, setHasHeader] = useState(true);
  const [skipRows, setSkipRows] = useState(0);
  const [dateFormat, setDateFormat] = useState<ReconciliationDateFormat>('auto');
  const [amountSign, setAmountSign] = useState<'signed' | 'credit_card'>('signed');
  const [dateColumn, setDateColumn] = useState('日期');
  const [amountColumn, setAmountColumn] = useState('金額');
  const [debitColumn, setDebitColumn] = useState('');
  const [creditColumn, setCreditColumn] = useState('');
  const [descriptionColumn, setDescriptionColumn] = useState('摘要');
  const [fitidColumn, setFitidColumn] = useState('');

  const fileFormat = useMemo(() => (file ? detectReconciliationFormat(file.name) : 'csv'), [file]);

  const draftProfile = useMemo<ReconciliationCsvProfile>(
    () =>
      buildReconciliationProfile({
        dateFormat,
        amountSign,
        delimiter,
        skipRows,
        hasHeader,
        date: dateColumn,
        amount: amountColumn,
        debit: debitColumn,
        credit: creditColumn,
        description: descriptionColumn,
        fitid: fitidColumn,
      }),
    [
      amountColumn, amountSign, creditColumn, dateColumn, dateFormat, debitColumn,
      delimiter, descriptionColumn, fitidColumn, hasHeader, skipRows,
    ],
  );

  const profileIssue = useMemo(() => validateReconciliationProfile(draftProfile), [draftProfile]);

  const profileIssueMessage = useCallback(
    (issue: ReturnType<typeof validateReconciliationProfile>): string => {
      if (issue === 'missingDate') return ta('messages.missingDateColumn');
      if (issue === 'missingAmount') return ta('messages.missingAmountColumn');
      if (issue === 'conflictingAmount') return ta('messages.conflictingAmountColumn');
      return '';
    },
    // ta 由 t 與 locale 決定，兩者變動時訊息需重新產生。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale],
  );

  const loadAccounts = useCallback(async () => {
    try {
      const data = await apiGet('/api/accounts');
      const list: AccountOption[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.accounts)
          ? data.accounts
          : [];
      setAccounts(list.map((account) => ({ id: String(account.id), name: String(account.name) })));
    } catch {
      setAccounts([]);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const data = await apiGet('/api/reconciliation/sessions?limit=20');
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch {
      setSessions([]);
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const data = await apiGet('/api/reconciliation/profiles');
      setProfiles(Array.isArray(data?.profiles) ? data.profiles : []);
    } catch {
      setProfiles([]);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
    void loadSessions();
    void loadProfiles();
  }, [loadAccounts, loadProfiles, loadSessions]);

  function applyTemplate(index: number) {
    const template = RECONCILIATION_PROFILE_TEMPLATES[index];
    if (!template) return;
    const { columns } = template.profile;
    setDateFormat(template.profile.dateFormat || 'auto');
    setAmountSign(template.profile.amountSign || 'signed');
    setDateColumn(columns.date || '');
    setAmountColumn(columns.amount || '');
    setDebitColumn(columns.debit || '');
    setCreditColumn(columns.credit || '');
    setDescriptionColumn(columns.description || '');
    setFitidColumn(columns.fitid || '');
    setProfileId('');
  }

  function applySavedProfile(id: string) {
    setProfileId(id);
    const saved = profiles.find((profile) => profile.id === id);
    if (!saved?.profile) return;
    const { columns } = saved.profile;
    setDelimiter(saved.profile.delimiter || ',');
    setHasHeader(saved.profile.hasHeader !== false);
    setSkipRows(saved.profile.skipRows || 0);
    setDateFormat(saved.profile.dateFormat || 'auto');
    setAmountSign(saved.profile.amountSign || 'signed');
    setDateColumn(columns.date || '');
    setAmountColumn(columns.amount || '');
    setDebitColumn(columns.debit || '');
    setCreditColumn(columns.credit || '');
    setDescriptionColumn(columns.description || '');
    setFitidColumn(columns.fitid || '');
  }

  async function handleSaveProfile() {
    const name = profileName.trim();
    if (!name) {
      setErrorMessage(ta('messages.profileNameRequired'));
      return;
    }
    if (profileIssue) {
      setErrorMessage(profileIssueMessage(profileIssue));
      return;
    }
    setBusy(true);
    setErrorMessage('');
    try {
      const data = await apiPost('/api/reconciliation/profiles', { name, profile: draftProfile });
      setMessage(ta('messages.profileSaved', { name }));
      setProfileName('');
      setProfileId(String(data?.profile?.id || ''));
      await loadProfiles();
    } catch (error: any) {
      setErrorMessage(error?.message || ta('messages.profileSaveFailed'));
    }
    setBusy(false);
  }

  async function handleDeleteProfile(id: string) {
    setBusy(true);
    setErrorMessage('');
    try {
      await apiDelete(`/api/reconciliation/profiles?id=${encodeURIComponent(id)}`);
      if (profileId === id) setProfileId('');
      setMessage(ta('messages.profileDeleted'));
      await loadProfiles();
    } catch (error: any) {
      setErrorMessage(error?.message || ta('messages.profileDeleteFailed'));
    }
    setBusy(false);
  }

  async function handleImport() {
    if (!file) {
      setErrorMessage(ta('messages.chooseFile'));
      return;
    }
    if (fileFormat === 'csv' && profileIssue) {
      setErrorMessage(profileIssueMessage(profileIssue));
      return;
    }
    setBusy(true);
    setMessage('');
    setErrorMessage('');
    setRowErrors([]);
    setResult(null);
    setSessionItems([]);
    try {
      const content = await file.text();
      const payload: Record<string, unknown> = {
        format: fileFormat,
        content,
        filename: file.name,
      };
      if (accountId) payload.accountId = accountId;
      if (fileFormat === 'csv') {
        if (profileId) payload.profileId = profileId;
        else payload.profile = draftProfile;
      }
      const data: ImportResult = await apiPost('/api/reconciliation/import', payload);
      setResult(data);
      setActiveSessionId(data.sessionId);
      setMessage(ta('messages.importDone', { filename: file.name }));
      await loadSessions();
      await openSession(data.sessionId);
    } catch (error: any) {
      setErrorMessage(error?.message || ta('messages.importFailed'));
      const raw = String(error?.message || '');
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.errors)) setRowErrors(parsed.errors);
      } catch {
        /* 錯誤訊息非 JSON（一般錯誤），忽略 */
      }
    }
    setBusy(false);
  }

  async function openSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setBusy(true);
    try {
      const data = await apiGet(`/api/reconciliation/sessions/${encodeURIComponent(sessionId)}`);
      const session = data?.session;
      if (session) {
        setResult({
          sessionId: session.id,
          sourceFormat: session.sourceFormat,
          sourceKind: session.sourceKind,
          filename: session.filename,
          currency: session.currency,
          periodStart: session.periodStart,
          periodEnd: session.periodEnd,
          statementTotal: session.statementTotal,
          ledgerTotal: session.ledgerTotal,
          matchedCount: session.matchedCount,
          counts: session.counts,
          skippedTypes: session.skippedTypes || {},
        });
      }
      setSessionItems(Array.isArray(data?.items) ? data.items : []);
    } catch (error: any) {
      setErrorMessage(error?.message || ta('messages.sessionLoadFailed'));
      setSessionItems([]);
    }
    setBusy(false);
  }

  const groupedDiffs = useMemo(() => groupReconciliationDiffs(sessionItems), [sessionItems]);

  const formatMoney = (value: number) =>
    Number(value || 0).toLocaleString(dateLocale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const formatDate = (value: string) => value || '—';

  const formatTimestamp = (value: number) =>
    value ? new Date(value).toLocaleString(dateLocale) : '—';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{ta('title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ta('subtitle')}</p>
      </header>

      {message && (
        <p
          className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-200"
          role="status"
        >
          {message}
        </p>
      )}
      {errorMessage && (
        <div
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200"
          role="alert"
        >
          <p>{errorMessage}</p>
          {rowErrors.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
              {rowErrors.slice(0, 20).map((rowError, index) => (
                <li key={`${rowError.line}-${index}`}>
                  {ta('messages.rowError', { line: rowError.line ?? '?', reason: rowError.reason || '' })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section className={CARD_CLASS} aria-labelledby="reconciliation-import-heading">
        <h2
          id="reconciliation-import-heading"
          className="text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          {ta('import.section')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ta('import.hint')}</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="reconciliation-file">
              {ta('import.file')}
            </label>
            <input
              id="reconciliation-file"
              type="file"
              accept={RECONCILIATION_ACCEPT_EXTENSIONS}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
                setSessionItems([]);
                setRowErrors([]);
              }}
              className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm dark:border-slate-700 dark:bg-slate-950 dark:file:bg-slate-800"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {ta('import.fileFormats')}
              {file ? ` · ${fileFormat.toUpperCase()}` : ''}
            </p>
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="reconciliation-account">
              {ta('import.account')}
            </label>
            <select
              id="reconciliation-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">{ta('import.allAccounts')}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {fileFormat === 'csv' && (
          <fieldset className="mt-5 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {ta('profile.section')}
            </legend>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-saved-profile">
                  {ta('profile.saved')}
                </label>
                <select
                  id="reconciliation-saved-profile"
                  value={profileId}
                  onChange={(event) => applySavedProfile(event.target.value)}
                  className={FIELD_CLASS}
                >
                  <option value="">{ta('profile.useDraft')}</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-template">
                  {ta('profile.template')}
                </label>
                <select
                  id="reconciliation-template"
                  value=""
                  onChange={(event) => applyTemplate(Number(event.target.value))}
                  className={FIELD_CLASS}
                >
                  <option value="">{ta('profile.chooseTemplate')}</option>
                  {RECONCILIATION_PROFILE_TEMPLATES.map((template, index) => (
                    <option key={template.labelKey} value={index}>
                      {t(template.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-sign">
                  {ta('profile.amountSign')}
                </label>
                <select
                  id="reconciliation-sign"
                  value={amountSign}
                  onChange={(event) => setAmountSign(event.target.value as 'signed' | 'credit_card')}
                  className={FIELD_CLASS}
                >
                  <option value="signed">{ta('profile.amountSignSigned')}</option>
                  <option value="credit_card">{ta('profile.amountSignCreditCard')}</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-date-format">
                  {ta('profile.dateFormat')}
                </label>
                <select
                  id="reconciliation-date-format"
                  value={dateFormat}
                  onChange={(event) => setDateFormat(event.target.value as ReconciliationDateFormat)}
                  className={FIELD_CLASS}
                >
                  {RECONCILIATION_DATE_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {format === 'auto' ? ta('profile.dateFormatAuto') : format}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-delimiter">
                  {ta('profile.delimiter')}
                </label>
                <select
                  id="reconciliation-delimiter"
                  value={delimiter}
                  onChange={(event) => setDelimiter(event.target.value)}
                  className={FIELD_CLASS}
                >
                  <option value=",">{ta('profile.delimiterComma')}</option>
                  <option value=";">{ta('profile.delimiterSemicolon')}</option>
                  <option value={'\t'}>{ta('profile.delimiterTab')}</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-skip-rows">
                  {ta('profile.skipRows')}
                </label>
                <Input
                  id="reconciliation-skip-rows"
                  type="number"
                  min={0}
                  max={50}
                  value={skipRows}
                  onChange={(event) => setSkipRows(Math.max(0, Number(event.target.value) || 0))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={hasHeader}
                    onChange={(event) => setHasHeader(event.target.checked)}
                  />
                  {ta('profile.hasHeader')}
                </label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-date-column">
                  {ta('profile.dateColumn')}
                </label>
                <Input
                  id="reconciliation-date-column"
                  value={dateColumn}
                  onChange={(event) => setDateColumn(event.target.value)}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-amount-column">
                  {ta('profile.amountColumn')}
                </label>
                <Input
                  id="reconciliation-amount-column"
                  value={amountColumn}
                  onChange={(event) => setAmountColumn(event.target.value)}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-description-column">
                  {ta('profile.descriptionColumn')}
                </label>
                <Input
                  id="reconciliation-description-column"
                  value={descriptionColumn}
                  onChange={(event) => setDescriptionColumn(event.target.value)}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-debit-column">
                  {ta('profile.debitColumn')}
                </label>
                <Input
                  id="reconciliation-debit-column"
                  value={debitColumn}
                  onChange={(event) => setDebitColumn(event.target.value)}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-credit-column">
                  {ta('profile.creditColumn')}
                </label>
                <Input
                  id="reconciliation-credit-column"
                  value={creditColumn}
                  onChange={(event) => setCreditColumn(event.target.value)}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="reconciliation-fitid-column">
                  {ta('profile.fitidColumn')}
                </label>
                <Input
                  id="reconciliation-fitid-column"
                  value={fitidColumn}
                  onChange={(event) => setFitidColumn(event.target.value)}
                />
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">{ta('profile.columnHint')}</p>

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <label className={LABEL_CLASS} htmlFor="reconciliation-profile-name">
                  {ta('profile.name')}
                </label>
                <Input
                  id="reconciliation-profile-name"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder={ta('profile.namePlaceholder')}
                />
              </div>
              <Button type="button" variant="outline" onClick={handleSaveProfile} disabled={busy}>
                {ta('profile.save')}
              </Button>
              {profileId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDeleteProfile(profileId)}
                  disabled={busy}
                >
                  {ta('profile.delete')}
                </Button>
              )}
            </div>
          </fieldset>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleImport} disabled={busy || !file}>
            {busy ? ta('import.running') : ta('import.submit')}
          </Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">{ta('import.atomicNote')}</span>
        </div>
      </section>

      {result && (
        <section className={CARD_CLASS} aria-labelledby="reconciliation-result-heading">
          <h2
            id="reconciliation-result-heading"
            className="text-lg font-semibold text-slate-900 dark:text-slate-50"
          >
            {ta('result.title')}
          </h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div>
              <dt className={LABEL_CLASS}>{ta('result.filename')}</dt>
              <dd className="text-slate-800 dark:text-slate-100">{result.filename || '—'}</dd>
            </div>
            <div>
              <dt className={LABEL_CLASS}>{ta('result.period')}</dt>
              <dd className="text-slate-800 dark:text-slate-100">
                {formatDate(result.periodStart)} ~ {formatDate(result.periodEnd)}
              </dd>
            </div>
            <div>
              <dt className={LABEL_CLASS}>{ta('result.matched')}</dt>
              <dd className="text-slate-800 dark:text-slate-100">
                {ta('result.matchedValue', {
                  matched: result.matchedCount,
                  statement: result.statementTotal,
                  ledger: result.ledgerTotal,
                })}
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {DIFF_ORDER.map((kind) => (
              <div
                key={kind}
                className={`rounded-lg px-4 py-3 text-sm font-medium ${RECONCILIATION_DIFF_BADGE_CLASSES[kind]}`}
              >
                <span className="block text-xs opacity-80">{t(RECONCILIATION_DIFF_LABEL_KEYS[kind])}</span>
                <span className="text-lg font-semibold">{result.counts[kind]}</span>
              </div>
            ))}
          </div>

          {Object.keys(result.skippedTypes || {}).length > 0 && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {ta('result.skipped', {
                detail: Object.entries(result.skippedTypes)
                  .map(([type, count]) => `${type} × ${count}`)
                  .join('、'),
              })}
            </p>
          )}
        </section>
      )}

      {activeSessionId && (
        <section className={CARD_CLASS} aria-labelledby="reconciliation-diff-heading">
          <h2
            id="reconciliation-diff-heading"
            className="text-lg font-semibold text-slate-900 dark:text-slate-50"
          >
            {ta('diff.title')}
          </h2>
          {sessionItems.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{ta('diff.empty')}</p>
          ) : (
            <div className="mt-4 space-y-6">
              {groupedDiffs.map((group) => (
                <div key={group.kind}>
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${RECONCILIATION_DIFF_BADGE_CLASSES[group.kind]}`}
                    >
                      {t(RECONCILIATION_DIFF_LABEL_KEYS[group.kind])}
                    </span>
                    <span>{ta('diff.count', { count: group.rows.length })}</span>
                  </h3>
                  {group.rows.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ta('diff.none')}</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[40rem] text-left text-sm">
                        <caption className="sr-only">
                          {t(RECONCILIATION_DIFF_LABEL_KEYS[group.kind])}
                        </caption>
                        <thead className="text-xs text-slate-500 dark:text-slate-400">
                          <tr>
                            <th scope="col" className="py-1 pr-3">
                              {ta('diff.columns.date')}
                            </th>
                            <th scope="col" className="py-1 pr-3">
                              {ta('diff.columns.ledger')}
                            </th>
                            <th scope="col" className="py-1 pr-3">
                              {ta('diff.columns.statement')}
                            </th>
                            <th scope="col" className="py-1 pr-3">
                              {ta('diff.columns.difference')}
                            </th>
                            <th scope="col" className="py-1">
                              {ta('diff.columns.reference')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {group.rows.map((row) => (
                            <tr key={row.id}>
                              <td className="whitespace-nowrap py-2 pr-3 text-slate-700 dark:text-slate-200">
                                {row.date}
                              </td>
                              <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">
                                {row.ledgerAmount ? formatMoney(row.ledgerAmount) : '—'}
                                {row.ledgerDescription ? (
                                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                                    {row.ledgerDescription}
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">
                                {row.statementAmount ? formatMoney(row.statementAmount) : '—'}
                                {row.statementDescription ? (
                                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                                    {row.statementDescription}
                                  </span>
                                ) : null}
                              </td>
                              <td className="whitespace-nowrap py-2 pr-3 text-slate-700 dark:text-slate-200">
                                {row.kind === 'amount_mismatch' ? formatMoney(row.difference) : '—'}
                              </td>
                              <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                                {row.statementLine
                                  ? ta('diff.statementLine', { line: row.statementLine })
                                  : ta('diff.ledgerRecord')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className={CARD_CLASS} aria-labelledby="reconciliation-history-heading">
        <h2
          id="reconciliation-history-heading"
          className="text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          {ta('history.title')}
        </h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{ta('history.empty')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">{ta('history.title')}</caption>
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="py-1 pr-3">
                    {ta('history.columns.time')}
                  </th>
                  <th scope="col" className="py-1 pr-3">
                    {ta('history.columns.source')}
                  </th>
                  <th scope="col" className="py-1 pr-3">
                    {ta('history.columns.period')}
                  </th>
                  <th scope="col" className="py-1 pr-3">
                    {ta('history.columns.counts')}
                  </th>
                  <th scope="col" className="py-1">
                    {ta('history.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-700 dark:text-slate-200">
                      {formatTimestamp(session.createdAt)}
                    </td>
                    <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">
                      {session.filename || `${session.sourceFormat.toUpperCase()} / ${session.sourceKind}`}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-700 dark:text-slate-200">
                      {formatDate(session.periodStart)} ~ {formatDate(session.periodEnd)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500 dark:text-slate-400">
                      {ta('history.countsValue', {
                        mismatch: session.counts.amount_mismatch,
                        statementOnly: session.counts.statement_only,
                        ledgerOnly: session.counts.ledger_only,
                      })}
                    </td>
                    <td className="py-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openSession(session.id)}
                        disabled={busy}
                      >
                        {activeSessionId === session.id ? ta('history.viewing') : ta('history.view')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';
import { allocateRepayment, type AllocationCard } from '@/lib/creditCardRepaymentAllocation';

interface BankAccount {
  id: string;
  name: string;
  currency: string;
}

interface PayableCard {
  id: string;
  name: string;
  currency: string;
  debt: number;
  debtInCardCurrency: number;
}

interface RepaymentAllocation {
  cardId: string;
  cardName: string;
  cardCurrency: string;
  amount: number;
  amountInCardCurrency: number;
  balanceAfter: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  bankAccounts: BankAccount[];
  defaultCurrency: string;
  onDone: () => void; // 關閉後由父層 load()
}

function fmt(n: number | string, currency = 'TWD', locale = 'zh-TW') {
  const num = Number(n);
  const rounded = Number.isInteger(num) ? num : Math.round(num * 100) / 100;
  return (currency === 'TWD' ? 'NT$ ' : '') + rounded.toLocaleString(localeTag(locale)) + (currency !== 'TWD' ? ` ${currency}` : '');
}

export default function CreditCardRepaymentDialog({ open, onClose, bankAccounts, defaultCurrency, onDone }: Props) {
  const { t, locale } = useT();
  const [fromAccountId, setFromAccountId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState('');
  const [cards, setCards] = useState<PayableCard[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [fromCurrency, setFromCurrency] = useState(defaultCurrency || 'TWD');
  const [snapshotError, setSnapshotError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ summaryId: string; totalAmount: number; allocations: RepaymentAllocation[]; date: string; currency: string } | null>(null);

  // 選定／改選付款帳戶時呼叫快照端點一次（FR-007a，金額變更不重新取數）
  const fetchSnapshot = useCallback(async (accountId: string) => {
    if (!accountId) { setCards([]); return; }
    setSnapshotLoading(true);
    setSnapshotError('');
    try {
      const data = await apiGet(`/api/accounts/${accountId}/repayment-cards`);
      setCards(data.cards || []);
      setFromCurrency(data.fromAccount?.currency || defaultCurrency || 'TWD');
    } catch (e: any) {
      setCards([]);
      setSnapshotError(e.message || '');
    }
    setSnapshotLoading(false);
  }, [defaultCurrency]);

  useEffect(() => {
    if (open) {
      const firstBank = bankAccounts[0]?.id || '';
      setFromAccountId(firstBank);
      setDate(new Date().toISOString().slice(0, 10));
      setTotalAmount('');
      setResult(null);
      setSubmitError('');
      fetchSnapshot(firstBank);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onPayerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setFromAccountId(id);
    setResult(null);
    setSubmitError('');
    fetchSnapshot(id);
  };

  // 前端本地重算分配預覽（FR-016a：不往返）
  const preview = useMemo(() => {
    const n = Number(totalAmount);
    if (!Number.isInteger(n) || n <= 0 || cards.length === 0) return null;
    if (n < cards.length) return null;
    try {
      const allocCards: AllocationCard[] = cards.map((c) => ({ id: c.id, debt: c.debt }));
      const result = allocateRepayment(n, allocCards);
      return result.map((r, i) => {
        const card = cards[i];
        const balanceAfter = card.debtInCardCurrency - r.amount; // 還款後餘額（付款幣別近似；正式以伺服器為準）
        return { cardId: r.cardId, amount: r.amount, balanceAfter, card };
      });
    } catch {
      return null;
    }
  }, [totalAmount, cards]);

  const totalAmountNum = Number(totalAmount);
  const amountValid = Number.isInteger(totalAmountNum) && totalAmountNum > 0;
  const tooSmall = amountValid && totalAmountNum < cards.length;
  const canSubmit = !!fromAccountId && amountValid && !tooSmall && cards.length > 0 && !submitting && !result;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromAccountId) { setSubmitError(t('features.accounts.messages.repaymentAccountRequired')); return; }
    if (!amountValid) { setSubmitError(t('features.accounts.messages.repaymentTotalAmountInvalid')); return; }
    setSubmitError('');
    setSubmitting(true);
    try {
      const data = await apiPost('/api/accounts/credit-card-repayment', {
        fromAccountId,
        date,
        totalAmount: totalAmountNum,
      });
      setResult({
        summaryId: data.summaryId,
        totalAmount: data.totalAmount,
        allocations: data.allocations,
        date: data.date,
        currency: data.currency,
      });
    } catch (err: any) {
      const body = err?.body || {};
      // FR-018a：收到 NoPayableCards／TotalAmountTooSmall 時保留已輸入金額並重取快照
      if (body.code === 'NoPayableCards' || body.code === 'TotalAmountTooSmall') {
        setSubmitError(body.error || err.message);
        fetchSnapshot(fromAccountId);
      } else {
        setSubmitError(body.error || err.message || '還款失敗');
      }
    }
    setSubmitting(false);
  }

  function handleClose() {
    if (result) onDone();
    onClose();
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('features.accounts.repayment.title')}</DialogTitle>
        </DialogHeader>

        {result ? (
          /* 結果區塊（FR-020）：送出成功後不關閉，改渲染實際分配；使用者按「完成」才關閉 */
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('features.accounts.repayment.resultTitle')}</h3>
            <p className="text-sm text-slate-500">{t('features.accounts.repayment.resultDone')}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2">{t('features.accounts.repayment.colCard')}</th>
                  <th className="py-2 text-right">{t('features.accounts.repayment.colAllocated')}</th>
                  <th className="py-2 text-right">{t('features.accounts.repayment.colBalanceAfter')}</th>
                </tr>
              </thead>
              <tbody>
                {result.allocations.map((a) => (
                  <tr key={a.cardId} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">
                      <div className="font-medium">{a.cardName}</div>
                      {a.balanceAfter > 0 && <span className="text-xs text-amber-600">{t('features.accounts.repayment.prepaidBadge')} {fmt(a.balanceAfter, a.cardCurrency, locale)}</span>}
                    </td>
                    <td className="py-2 text-right">{fmt(a.amount, result.currency, locale)}</td>
                    <td className="py-2 text-right">{fmt(a.balanceAfter, a.cardCurrency, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end">
              <Button onClick={handleClose}>{t('features.accounts.repayment.resultDone')}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select label={t('features.accounts.repayment.paymentAccount')} options={bankAccounts.map((b) => ({ label: b.name, value: b.id }))} value={fromAccountId} onChange={onPayerChange} />
            <Input label={t('features.accounts.repayment.paymentDate')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div>
              <Input label={t('features.accounts.repayment.totalAmount')} type="number" step="1" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">{t('features.accounts.repayment.totalAmountHint')}</p>
              {cards.length > 0 && <p className="mt-1 text-xs text-slate-500">{t('features.accounts.repayment.totalDebt', { amount: fmt(cards.reduce((s, c) => s + c.debt, 0), fromCurrency, locale) })}</p>}
            </div>

            {/* 分配預覽（FR-006／007）／ 無卡提示（FR-009）／ 金額過小（FR-008a） */}
            {snapshotLoading && <p className="text-sm text-slate-500">…</p>}
            {!snapshotLoading && cards.length === 0 && (
              <p className="text-sm text-slate-500">{t('features.accounts.repayment.noLinkedCards')}</p>
            )}
            {!snapshotLoading && cards.length > 0 && preview && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t('features.accounts.repayment.allocationPreviewTitle')}</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-200 dark:border-slate-800">
                      <th className="py-1">{t('features.accounts.repayment.colCard')}</th>
                      <th className="py-1 text-right">{t('features.accounts.repayment.colAllocated')}</th>
                      <th className="py-1 text-right">{t('features.accounts.repayment.colBalanceAfter')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p) => (
                      <tr key={p.cardId} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1">
                          <div className="font-medium">{p.card.name}</div>
                          {p.balanceAfter > 0 && <span className="text-xs text-amber-600">{t('features.accounts.repayment.prepaidBadge')}</span>}
                        </td>
                        <td className="py-1 text-right">{fmt(p.amount, fromCurrency, locale)}</td>
                        <td className="py-1 text-right">{fmt(p.balanceAfter, fromCurrency, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!snapshotLoading && amountValid && tooSmall && cards.length > 0 && (
              <p className="text-red-500 text-sm">{t('features.accounts.messages.repaymentTotalAmountTooSmall', { min: cards.length })}</p>
            )}
            {snapshotError && <p className="text-red-500 text-sm">{snapshotError}</p>}
            {submitError && <p className="text-red-500 text-sm">{submitError}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={handleClose}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={!canSubmit}>{submitting ? t('common.saving') : t('features.accounts.repayment.confirm')}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
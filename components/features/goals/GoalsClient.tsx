'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HandCoins, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';
import { addMonthsClamped, buildAmortizationSchedule } from '@/lib/savingsGoal';

interface GoalView {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  startDate: string;
  accountId: string | null;
  categoryId: string | null;
  contributedAmount: number;
  remainingAmount: number;
  progressPercent: number;
  expectedAmount: number;
  shortfallAmount: number;
  behind: boolean;
  achieved: boolean;
  overdue: boolean;
  daysRemaining: number;
  requiredDailyAmount: number;
  projectedCompletionDate: string | null;
}

interface RepaymentPlanView {
  id: string;
  name: string;
  startDate: string;
  accountId: string | null;
  principal: number;
  annualRatePercent: number;
  periods: number;
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  paidPeriods: number;
  remainingPeriods: number;
  paidPrincipal: number;
  remainingBalance: number;
  paidInterest: number;
  remainingInterest: number;
  nextDueDate: string | null;
  nextPaymentAmount: number;
  finalDueDate: string;
  completed: boolean;
  progressPercent: number;
}

interface RepaymentPlanDetail extends RepaymentPlanView {
  schedule: {
    principal: number;
    periods: number;
    annualRatePercent: number;
    monthlyPayment: number;
    totalPayment: number;
    totalInterest: number;
    payments: Array<{ period: number; payment: number; principal: number; interest: number; remainingBalance: number }>;
  };
}

interface Option { id: string; name: string }

const EMPTY_GOAL_FORM = { name: '', targetAmount: '', targetDate: '', linkType: '', linkId: '' };
const EMPTY_PLAN_FORM = { name: '', principal: '', annualRatePercent: '0', periods: '12', startDate: '' };

function money(value: number, locale: string) {
  const rounded = Math.round(Number(value) || 0);
  return `NT$ ${rounded.toLocaleString(localeTag(locale))}`;
}

function monthLabel(date: string, locale: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!match) return date || '';
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

function dayLabel(date: string, locale: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!match) return date || '';
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

export default function GoalsClient() {
  const { t, locale } = useT();
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [plans, setPlans] = useState<RepaymentPlanView[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL_FORM);
  const [goalEditId, setGoalEditId] = useState<string | null>(null);
  const [goalError, setGoalError] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM);
  const [planEditId, setPlanEditId] = useState<string | null>(null);
  const [planError, setPlanError] = useState('');
  const [planSaving, setPlanSaving] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [detailPlan, setDetailPlan] = useState<RepaymentPlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [goalData, planData] = await Promise.all([
        apiGet('/api/goals'),
        apiGet('/api/repayment-plans'),
      ]);
      setGoals(Array.isArray(goalData) ? goalData : []);
      setPlans(Array.isArray(planData) ? planData : []);
    } catch (_) {
      /* 載入失敗時維持目前畫面，錯誤由各自的表單提示 */
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [accountData, categoryData] = await Promise.all([
          apiGet('/api/accounts'),
          apiGet('/api/categories'),
        ]);
        setAccounts((Array.isArray(accountData) ? accountData : []).map((a: any) => ({ id: a.id, name: a.name })));
        setCategories((Array.isArray(categoryData) ? categoryData : [])
          .filter((c: any) => c.type === 'expense')
          .map((c: any) => ({ id: c.id, name: c.name })));
      } catch (_) { /* 綁定選單為選填，取不到時仍可建立未綁定目標 */ }
    })();
  }, []);

  const accountName = useCallback((id: string | null) => {
    if (!id) return '';
    return accounts.find(account => account.id === id)?.name || '';
  }, [accounts]);

  const categoryName = useCallback((id: string | null) => {
    if (!id) return '';
    return categories.find(category => category.id === id)?.name || '';
  }, [categories]);

  const linkLabel = useCallback((accountId: string | null, categoryId: string | null) => {
    if (accountId) return t('features.goals.linkAccount', { name: accountName(accountId) });
    if (categoryId) return t('features.goals.linkCategory', { name: categoryName(categoryId) });
    return t('features.goals.linkNone');
  }, [accountName, categoryName, t]);

  // 攤還表預覽：與伺服器共用 lib/savingsGoal.ts，數值不可能分歧。
  const preview = useMemo(() => {
    const principal = Number(planForm.principal);
    const periods = Number(planForm.periods);
    const rate = Number(planForm.annualRatePercent || 0);
    if (!Number.isInteger(principal) || principal < 1) return null;
    if (!Number.isInteger(periods) || periods < 1 || periods > 600) return null;
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return null;
    try {
      return buildAmortizationSchedule({ principal, annualRatePercent: rate, periods });
    } catch (_) {
      return null;
    }
  }, [planForm.principal, planForm.periods, planForm.annualRatePercent]);

  const detailPlanName = detailPlan?.name || null;

  // 攤還表只在開啟對話框時才抓（清單端點刻意不回傳完整攤還表）。
  const openSchedule = useCallback(async (planId: string) => {
    setDetailLoading(true);
    try {
      setDetailPlan(await apiGet(`/api/repayment-plans/${planId}`));
    } catch (_) {
      setDetailPlan(null);
    }
    setDetailLoading(false);
  }, []);

  function openGoalDialog(goal?: GoalView) {
    setGoalError('');
    if (goal) {
      setGoalEditId(goal.id);
      setGoalForm({
        name: goal.name,
        targetAmount: String(goal.targetAmount),
        targetDate: goal.targetDate,
        linkType: goal.accountId ? 'account' : goal.categoryId ? 'category' : '',
        linkId: goal.accountId || goal.categoryId || '',
      });
    } else {
      setGoalEditId(null);
      setGoalForm({ ...EMPTY_GOAL_FORM, targetDate: addMonthsClamped(new Date().toISOString().slice(0, 10), 12) });
    }
    setGoalDialogOpen(true);
  }

  function openPlanDialog(plan?: RepaymentPlanView) {
    setPlanError('');
    if (plan) {
      setPlanEditId(plan.id);
      setPlanForm({
        name: plan.name,
        principal: String(plan.principal),
        annualRatePercent: String(plan.annualRatePercent),
        periods: String(plan.periods),
        startDate: plan.startDate,
      });
    } else {
      setPlanEditId(null);
      setPlanForm({ ...EMPTY_PLAN_FORM, startDate: new Date().toISOString().slice(0, 10) });
    }
    setPlanDialogOpen(true);
  }

  async function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    setGoalSaving(true);
    setGoalError('');
    try {
      const body = {
        name: goalForm.name,
        targetAmount: Number(goalForm.targetAmount),
        targetDate: goalForm.targetDate,
        accountId: goalForm.linkType === 'account' ? goalForm.linkId || null : null,
        categoryId: goalForm.linkType === 'category' ? goalForm.linkId || null : null,
      };
      if (goalEditId) await apiPut(`/api/goals/${goalEditId}`, body);
      else await apiPost('/api/goals', body);
      setGoalDialogOpen(false);
      await load();
    } catch (error: any) {
      setGoalError(error?.message || t('features.goals.saveError'));
    }
    setGoalSaving(false);
  }

  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    setPlanSaving(true);
    setPlanError('');
    try {
      const body = {
        name: planForm.name,
        principal: Number(planForm.principal),
        annualRatePercent: Number(planForm.annualRatePercent || 0),
        periods: Number(planForm.periods),
        startDate: planForm.startDate,
        accountId: null,
      };
      if (planEditId) await apiPut(`/api/repayment-plans/${planEditId}`, body);
      else await apiPost('/api/repayment-plans', body);
      setPlanDialogOpen(false);
      await load();
    } catch (error: any) {
      setPlanError(error?.message || t('features.goals.saveError'));
    }
    setPlanSaving(false);
  }

  async function removeGoal() {
    if (!deleteGoalId) return;
    try {
      await apiDelete(`/api/goals/${deleteGoalId}`);
      setDeleteGoalId(null);
      await load();
    } catch (_) { /* 保持對話框開啟，讓使用者重試 */ }
  }

  async function removePlan() {
    if (!deletePlanId) return;
    try {
      await apiDelete(`/api/repayment-plans/${deletePlanId}`);
      setDeletePlanId(null);
      await load();
    } catch (_) { /* 保持對話框開啟，讓使用者重試 */ }
  }

  const linkOptions = goalForm.linkType === 'category' ? categories : accounts;

  return (
    <div className="space-y-6">
      <section className="space-y-4" aria-labelledby="goals-savings-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="goals-savings-title" className="flex items-center gap-2 text-2xl font-bold">
            <Target size={24} aria-hidden="true" />{t('features.goals.savingsTitle')}
          </h2>
          <Button onClick={() => openGoalDialog()}>
            <Plus size={16} className="mr-2" aria-hidden="true" />{t('features.goals.addGoal')}
          </Button>
        </div>

        {loading ? (
          <p className="empty-hint py-10">{t('common.loading')}</p>
        ) : goals.length === 0 ? (
          <p className="empty-hint py-10">{t('features.goals.noGoals')}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {goals.map(goal => {
              const percent = Math.max(0, Math.min(100, goal.progressPercent));
              return (
                <li key={goal.id} className="rounded-2xl border p-4 shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-glass)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold" style={{ color: 'var(--text)' }}>{goal.name}</p>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('features.goals.targetDateLabel')}：{dayLabel(goal.targetDate, locale)}　·　{linkLabel(goal.accountId, goal.categoryId)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" aria-label={t('features.goals.editGoal')} onClick={() => openGoalDialog(goal)}><Pencil aria-hidden="true" /></Button>
                      <Button variant="ghost" size="icon" aria-label={t('features.goals.deleteGoal')} onClick={() => setDeleteGoalId(goal.id)}><Trash2 aria-hidden="true" /></Button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-sm">
                      <strong className="tabular-nums" style={{ color: 'var(--text)' }}>{money(goal.contributedAmount, locale)}</strong>
                      <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>/ {money(goal.targetAmount, locale)}</span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-hover)' }}
                      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}
                      aria-label={t('features.goals.progressLabel', { name: goal.name })}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${percent}%`, background: goal.achieved ? 'var(--income)' : goal.behind ? 'var(--expense)' : 'var(--primary)' }} />
                    </div>
                    <p className="mt-2 text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {t('features.goals.progressSummary', { percent: goal.progressPercent.toFixed(1), remaining: money(goal.remainingAmount, locale) })}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {goal.achieved ? (
                      <span className="rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--income-bg)', color: 'var(--income)' }}>{t('features.goals.badgeAchieved')}</span>
                    ) : goal.overdue ? (
                      <span className="rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--expense-bg)', color: 'var(--expense)' }}>{t('features.goals.badgeOverdue')}</span>
                    ) : goal.behind ? (
                      <span className="rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--expense-bg)', color: 'var(--expense)' }}>{t('features.goals.badgeBehind')}</span>
                    ) : (
                      <span className="rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--primary-light-bg)', color: 'var(--primary)' }}>{t('features.goals.badgeOnTrack')}</span>
                    )}
                    <span className="rounded-full px-2.5 py-1" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                      {t('features.goals.projectedDate', { date: goal.projectedCompletionDate ? dayLabel(goal.projectedCompletionDate, locale) : t('features.goals.projectedUnavailable') })}
                    </span>
                    {!goal.achieved && (
                      <span className="rounded-full px-2.5 py-1 tabular-nums" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                        {t('features.goals.requiredDaily', { amount: money(goal.requiredDailyAmount, locale) })}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="goals-repayment-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="goals-repayment-title" className="flex items-center gap-2 text-2xl font-bold">
            <HandCoins size={24} aria-hidden="true" />{t('features.goals.repaymentTitle')}
          </h2>
          <Button onClick={() => openPlanDialog()}>
            <Plus size={16} className="mr-2" aria-hidden="true" />{t('features.goals.addPlan')}
          </Button>
        </div>

        {loading ? (
          <p className="empty-hint py-10">{t('common.loading')}</p>
        ) : plans.length === 0 ? (
          <p className="empty-hint py-10">{t('features.goals.noPlans')}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {plans.map(plan => {
              const percent = Math.max(0, Math.min(100, plan.progressPercent));
              return (
                <li key={plan.id} className="rounded-2xl border p-4 shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-glass)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold" style={{ color: 'var(--text)' }}>{plan.name}</p>
                      <p className="mt-0.5 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {t('features.goals.planTerms', {
                          principal: money(plan.principal, locale),
                          rate: String(plan.annualRatePercent),
                          periods: String(plan.periods),
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" aria-label={t('features.goals.editPlan')} onClick={() => openPlanDialog(plan)}><Pencil aria-hidden="true" /></Button>
                      <Button variant="ghost" size="icon" aria-label={t('features.goals.deletePlan')} onClick={() => setDeletePlanId(plan.id)}><Trash2 aria-hidden="true" /></Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('features.goals.monthlyPayment')}</p>
                      <strong className="tabular-nums" style={{ color: 'var(--text)' }}>{money(plan.monthlyPayment, locale)}</strong>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('features.goals.remainingBalance')}</p>
                      <strong className="tabular-nums" style={{ color: 'var(--text)' }}>{money(plan.remainingBalance, locale)}</strong>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-hover)' }}
                      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}
                      aria-label={t('features.goals.planProgressLabel', { name: plan.name })}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${percent}%`, background: plan.completed ? 'var(--income)' : 'var(--primary)' }} />
                    </div>
                    <p className="mt-2 text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {t('features.goals.planProgressSummary', { paid: String(plan.paidPeriods), total: String(plan.periods) })}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {plan.completed ? (
                      <span className="rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--income-bg)', color: 'var(--income)' }}>{t('features.goals.badgeRepaid')}</span>
                    ) : (
                      <span className="rounded-full px-2.5 py-1 tabular-nums" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                        {t('features.goals.nextDue', { date: plan.nextDueDate ? dayLabel(plan.nextDueDate, locale) : '—', amount: money(plan.nextPaymentAmount, locale) })}
                      </span>
                    )}
                    <span className="rounded-full px-2.5 py-1 tabular-nums" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                      {t('features.goals.totalInterest', { amount: money(plan.totalInterest, locale) })}
                    </span>
                    <button type="button" className="rounded-full px-2.5 py-1 font-semibold underline" style={{ background: 'var(--primary-light-bg)', color: 'var(--primary)' }} onClick={() => openSchedule(plan.id)}>
                      {t('features.goals.viewSchedule')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 目標編輯對話框 */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader><DialogTitle>{goalEditId ? t('features.goals.editGoal') : t('features.goals.newGoal')}</DialogTitle></DialogHeader>
          <form onSubmit={saveGoal} className="space-y-1">
            <Input label={t('features.goals.goalNameLabel')} value={goalForm.name} maxLength={60}
              onChange={event => setGoalForm({ ...goalForm, name: event.target.value })} required />
            <Input label={t('features.goals.targetAmountLabel')} type="number" inputMode="numeric" min="1" step="1"
              value={goalForm.targetAmount} onChange={event => setGoalForm({ ...goalForm, targetAmount: event.target.value })} required />
            <Input label={t('features.goals.targetDateInputLabel')} type="date"
              value={goalForm.targetDate} onChange={event => setGoalForm({ ...goalForm, targetDate: event.target.value })} required />
            <Select label={t('features.goals.linkTypeLabel')} value={goalForm.linkType}
              onChange={event => setGoalForm({ ...goalForm, linkType: event.target.value, linkId: '' })}
              options={[
                { label: t('features.goals.linkNone'), value: '' },
                { label: t('features.goals.linkAccountOption'), value: 'account' },
                { label: t('features.goals.linkCategoryOption'), value: 'category' },
              ]} />
            {goalForm.linkType && (
              <Select label={goalForm.linkType === 'account' ? t('features.goals.accountLabel') : t('features.goals.categoryLabel')}
                value={goalForm.linkId}
                onChange={event => setGoalForm({ ...goalForm, linkId: event.target.value })}
                options={[
                  { label: t('features.goals.selectPlaceholder'), value: '' },
                  ...linkOptions.map(option => ({ label: option.name, value: option.id })),
                ]} />
            )}
            {goalError && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{goalError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setGoalDialogOpen(false)} disabled={goalSaving}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={goalSaving}>{goalSaving ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 還款計畫編輯對話框（含即時攤還試算） */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent closeLabel={t('common.close')} className="max-h-[min(90vh,44rem)] overflow-y-auto">
          <DialogHeader><DialogTitle>{planEditId ? t('features.goals.editPlan') : t('features.goals.newPlan')}</DialogTitle></DialogHeader>
          <form onSubmit={savePlan} className="space-y-1">
            <Input label={t('features.goals.planNameLabel')} value={planForm.name} maxLength={60}
              onChange={event => setPlanForm({ ...planForm, name: event.target.value })} required />
            <Input label={t('features.goals.principalLabel')} type="number" inputMode="numeric" min="1" step="1"
              value={planForm.principal} onChange={event => setPlanForm({ ...planForm, principal: event.target.value })} required />
            <Input label={t('features.goals.rateLabel')} type="number" inputMode="decimal" min="0" max="100" step="0.0001"
              value={planForm.annualRatePercent} onChange={event => setPlanForm({ ...planForm, annualRatePercent: event.target.value })} />
            <Input label={t('features.goals.periodsLabel')} type="number" inputMode="numeric" min="1" max="600" step="1"
              value={planForm.periods} onChange={event => setPlanForm({ ...planForm, periods: event.target.value })} required />
            <Input label={t('features.goals.startDateLabel')} type="date"
              value={planForm.startDate} onChange={event => setPlanForm({ ...planForm, startDate: event.target.value })} required />

            {preview && (
              <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{t('features.goals.previewTitle')}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 tabular-nums">
                  <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('features.goals.monthlyPayment')}</dt><dd style={{ color: 'var(--text)' }}>{money(preview.monthlyPayment, locale)}</dd></div>
                  <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('features.goals.totalPayment')}</dt><dd style={{ color: 'var(--text)' }}>{money(preview.totalPayment, locale)}</dd></div>
                  <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('features.goals.totalInterest')}</dt><dd style={{ color: 'var(--text)' }}>{money(preview.totalInterest, locale)}</dd></div>
                </dl>
              </div>
            )}
            {planError && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{planError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPlanDialogOpen(false)} disabled={planSaving}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={planSaving}>{planSaving ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 攤還表對話框 */}
      <Dialog open={detailPlanName !== null} onOpenChange={open => { if (!open) setDetailPlan(null); }}>
        <DialogContent closeLabel={t('common.close')} className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{detailPlanName ? t('features.goals.scheduleTitle', { name: detailPlanName }) : t('features.goals.scheduleTitleFallback')}</DialogTitle></DialogHeader>
          {detailLoading && <p className="empty-hint py-6">{t('common.loading')}</p>}
          {!detailLoading && detailPlan && (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('features.goals.monthlyPayment')}</dt><dd className="tabular-nums" style={{ color: 'var(--text)' }}>{money(detailPlan.monthlyPayment, locale)}</dd></div>
                <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('features.goals.totalPayment')}</dt><dd className="tabular-nums" style={{ color: 'var(--text)' }}>{money(detailPlan.totalPayment, locale)}</dd></div>
                <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('features.goals.totalInterest')}</dt><dd className="tabular-nums" style={{ color: 'var(--text)' }}>{money(detailPlan.totalInterest, locale)}</dd></div>
                <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('features.goals.finalDue')}</dt><dd style={{ color: 'var(--text)' }}>{dayLabel(detailPlan.finalDueDate, locale)}</dd></div>
              </dl>
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <caption className="sr-only">{t('features.goals.scheduleCaption', { name: detailPlan.name })}</caption>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th scope="col" className="px-2 py-1.5 text-start font-medium">{t('features.goals.tablePeriod')}</th>
                      <th scope="col" className="px-2 py-1.5 text-start font-medium">{t('features.goals.tableDueDate')}</th>
                      <th scope="col" className="px-2 py-1.5 text-end font-medium">{t('features.goals.tablePayment')}</th>
                      <th scope="col" className="px-2 py-1.5 text-end font-medium">{t('features.goals.tablePrincipal')}</th>
                      <th scope="col" className="px-2 py-1.5 text-end font-medium">{t('features.goals.tableInterest')}</th>
                      <th scope="col" className="px-2 py-1.5 text-end font-medium">{t('features.goals.tableBalance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailPlan.schedule.payments.map(row => (
                      <tr key={row.period} style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}>
                        <td className="px-2 py-1.5">{row.period}</td>
                        <td className="px-2 py-1.5">{monthLabel(addMonthsClamped(detailPlan.startDate, row.period - 1), locale)}</td>
                        <td className="px-2 py-1.5 text-end">{money(row.payment, locale)}</td>
                        <td className="px-2 py-1.5 text-end">{money(row.principal, locale)}</td>
                        <td className="px-2 py-1.5 text-end">{money(row.interest, locale)}</td>
                        <td className="px-2 py-1.5 text-end">{money(row.remainingBalance, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 刪除二次確認 */}
      <Dialog open={deleteGoalId !== null} onOpenChange={open => { if (!open) setDeleteGoalId(null); }}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader><DialogTitle>{t('features.goals.deleteGoal')}</DialogTitle></DialogHeader>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('features.goals.deleteGoalConfirm', { name: goals.find(goal => goal.id === deleteGoalId)?.name || '' })}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteGoalId(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={removeGoal}>{t('common.delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deletePlanId !== null} onOpenChange={open => { if (!open) setDeletePlanId(null); }}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader><DialogTitle>{t('features.goals.deletePlan')}</DialogTitle></DialogHeader>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('features.goals.deletePlanConfirm', { name: plans.find(plan => plan.id === deletePlanId)?.name || '' })}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletePlanId(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={removePlan}>{t('common.delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

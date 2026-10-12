'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/components/i18n/I18nProvider';
import { Plus, Edit3, Trash2, Tags as TagsIcon } from 'lucide-react';

interface TagItem { id: string; name: string; color: string; isActive: boolean; usageCount: number }
interface StatsResult {
  perTag: Array<{ tagId: string; expense: number; income: number; count: number }>;
  combined: { expense: number; income: number; count: number };
  crossAnalysis: Array<{ month: string; categoryId: string | null; expense: number; income: number; count: number }>;
}

const EMPTY_FORM = { name: '', color: '#94a3b8' };
const fmt = (n: number) => Math.round(n).toLocaleString();

export default function TagsClient() {
  const { t } = useT();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TagItem | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<'any' | 'all'>('any');
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setTags(await apiGet('/api/tags'));
      setLoadError('');
    } catch (e: any) {
      setLoadError(e?.message || t('features.tags.loadFailed'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { apiGet('/api/categories').then(setCategories).catch(() => {}); }, []);

  const tagMap = useMemo(() => new Map(tags.map((x) => [x.id, x])), [tags]);
  const catMap = useMemo(() => new Map(categories.map((c: any) => [c.id, c.name])), [categories]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(tag: TagItem) {
    setForm({ name: tag.name, color: tag.color });
    setEditId(tag.id);
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError(t('features.tags.nameRequired')); return; }
    setSaving(true);
    setFormError('');
    try {
      const body = { name: form.name.trim(), color: form.color };
      if (editId) await apiPut(`/api/tags/${editId}`, body);
      else await apiPost('/api/tags', body);
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    }
    setSaving(false);
  }

  async function toggleActive(tag: TagItem) {
    try {
      await apiPut(`/api/tags/${tag.id}`, { isActive: !tag.isActive });
      await load();
    } catch (err: any) {
      setLoadError(err.message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await apiDelete(`/api/tags/${deleteTarget.id}`);
      setSelected((s) => s.filter((id) => id !== deleteTarget.id));
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setDeleteError(err.message);
    }
  }

  async function runStats() {
    setStatsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      if (selected.length) { qs.set('tagIds', selected.join(',')); qs.set('tagMode', mode); }
      setStats(await apiGet(`/api/tags/stats?${qs.toString()}`));
    } catch (err: any) {
      setLoadError(err.message);
    }
    setStatsLoading(false);
  }

  function toggleSelected(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('features.tags.title')}</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('features.tags.subtitle')}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('features.tags.v1Note')}</p>
      </div>

      <Button onClick={openCreate}><Plus size={16} className="mr-2" /> {t('features.tags.add')}</Button>
      {loadError && <p className="text-red-500 text-sm" role="alert">{loadError}</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t('features.tags.edit') : t('features.tags.add')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input label={t('features.tags.name')} value={form.name} maxLength={30} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label={t('features.tags.color')} type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="h-10" />
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('features.tags.save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('features.tags.deleteTitle')}</DialogTitle></DialogHeader>
          {deleteTarget && (
            <p className="text-sm">{t('features.tags.deleteConfirm', { name: deleteTarget.name, count: deleteTarget.usageCount })}</p>
          )}
          {deleteError && <p className="text-red-500 text-sm">{deleteError}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>{t('common.delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="ui-skeleton h-12 rounded-xl" />)}
        </div>
      ) : tags.length === 0 ? (
        <div className="empty-state rounded-xl border border-dashed" style={{ borderColor: 'var(--border-strong)' }}>
          <div className="empty-state-icon"><TagsIcon size={22} aria-hidden="true" /></div>
          <p className="empty-state-title">{t('features.tags.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
              <span aria-hidden="true" className="inline-block w-3 h-3 rounded-full" style={{ background: tag.color }} />
              <span className={`font-medium ${tag.isActive ? '' : 'opacity-60'}`}>{tag.name}</span>
              {!tag.isActive && <span className="text-xs text-slate-500">{t('features.tags.disabled')}</span>}
              <span className="text-xs text-slate-500">{t('features.tags.usage', { count: tag.usageCount })}</span>
              <span className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => toggleActive(tag)}>
                {tag.isActive ? t('features.tags.disable') : t('features.tags.enable')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => openEdit(tag)} aria-label={t('features.tags.edit')}><Edit3 size={14} /></Button>
              <Button size="sm" variant="outline" onClick={() => { setDeleteError(''); setDeleteTarget(tag); }} aria-label={t('features.tags.deleteTitle')}><Trash2 size={14} /></Button>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">{t('features.tags.stats.title')}</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <Input label={t('features.tags.stats.dateFrom')} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label={t('features.tags.stats.dateTo')} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Button onClick={runStats} disabled={statsLoading}>{t('features.tags.stats.run')}</Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center" role="group" aria-label={t('features.tags.filterLabel')}>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selected.includes(tag.id)}
              onClick={() => toggleSelected(tag.id)}
              className="px-2 py-1 rounded-full text-xs border"
              style={{
                borderColor: tag.color,
                background: selected.includes(tag.id) ? tag.color : 'transparent',
                color: selected.includes(tag.id) ? '#fff' : undefined,
              }}
            >
              {tag.name}
            </button>
          ))}
          <select
            className="text-sm border rounded px-2 py-1 bg-transparent"
            value={mode}
            aria-label={t('features.tags.filterLabel')}
            onChange={(e) => setMode(e.target.value === 'all' ? 'all' : 'any')}
          >
            <option value="any">{t('features.tags.modeAny')}</option>
            <option value="all">{t('features.tags.modeAll')}</option>
          </select>
        </div>

        {stats && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('features.tags.stats.note')}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>{t('features.tags.stats.perTag')}</th>
                  <th>{t('features.tags.stats.expense')}</th>
                  <th>{t('features.tags.stats.income')}</th>
                  <th>{t('features.tags.stats.count')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.perTag.map((r) => (
                  <tr key={r.tagId}>
                    <td>{tagMap.get(r.tagId)?.name || r.tagId}</td>
                    <td>{fmt(r.expense)}</td>
                    <td>{fmt(r.income)}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
                <tr className="font-semibold border-t">
                  <td>{t('features.tags.stats.combined')}</td>
                  <td>{fmt(stats.combined.expense)}</td>
                  <td>{fmt(stats.combined.income)}</td>
                  <td>{stats.combined.count}</td>
                </tr>
              </tbody>
            </table>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>{t('features.tags.stats.month')}</th>
                  <th>{t('features.tags.stats.category')}</th>
                  <th>{t('features.tags.stats.expense')}</th>
                  <th>{t('features.tags.stats.income')}</th>
                  <th>{t('features.tags.stats.count')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.crossAnalysis.map((r) => (
                  <tr key={`${r.month}|${r.categoryId ?? ''}`}>
                    <td>{r.month}</td>
                    <td>{(r.categoryId && catMap.get(r.categoryId)) || t('features.common.uncategorized')}</td>
                    <td>{fmt(r.expense)}</td>
                    <td>{fmt(r.income)}</td>
                    <td>{r.count}</td>
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost, apiPatch, apiDelete } from '@/lib/clientApi';
import StocksTabNav from './StocksTabNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit3, Trash2, Pause, Play } from 'lucide-react';

const FREQ_LABELS: Record<string, string> = { daily: '每日', weekly: '每週', monthly: '每月', yearly: '每年' };
const DEFAULT_SETTINGS = {
  feeRate: 0.001425,
  feeDiscount: 0.6,
  feeMinLot: 20,
  feeMinOdd: 1,
  sellTaxRateStock: 0.003,
  sellTaxRateEtf: 0.001,
  sellTaxRateWarrant: 0.001,
  sellTaxMin: 1,
};
const EMPTY_REC_FORM = { stockId: '', amount: '', frequency: 'monthly', startDate: '', accountId: '', note: '' };

function fmt(n: number | string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

export default function StockSettingsClient(_props: { user?: any } = {}) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [stocks, setStocks] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [recForm, setRecForm] = useState(EMPTY_REC_FORM);
  const [recEditId, setRecEditId] = useState<string | null>(null);
  const [recSaving, setRecSaving] = useState(false);
  const [recFormError, setRecFormError] = useState('');
  const [stockStatusMsg, setStockStatusMsg] = useState('');
  const [recDialogOpen, setRecDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, stockResp, accts, recList] = await Promise.all([
        apiGet('/api/stock-settings').catch(() => DEFAULT_SETTINGS),
        apiGet('/api/stocks').catch(() => []),
        apiGet('/api/accounts').catch(() => []),
        apiGet('/api/stock-recurring').catch(() => []),
      ]);
      setSettings({ ...DEFAULT_SETTINGS, ...(s || {}) });
      const stockList = Array.isArray(stockResp) ? stockResp : (stockResp?.stocks || []);
      setStocks(stockList);
      setAccounts(accts);
      setRecs(recList || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      await apiPut('/api/stock-settings', {
        feeRate: Number(settings.feeRate),
        feeDiscount: Number(settings.feeDiscount),
        feeMinLot: Number(settings.feeMinLot),
        feeMinOdd: Number(settings.feeMinOdd),
        sellTaxRateStock: Number(settings.sellTaxRateStock),
        sellTaxRateEtf: Number(settings.sellTaxRateEtf),
        sellTaxRateWarrant: Number(settings.sellTaxRateWarrant),
        sellTaxMin: Number(settings.sellTaxMin),
      });
      setSaveMsg('設定已儲存');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (e: any) { setSaveMsg(`儲存失敗：${e.message}`); }
    setSaving(false);
  }

  async function handleRecSave(e: React.FormEvent) {
    e.preventDefault();
    if (!recForm.stockId) { setRecFormError('請選擇股票'); return; }
    if (!recForm.amount || Number(recForm.amount) <= 0) { setRecFormError('請輸入有效金額'); return; }
    setRecSaving(true);
    setRecFormError('');
    const body = {
      stockId: recForm.stockId,
      amount: Number(recForm.amount),
      frequency: recForm.frequency,
      startDate: recForm.startDate,
      accountId: recForm.accountId || null,
      note: recForm.note,
    };
    try {
      if (recEditId) { await apiPut(`/api/stock-recurring/${recEditId}`, body); }
      else { await apiPost('/api/stock-recurring', body); }
      const recList = await apiGet('/api/stock-recurring').catch(() => []);
      setRecs(recList || []);
      setRecDialogOpen(false);
    } catch (e: any) { setRecFormError(e.message); }
    setRecSaving(false);
  }

  function openRecCreate() {
    setRecForm({ ...EMPTY_REC_FORM, startDate: new Date().toISOString().slice(0, 10), stockId: stocks[0]?.id || '' });
    setRecEditId(null);
    setRecFormError('');
    setRecDialogOpen(true);
  }

  function openRecEdit(rec: any) {
    setRecForm({
      stockId: rec.stockId || rec.stock_id,
      amount: rec.amount,
      frequency: rec.frequency,
      startDate: rec.startDate || rec.start_date,
      accountId: rec.accountId || rec.account_id || '',
      note: rec.note || '',
    });
    setRecEditId(rec.id);
    setRecFormError('');
    setRecDialogOpen(true);
  }

  async function handleToggleRec(id: string, enabled: boolean) {
    try {
      await apiPatch(`/api/stock-recurring/${id}/toggle`);
      const recList = await apiGet('/api/stock-recurring').catch(() => []);
      setRecs(recList || []);
    } catch (e: any) { alert(e.message); }
  }

  async function handleDeleteRec(id: string) {
    if (!confirm('確定要刪除此定期定額設定嗎？')) return;
    try {
      await apiDelete(`/api/stock-recurring/${id}`);
      const recList = await apiGet('/api/stock-recurring').catch(() => []);
      setRecs(recList || []);
    } catch (e: any) { alert(e.message); }
  }

  async function handleToggleDelisted(stock: any) {
    setStockStatusMsg('');
    try {
      await apiPost('/api/stocks/batch-price', {
        updates: [{ stockId: stock.id, currentPrice: stock.currentPrice || 0, delisted: !stock.delisted }],
      });
      setStockStatusMsg(`${stock.symbol} 已${stock.delisted ? '恢復為正常追蹤' : '標記為下市'}`);
      await load();
    } catch (e: any) {
      setStockStatusMsg(e.message || '更新下市狀態失敗');
    }
  }

  if (loading) return <div className="p-8 text-slate-500">載入中...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">交易設定</h2>
      <StocksTabNav />

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">手續費 / 交易稅設定</h3>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="手續費率" type="number" step="0.000001" value={settings.feeRate} onChange={e => setSettings(s => ({ ...s, feeRate: Number(e.target.value) }))} />
          <Input label="折扣 (0~1)" type="number" step="0.01" value={settings.feeDiscount} onChange={e => setSettings(s => ({ ...s, feeDiscount: Number(e.target.value) }))} />
          <Input label="最低手續費（整股）" type="number" value={settings.feeMinLot} onChange={e => setSettings(s => ({ ...s, feeMinLot: Number(e.target.value) }))} />
          <Input label="最低手續費（零股）" type="number" value={settings.feeMinOdd} onChange={e => setSettings(s => ({ ...s, feeMinOdd: Number(e.target.value) }))} />
          <Input label="賣出稅率（股票）" type="number" step="0.0001" value={settings.sellTaxRateStock} onChange={e => setSettings(s => ({ ...s, sellTaxRateStock: Number(e.target.value) }))} />
          <Input label="賣出稅率（ETF）" type="number" step="0.0001" value={settings.sellTaxRateEtf} onChange={e => setSettings(s => ({ ...s, sellTaxRateEtf: Number(e.target.value) }))} />
          <Input label="賣出稅率（權證）" type="number" step="0.0001" value={settings.sellTaxRateWarrant} onChange={e => setSettings(s => ({ ...s, sellTaxRateWarrant: Number(e.target.value) }))} />
          <Input label="最低交易稅" type="number" value={settings.sellTaxMin} onChange={e => setSettings(s => ({ ...s, sellTaxMin: Number(e.target.value) }))} />
          <div className="col-span-full">
            {saveMsg && <p className={`text-sm mb-2 ${saveMsg.includes('失敗') ? 'text-red-500' : 'text-green-600'}`}>{saveMsg}</p>}
            <Button type="submit" disabled={saving}>{saving ? '儲存中...' : '儲存設定'}</Button>
          </div>
        </form>
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">股票狀態管理</h3>
          {stockStatusMsg && <span className="text-sm text-slate-600">{stockStatusMsg}</span>}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>股票</TableHead>
              <TableHead>目前價格</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocks.map((stock) => (
              <TableRow key={stock.id}>
                <TableCell>{stock.symbol} {stock.name}</TableCell>
                <TableCell>{fmt(stock.currentPrice || stock.current_price || 0)}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${stock.delisted ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                    {stock.delisted ? '已下市' : '正常追蹤'}
                  </span>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleToggleDelisted(stock)}>
                    {stock.delisted ? '恢復追蹤' : '標記下市'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">股票定期定額</h3>
          <Dialog open={recDialogOpen} onOpenChange={setRecDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openRecCreate}><Plus size={16} className="mr-2" /> 新增</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{recEditId ? '編輯定期定額' : '新增定期定額'}</DialogTitle></DialogHeader>
              <form onSubmit={handleRecSave} className="space-y-4">
                <Select label="股票 *" options={stocks.map(s => ({ label: `${s.symbol} ${s.name}`, value: s.id }))} value={recForm.stockId} onChange={e => setRecForm(f => ({ ...f, stockId: e.target.value }))} />
                <Input label="金額 (NT$) *" type="number" value={recForm.amount} onChange={e => setRecForm(f => ({ ...f, amount: e.target.value }))} />
                <Select label="頻率" options={Object.entries(FREQ_LABELS).map(([v, l]) => ({ label: l, value: v }))} value={recForm.frequency} onChange={e => setRecForm(f => ({ ...f, frequency: e.target.value }))} />
                <Input label="起始日期" type="date" value={recForm.startDate} onChange={e => setRecForm(f => ({ ...f, startDate: e.target.value }))} />
                <Select label="帳戶" options={accounts.map(a => ({ label: a.name, value: a.id }))} value={recForm.accountId} onChange={e => setRecForm(f => ({ ...f, accountId: e.target.value }))} />
                <Input label="備註" value={recForm.note} onChange={e => setRecForm(f => ({ ...f, note: e.target.value }))} />
                {recFormError && <p className="text-red-500 text-sm">{recFormError}</p>}
                <div className="flex gap-2">
                  <DialogClose asChild><Button type="button" variant="outline">取消</Button></DialogClose>
                  <Button type="submit" disabled={recSaving}>儲存</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>股票</TableHead><TableHead>金額</TableHead><TableHead>頻率</TableHead><TableHead>上次產生</TableHead><TableHead>狀態</TableHead><TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recs.map(r => {
              const stockInfo = stocks.find(s => s.id === (r.stockId || r.stock_id));
              return (
                <TableRow key={r.id}>
                  <TableCell>{stockInfo ? `${stockInfo.symbol} ${stockInfo.name}` : (r.symbol || '—')}</TableCell>
                  <TableCell>{fmt(r.amount)}</TableCell>
                  <TableCell>{FREQ_LABELS[r.frequency] || r.frequency}</TableCell>
                  <TableCell>{r.lastGenerated || r.last_generated || '—'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${r.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {r.isActive ? '啟用中' : '已停用'}
                    </span>
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleToggleRec(r.id, r.isActive)}>{r.isActive ? <Pause size={16} /> : <Play size={16} />}</Button>
                    <Button variant="ghost" size="icon" onClick={() => openRecEdit(r)}><Edit3 size={16} /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteRec(r.id)}><Trash2 size={16} /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

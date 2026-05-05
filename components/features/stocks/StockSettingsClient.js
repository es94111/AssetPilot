'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost, apiPatch, apiDelete } from '../../../lib/clientApi';
import StocksTabNav from './StocksTabNav';

const FREQ_LABELS = { daily: '每日', weekly: '每週', monthly: '每月', yearly: '每年' };

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

function today() { return new Date().toISOString().slice(0, 10); }
function fmt(n) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

export default function StockSettingsClient() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [stocks, setStocks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [recs, setRecs] = useState([]);
  const [recModal, setRecModal] = useState(false);
  const [recForm, setRecForm] = useState(EMPTY_REC_FORM);
  const [recEditId, setRecEditId] = useState(null);
  const [recSaving, setRecSaving] = useState(false);
  const [recFormError, setRecFormError] = useState('');
  const [recDeleteId, setRecDeleteId] = useState(null);

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

  function setF(key, val) { setSettings(s => ({ ...s, [key]: val })); }

  async function handleSave(e) {
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
    } catch (e) { setSaveMsg(`儲存失敗：${e.message}`); }
    setSaving(false);
  }

  function openAddRec() {
    setRecForm({ ...EMPTY_REC_FORM, startDate: today(), stockId: stocks[0]?.id || '' });
    setRecEditId(null);
    setRecFormError('');
    setRecModal(true);
  }

  function openEditRec(r) {
    setRecForm({
      stockId: r.stockId || r.stock_id || '',
      amount: r.amount ?? '',
      frequency: r.frequency || 'monthly',
      startDate: r.startDate || r.start_date || today(),
      accountId: r.accountId || r.account_id || '',
      note: r.note || '',
    });
    setRecEditId(r.id);
    setRecFormError('');
    setRecModal(true);
  }

  async function handleRecSave(e) {
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
      setRecModal(false);
      const recList = await apiGet('/api/stock-recurring').catch(() => []);
      setRecs(recList || []);
    } catch (e) { setRecFormError(e.message); }
    setRecSaving(false);
  }

  async function handleRecDelete() {
    if (!recDeleteId) return;
    try {
      await apiDelete(`/api/stock-recurring/${recDeleteId}`);
      setRecDeleteId(null);
      const recList = await apiGet('/api/stock-recurring').catch(() => []);
      setRecs(recList || []);
    } catch (e) { alert(e.message); }
  }

  async function handleToggleRec(id) {
    try {
      await apiPatch(`/api/stock-recurring/${id}/toggle`);
      const recList = await apiGet('/api/stock-recurring').catch(() => []);
      setRecs(recList || []);
    } catch (e) { alert(e.message); }
  }

  if (loading) return <div className="page active"><p className="empty-hint">載入中...</p></div>;

  return (
    <div className="page active">
      <h2 className="page-title">交易設定</h2>
      <StocksTabNav />

      {/* 費率設定 */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>手續費 / 交易稅設定</h3>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <label>手續費率</label>
            <input type="number" min="0" max="1" step="0.000001" value={settings.feeRate} onChange={e => setF('feeRate', e.target.value)} />
          </div>
          <div className="form-row">
            <label>折扣（0~1）</label>
            <input type="number" min="0" max="1" step="0.01" value={settings.feeDiscount} onChange={e => setF('feeDiscount', e.target.value)} />
          </div>
          <div className="form-row">
            <label>最低手續費（整股）</label>
            <input type="number" min="0" step="1" value={settings.feeMinLot} onChange={e => setF('feeMinLot', e.target.value)} />
          </div>
          <div className="form-row">
            <label>最低手續費（零股）</label>
            <input type="number" min="0" step="1" value={settings.feeMinOdd} onChange={e => setF('feeMinOdd', e.target.value)} />
          </div>
          <div className="form-row">
            <label>賣出稅率（股票）</label>
            <input type="number" min="0" max="1" step="0.0001" value={settings.sellTaxRateStock} onChange={e => setF('sellTaxRateStock', e.target.value)} />
          </div>
          <div className="form-row">
            <label>賣出稅率（ETF）</label>
            <input type="number" min="0" max="1" step="0.0001" value={settings.sellTaxRateEtf} onChange={e => setF('sellTaxRateEtf', e.target.value)} />
          </div>
          <div className="form-row">
            <label>賣出稅率（權證）</label>
            <input type="number" min="0" max="1" step="0.0001" value={settings.sellTaxRateWarrant} onChange={e => setF('sellTaxRateWarrant', e.target.value)} />
          </div>
          <div className="form-row">
            <label>最低交易稅</label>
            <input type="number" min="0" step="1" value={settings.sellTaxMin} onChange={e => setF('sellTaxMin', e.target.value)} />
          </div>
          {saveMsg && <p style={{ color: saveMsg.startsWith('儲存失敗') ? 'var(--danger)' : 'var(--success)', margin: '0.5rem 0' }}>{saveMsg}</p>}
          <div className="modal-footer" style={{ paddingTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '儲存中...' : '儲存設定'}</button>
          </div>
        </form>
      </div>

      {/* 股票定期定額 */}
      <div className="card">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h3>股票定期定額</h3>
          <button className="btn btn-sm" onClick={openAddRec}><i className="fas fa-plus" /> 新增</button>
        </div>

        {recs.length === 0 && <p className="empty-hint">尚未設定股票定期定額</p>}

        {recs.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>股票</th><th>金額</th><th>頻率</th><th>起始日</th><th>上次產生</th><th>狀態</th><th>備註</th><th>操作</th></tr>
              </thead>
              <tbody>
                {recs.map(r => {
                  const stockInfo = stocks.find(s => s.id === (r.stockId || r.stock_id));
                  const statusText = r.isActive ? '啟用中' : '已停用';
                  return (
                    <tr key={r.id}>
                      <td>{stockInfo ? `${stockInfo.symbol} ${stockInfo.name}` : (r.symbol || '—')}</td>
                      <td>{fmt(r.amount)}</td>
                      <td>{FREQ_LABELS[r.frequency] || r.frequency}</td>
                      <td>{r.startDate || r.start_date || '—'}</td>
                      <td>{r.lastGenerated || r.last_generated || '—'}</td>
                      <td><span className={`recurring-status ${r.isActive ? 'active' : 'paused'}`}>{statusText}</span></td>
                      <td>{r.note || '—'}</td>
                      <td>
                        <button className="btn-icon" title={r.isActive ? '停用' : '啟用'} onClick={() => handleToggleRec(r.id)}>
                          <i className={`fas ${r.isActive ? 'fa-pause' : 'fa-play'}`} />
                        </button>
                        <button className="btn-icon" title="編輯" onClick={() => openEditRec(r)}><i className="fas fa-pen" /></button>
                        <button className="btn-icon danger" title="刪除" onClick={() => setRecDeleteId(r.id)}><i className="fas fa-trash" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Recurring Modal */}
      {recModal && (
        <div className="modal-backdrop" onClick={() => setRecModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{recEditId ? '編輯股票定期定額' : '新增股票定期定額'}</h3>
              <button className="btn-icon" onClick={() => setRecModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <form onSubmit={handleRecSave} className="modal-body">
              <div className="form-row">
                <label>股票 *</label>
                <select value={recForm.stockId} onChange={e => setRecForm(f => ({ ...f, stockId: e.target.value }))}>
                  <option value="">請選擇股票</option>
                  {stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} {s.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>金額 (NT$) *</label>
                <input type="number" required min="1" step="1" value={recForm.amount} onChange={e => setRecForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-row">
                <label>頻率</label>
                <select value={recForm.frequency} onChange={e => setRecForm(f => ({ ...f, frequency: e.target.value }))}>
                  <option value="daily">每日</option>
                  <option value="weekly">每週</option>
                  <option value="monthly">每月</option>
                  <option value="yearly">每年</option>
                </select>
              </div>
              <div className="form-row">
                <label>起始日期</label>
                <input type="date" value={recForm.startDate} onChange={e => setRecForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>帳戶</label>
                <select value={recForm.accountId} onChange={e => setRecForm(f => ({ ...f, accountId: e.target.value }))}>
                  <option value="">不指定</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>備註</label>
                <input type="text" maxLength={200} value={recForm.note} onChange={e => setRecForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              {recFormError && <div className="auth-error">{recFormError}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setRecModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary" disabled={recSaving}>{recSaving ? '儲存中...' : '儲存'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {recDeleteId && (
        <div className="modal-backdrop" onClick={() => setRecDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>確認刪除</h3><button className="btn-icon" onClick={() => setRecDeleteId(null)}><i className="fas fa-xmark" /></button></div>
            <div className="modal-body">
              <p>確定要刪除此定期定額設定嗎？</p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setRecDeleteId(null)}>取消</button>
                <button className="btn btn-danger" onClick={handleRecDelete}>確認刪除</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

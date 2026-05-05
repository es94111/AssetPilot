'use client';

import { useState } from 'react';

function today() { return new Date().toISOString().slice(0, 10); }

async function downloadServerFile(url, fallbackName) {
  const resp = await fetch(url, { credentials: 'include' });
  if (!resp.ok) {
    let msg = '匯出失敗';
    try { const j = await resp.json(); msg = j.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  let filename = fallbackName;
  const cd = resp.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename="?([^";]+)"?/);
  if (m) filename = m[1];
  const blob = await resp.blob();
  const url2 = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url2; a.download = filename; a.click();
  URL.revokeObjectURL(url2);
}

export default function DataTransferClient() {
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  const [importFile, setImportFile] = useState(null);
  const [importType, setImportType] = useState('transactions');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  async function handleExportTx() {
    setExportLoading(true);
    setExportMsg('');
    try {
      const params = new URLSearchParams();
      if (exportFrom) params.set('dateFrom', exportFrom);
      if (exportTo) params.set('dateTo', exportTo);
      const qs = params.toString();
      await downloadServerFile(`/api/transactions/export${qs ? '?' + qs : ''}`, `transactions_${today()}.csv`);
      setExportMsg('已匯出交易紀錄 CSV');
    } catch (e) { setExportMsg('匯出失敗：' + e.message); }
    setExportLoading(false);
  }

  async function handleExportCategories() {
    setExportLoading(true);
    setExportMsg('');
    try {
      await downloadServerFile('/api/categories/export', `categories_${today()}.csv`);
      setExportMsg('已匯出分類 CSV');
    } catch (e) { setExportMsg('匯出失敗：' + e.message); }
    setExportLoading(false);
  }

  async function handleExportStockTx() {
    setExportLoading(true);
    setExportMsg('');
    try {
      await downloadServerFile('/api/stock-transactions/export', `stock_transactions_${today()}.csv`);
      setExportMsg('已匯出股票交易 CSV');
    } catch (e) { setExportMsg('匯出失敗：' + e.message); }
    setExportLoading(false);
  }

  async function handleExportStockDiv() {
    setExportLoading(true);
    setExportMsg('');
    try {
      await downloadServerFile('/api/stock-dividends/export', `stock_dividends_${today()}.csv`);
      setExportMsg('已匯出股利 CSV');
    } catch (e) { setExportMsg('匯出失敗：' + e.message); }
    setExportLoading(false);
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!importFile) { setImportMsg('請選擇檔案'); return; }
    setImporting(true);
    setImportMsg('');
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      let url;
      if (importType === 'transactions') url = '/api/transactions/import';
      else if (importType === 'categories') url = '/api/categories/import';
      else if (importType === 'stock-tx') url = '/api/stock-transactions/import';
      else if (importType === 'stock-div') url = '/api/stock-dividends/import';
      const resp = await fetch(url, { method: 'POST', credentials: 'include', body: formData });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setImportMsg(`匯入完成：新增 ${data.created || 0} 筆，跳過 ${data.skipped || 0} 筆`);
      setImportFile(null);
    } catch (e) { setImportMsg('匯入失敗：' + e.message); }
    setImporting(false);
  }

  async function handleDbBackup() {
    setExportLoading(true);
    setExportMsg('');
    try {
      await downloadServerFile('/api/database/export', `assetpilot-backup-${today()}.db`);
      setExportMsg('已下載資料庫備份');
    } catch (e) { setExportMsg('備份失敗：' + e.message); }
    setExportLoading(false);
  }

  return (
    <div className="page active">
      <h2 className="page-title">資料匯出 / 匯入</h2>

      {/* Export section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>資料匯出</h3>

        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>交易紀錄</h4>
          <div className="filter-bar" style={{ marginBottom: '0.75rem' }}>
            <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} title="起始日期" />
            <span>~</span>
            <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} title="結束日期" />
          </div>
          <button className="btn" onClick={handleExportTx} disabled={exportLoading}>
            <i className="fas fa-download" /> 匯出交易 CSV
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button className="btn btn-outline" onClick={handleExportCategories} disabled={exportLoading}>
            <i className="fas fa-download" /> 匯出分類 CSV
          </button>
          <button className="btn btn-outline" onClick={handleExportStockTx} disabled={exportLoading}>
            <i className="fas fa-download" /> 匯出股票交易 CSV
          </button>
          <button className="btn btn-outline" onClick={handleExportStockDiv} disabled={exportLoading}>
            <i className="fas fa-download" /> 匯出股利 CSV
          </button>
          <button className="btn btn-outline" onClick={handleDbBackup} disabled={exportLoading}>
            <i className="fas fa-database" /> 下載資料庫備份
          </button>
        </div>

        {exportMsg && (
          <p style={{ color: exportMsg.includes('失敗') ? 'var(--danger)' : 'var(--success)', margin: '0.5rem 0' }}>
            {exportMsg}
          </p>
        )}
      </div>

      {/* Import section */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>資料匯入</h3>
        <form onSubmit={handleImport}>
          <div className="form-row">
            <label>匯入類型</label>
            <select value={importType} onChange={e => setImportType(e.target.value)}>
              <option value="transactions">交易紀錄（CSV）</option>
              <option value="categories">分類（CSV）</option>
              <option value="stock-tx">股票交易（CSV）</option>
              <option value="stock-div">股利紀錄（CSV）</option>
            </select>
          </div>
          <div className="form-row">
            <label>選擇檔案</label>
            <input
              type="file"
              accept=".csv"
              onChange={e => setImportFile(e.target.files[0] || null)}
            />
          </div>
          {importMsg && (
            <p style={{ color: importMsg.includes('失敗') ? 'var(--danger)' : 'var(--success)', margin: '0.5rem 0' }}>
              {importMsg}
            </p>
          )}
          <div className="modal-footer" style={{ paddingTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={importing || !importFile}>
              {importing ? '匯入中...' : '開始匯入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

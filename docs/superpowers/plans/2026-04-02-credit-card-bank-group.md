# 信用卡銀行分組與一鍵還款 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 信用卡帳戶可連結所屬銀行帳戶進行分組，並支援逐張設定金額的一鍵還款功能。

**Architecture:** 在 `accounts` 資料表新增 `linked_bank_id` 欄位，後端新增還款批次 API，前端在帳戶管理頁依銀行子分組顯示信用卡，並新增還款 Modal。

**Tech Stack:** Node.js + Express, SQLite (sql.js), 原生 HTML/CSS/JavaScript SPA

---

## 受影響檔案

| 檔案 | 變更說明 |
|------|---------|
| `server.js` | DB migration、CRUD API 更新、新增還款端點 |
| `index.html` | `modalAccount` 新增銀行連結欄位、新增 `modalCreditRepayment` |
| `app.js` | `onAccTypeChange`、`openAccountModal`、`renderAccounts`、新增還款 Modal 邏輯 |
| `style.css` | 銀行子群組 header、還款 Modal 表格樣式 |
| `changelog.json` | 版本更新至 4.1 |

---

## Task 1: DB Migration — 新增 `linked_bank_id` 欄位

**Files:**
- Modify: `server.js:494`

- [ ] **Step 1: 在現有 accounts 升級區塊的最後加入 migration**

在 `server.js` 第 494 行後（`try { db.run("ALTER TABLE accounts ADD COLUMN exclude_from_total...` 這行之後），加入：

```javascript
  try { db.run("ALTER TABLE accounts ADD COLUMN linked_bank_id TEXT DEFAULT NULL"); } catch (e) { /* ignore */ }
```

- [ ] **Step 2: 啟動伺服器確認無錯誤**

```bash
node server.js
```
預期：伺服器正常啟動，`database.db` 升級成功。

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add linked_bank_id column to accounts table"
```

---

## Task 2: 更新 Account CRUD API

**Files:**
- Modify: `server.js:2405-2470`

- [ ] **Step 1: 更新 `GET /api/accounts` 的回傳，加入 `linkedBankId`**

找到 `server.js` 第 2410 行的 `return {` 區塊，將：
```javascript
    return {
      ...a,
      icon: normalizeAccountIcon(a.icon),
      initialBalance: a.initial_balance,
      currency: accountCurrency,
      balance,
    };
```
替換為：
```javascript
    return {
      ...a,
      icon: normalizeAccountIcon(a.icon),
      initialBalance: a.initial_balance,
      currency: accountCurrency,
      balance,
      linkedBankId: a.linked_bank_id || null,
    };
```

- [ ] **Step 2: 更新 `POST /api/accounts` 接受並儲存 `linkedBankId`**

找到 `server.js` 第 2435 行的 `app.post('/api/accounts', ...)` 全段，替換為：

```javascript
app.post('/api/accounts', (req, res) => {
  const { name, initialBalance, icon, accountType, excludeFromTotal, linkedBankId } = req.body;
  const currency = normalizeCurrency(req.body.currency);
  const safeIcon = normalizeAccountIcon(icon);
  const VALID_TYPES = ['銀行', '信用卡', '現金', '虛擬錢包'];
  const safeType = VALID_TYPES.includes(accountType) ? accountType : '現金';
  const safeExclude = excludeFromTotal ? 1 : 0;
  let safeLinkedBankId = null;
  if (safeType === '信用卡' && linkedBankId) {
    const bankAcc = queryOne("SELECT id FROM accounts WHERE id = ? AND user_id = ? AND account_type = '銀行'", [linkedBankId, req.userId]);
    if (!bankAcc) return res.status(400).json({ error: '指定的銀行帳戶不存在' });
    safeLinkedBankId = linkedBankId;
  }
  const id = uid();
  db.run("INSERT INTO accounts (id, user_id, name, initial_balance, icon, currency, account_type, exclude_from_total, linked_bank_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [id, req.userId, name, initialBalance || 0, safeIcon, currency, safeType, safeExclude, safeLinkedBankId, todayStr()]);
  saveDB();
  res.json({ id });
});
```

- [ ] **Step 3: 更新 `PUT /api/accounts/:id` 接受並儲存 `linkedBankId`**

找到 `server.js` 第 2449 行的 `app.put('/api/accounts/:id', ...)` 全段，替換為：

```javascript
app.put('/api/accounts/:id', (req, res) => {
  const { name, initialBalance, icon, accountType, excludeFromTotal, linkedBankId } = req.body;
  const currency = normalizeCurrency(req.body.currency);
  const safeIcon = normalizeAccountIcon(icon);
  const VALID_TYPES = ['銀行', '信用卡', '現金', '虛擬錢包'];
  const safeType = VALID_TYPES.includes(accountType) ? accountType : '現金';
  const safeExclude = excludeFromTotal ? 1 : 0;
  let safeLinkedBankId = null;
  if (safeType === '信用卡' && linkedBankId) {
    const bankAcc = queryOne("SELECT id FROM accounts WHERE id = ? AND user_id = ? AND account_type = '銀行'", [linkedBankId, req.userId]);
    if (!bankAcc) return res.status(400).json({ error: '指定的銀行帳戶不存在' });
    safeLinkedBankId = linkedBankId;
  }
  db.run("UPDATE accounts SET name = ?, initial_balance = ?, icon = ?, currency = ?, account_type = ?, exclude_from_total = ?, linked_bank_id = ? WHERE id = ? AND user_id = ?",
    [name, initialBalance || 0, safeIcon, currency, safeType, safeExclude, safeLinkedBankId, req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});
```

- [ ] **Step 4: 更新 `DELETE /api/accounts/:id`，刪除銀行帳戶時清除旗下信用卡的 `linked_bank_id`**

找到 `server.js` 第 2462 行的 `app.delete('/api/accounts/:id', ...)` 全段，替換為：

```javascript
app.delete('/api/accounts/:id', (req, res) => {
  const count = queryOne("SELECT COUNT(*) as cnt FROM accounts WHERE user_id = ?", [req.userId])?.cnt || 0;
  if (count <= 1) return res.status(400).json({ error: '至少需保留一個帳戶' });
  const hasTx = queryOne("SELECT id FROM transactions WHERE account_id = ? AND user_id = ? LIMIT 1", [req.params.id, req.userId]);
  if (hasTx) return res.status(400).json({ error: '此帳戶下有交易記錄，請先移轉至其他帳戶' });
  db.run("UPDATE accounts SET linked_bank_id = NULL WHERE linked_bank_id = ? AND user_id = ?", [req.params.id, req.userId]);
  db.run("DELETE FROM accounts WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  saveDB();
  res.json({ ok: true });
});
```

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: update account CRUD API to support linkedBankId"
```

---

## Task 3: 新增信用卡還款 API

**Files:**
- Modify: `server.js` — 在 `app.delete('/api/accounts/:id', ...)` 之後、`// ─── 交易記錄 ───` 之前

- [ ] **Step 1: 新增 `POST /api/accounts/credit-card-repayment` 路由**

在 `server.js` 第 2470 行（`res.json({ ok: true });` + `});` 之後，在 `// ─── 交易記錄 ───` 注解之前）插入：

```javascript
app.post('/api/accounts/credit-card-repayment', (req, res) => {
  const { fromAccountId, date: rawDate, repayments } = req.body;
  if (!fromAccountId || !Array.isArray(repayments) || repayments.length === 0) {
    return res.status(400).json({ error: '缺少必要參數' });
  }
  const fromAccount = queryOne("SELECT currency FROM accounts WHERE id = ? AND user_id = ?", [fromAccountId, req.userId]);
  if (!fromAccount) return res.status(400).json({ error: '付款帳戶不存在' });

  const txDate = normalizeDate(rawDate) || todayStr();
  const fromCurrency = normalizeCurrency(fromAccount.currency);
  const now = Date.now();

  for (const { cardId, amount } of repayments) {
    if (!cardId || Number(amount) <= 0) continue;
    const cardAccount = queryOne("SELECT currency, account_type FROM accounts WHERE id = ? AND user_id = ?", [cardId, req.userId]);
    if (!cardAccount || cardAccount.account_type !== '信用卡') continue;

    const toCurrency = normalizeCurrency(cardAccount.currency);
    const transferAmount = Number(amount);
    let outConverted;
    try {
      outConverted = convertToTwd(transferAmount, fromCurrency, null, req.userId);
    } catch (e) {
      return res.status(400).json({ error: e.message || '金額格式錯誤' });
    }
    const inOriginal = toCurrency === fromCurrency
      ? transferAmount
      : convertFromTwd(outConverted.twdAmount, toCurrency, req.userId);
    const inConverted = convertToTwd(inOriginal, toCurrency, null, req.userId);

    const outId = uid();
    const inId = uid();
    db.run("INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [outId, req.userId, 'transfer_out', outConverted.twdAmount, fromCurrency, outConverted.originalAmount, outConverted.fxRate, txDate, '', fromAccountId, '信用卡還款', inId, now, now]);
    db.run("INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [inId, req.userId, 'transfer_in', inConverted.twdAmount, toCurrency, inConverted.originalAmount, inConverted.fxRate, txDate, '', cardId, '信用卡還款', outId, now, now]);
  }

  saveDB();
  res.json({ ok: true });
});
```

- [ ] **Step 2: 手動測試 API**

啟動伺服器後，使用 curl 或 Postman 測試（需先登入取得 JWT token）：

```bash
node server.js
# POST /api/accounts/credit-card-repayment
# Body: { fromAccountId, date, repayments: [{cardId, amount}] }
# 預期：HTTP 200 { ok: true }，資料庫出現對應轉帳交易
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add POST /api/accounts/credit-card-repayment endpoint"
```

---

## Task 4: HTML — 帳戶 Modal 新增銀行連結欄位

**Files:**
- Modify: `index.html:1384`

- [ ] **Step 1: 在 `accType` 的 `form-row` 之後插入「所屬銀行」欄位**

找到 `index.html` 中：
```html
        </div>
        <div class="form-row">
          <label>圖示</label>
```
（即 `accType` select 結束之後、圖示欄位之前），在兩者之間插入：

```html
        <div class="form-row" id="accLinkedBankRow" style="display:none">
          <label>所屬銀行</label>
          <select id="accLinkedBank">
            <option value="">不分組</option>
          </select>
          <p class="form-hint">連結銀行帳戶後，可在帳戶頁依銀行分組並一鍵還款</p>
        </div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add linked bank field to account modal"
```

---

## Task 5: HTML — 新增還款 Modal

**Files:**
- Modify: `index.html` — 在 `<!-- ===== 轉帳 Modal ===== -->` 之後加入

- [ ] **Step 1: 在轉帳 Modal (`modalTransfer`) 的結束 `</div>` 之後，插入還款 Modal**

找到 `index.html` 中 `<!-- ===== 轉帳 Modal ===== -->` 所在的 Modal 結尾（搜尋 `id="modalTransfer"` 的最外層 `</div>` 後），插入：

```html
  <!-- ===== 信用卡還款 Modal ===== -->
  <div class="modal-overlay" id="modalCreditRepayment">
    <div class="modal">
      <div class="modal-header">
        <h3 id="creditRepaymentTitle">信用卡還款</h3>
        <button class="modal-close" onclick="App.closeModal('modalCreditRepayment')">&times;</button>
      </div>
      <form id="creditRepaymentForm">
        <div class="form-row">
          <label>付款帳戶 <span class="required">*</span></label>
          <select id="crFromAccount" required></select>
        </div>
        <div class="form-row">
          <label>還款日期 <span class="required">*</span></label>
          <input type="date" id="crDate" required>
        </div>
        <div class="form-row">
          <div id="crCardList"></div>
        </div>
        <div class="form-row cr-total-row">
          <span>還款總計</span>
          <strong id="crTotal">$0</strong>
        </div>
        <div class="form-row cr-quick-btns">
          <button type="button" class="btn btn-ghost btn-sm" onclick="App.crSetAll()">全部歸零</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="App.crClearAll()">清除全部</button>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" onclick="App.closeModal('modalCreditRepayment')">取消</button>
          <button type="submit" class="btn btn-primary">確認還款</button>
        </div>
      </form>
    </div>
  </div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add credit card repayment modal HTML"
```

---

## Task 6: app.js — 更新帳戶 Modal 邏輯

**Files:**
- Modify: `app.js:5462-5695`

- [ ] **Step 1: 更新 `onAccTypeChange` 函式，加入銀行連結欄位顯示/隱藏邏輯**

找到 `app.js` 第 5462 行，將整個 `onAccTypeChange` 函式替換為：

```javascript
  function onAccTypeChange(type) {
    const iconMap = { '銀行': 'fa-building-columns', '信用卡': 'fa-credit-card', '現金': 'fa-money-bill', '虛擬錢包': 'fa-wallet' };
    if (iconMap[type]) el('accIcon').value = iconMap[type];
    const bankRow = el('accLinkedBankRow');
    if (type === '信用卡') {
      bankRow.style.display = '';
      const banks = cachedAccounts.filter(a => a.account_type === '銀行');
      el('accLinkedBank').innerHTML = '<option value="">不分組</option>' +
        banks.map(b => `<option value="${b.id}">${escHtml(b.name)}</option>`).join('');
    } else {
      bankRow.style.display = 'none';
    }
  }
```

- [ ] **Step 2: 更新 `openAccountModal` 的編輯分支，填入 `linkedBankId`**

在 `openAccountModal` 函式中（第 5470-5481 行）的 `if (accId)` 分支，找到：
```javascript
      el('accType').value = a.account_type || '現金';
      el('accIcon').value = normalizeAccountIcon(a.icon);
```
在這兩行之後，加入：
```javascript
      onAccTypeChange(a.account_type || '現金');
      if ((a.account_type || '') === '信用卡') {
        el('accLinkedBank').value = a.linkedBankId || '';
      }
```

- [ ] **Step 3: 更新 `accountForm` submit handler，加入 `linkedBankId`**

找到 `app.js` 第 5673 行（accountForm submit 裡的變數宣告區塊），將：
```javascript
      const accountType = el('accType').value;
      const excludeFromTotal = el('accExclude').checked;
      if (!name) return;
```
替換為：
```javascript
      const accountType = el('accType').value;
      const excludeFromTotal = el('accExclude').checked;
      const linkedBankId = accountType === '信用卡' ? (el('accLinkedBank').value || null) : null;
      if (!name) return;
```

然後將 API 呼叫兩處（PUT 和 POST）更新為帶入 `linkedBankId`：

```javascript
        if (id) {
          await API.put('/api/accounts/' + id, { name, initialBalance, icon, currency, accountType, excludeFromTotal, linkedBankId });
        } else {
          await API.post('/api/accounts', { name, initialBalance, icon, currency, accountType, excludeFromTotal, linkedBankId });
        }
```

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: update account modal to support linked bank selection"
```

---

## Task 7: app.js — 帳戶列表信用卡分組渲染

**Files:**
- Modify: `app.js:2338-2414`

- [ ] **Step 1: 新增 `renderCreditCardsByBank` helper 函式**

在 `renderAccountCard` 函式（第 2338 行）之前，插入：

```javascript
  function renderCreditCardsByBank(cards) {
    const bankGroups = {};
    const ungrouped = [];
    cards.forEach(c => {
      if (c.linkedBankId) {
        if (!bankGroups[c.linkedBankId]) bankGroups[c.linkedBankId] = [];
        bankGroups[c.linkedBankId].push(c);
      } else {
        ungrouped.push(c);
      }
    });

    let html = '';
    Object.entries(bankGroups).forEach(([bankId, groupCards]) => {
      const bankAcc = cachedAccounts.find(a => a.id === bankId);
      const bankName = bankAcc ? escHtml(bankAcc.name) : '未知銀行';
      const totalDebt = groupCards.reduce((sum, c) => sum + c.balance, 0);
      const debtStr = fmtByCurrency(totalDebt, 'TWD');
      html += `<div class="acc-bank-group-header">
        <i class="fas fa-building-columns"></i>
        <span>${bankName}</span>
        <span class="acc-bank-debt">${debtStr}</span>
        <button class="btn btn-sm btn-outline acc-repay-btn" onclick="App.openCreditRepaymentModal('${bankId}')">
          <i class="fas fa-hand-holding-dollar"></i> 還款
        </button>
      </div>
      ${groupCards.map(c => renderAccountCard(c)).join('')}`;
    });

    if (ungrouped.length > 0) {
      html += `<div class="account-type-group-header" style="--group-color:#8b5cf6;margin-top:${Object.keys(bankGroups).length > 0 ? '8px' : '0'}">
        <i class="fas fa-credit-card"></i>
        <span>未分組</span>
        <span class="acc-group-count">${ungrouped.length} 個</span>
      </div>
      ${ungrouped.map(c => renderAccountCard(c)).join('')}`;
    }
    return html;
  }
```

- [ ] **Step 2: 更新 `renderAccounts` 中「全部」tab 的信用卡渲染，使用 `renderCreditCardsByBank`**

找到 `app.js` 第 2403 行，將：
```javascript
      grid.innerHTML = typeOrder.filter(t => grouped[t]).map(type => {
        const meta = getAccountTypeMeta(type);
        return `<div class="account-type-group-header" style="--group-color:${meta.color}">
          <i class="fas ${meta.icon}"></i>
          <span>${type}</span>
          <span class="acc-group-count">${grouped[type].length} 個</span>
        </div>
        ${grouped[type].map(a => renderAccountCard(a)).join('')}`;
      }).join('');
```
替換為：
```javascript
      grid.innerHTML = typeOrder.filter(t => grouped[t]).map(type => {
        const meta = getAccountTypeMeta(type);
        const header = `<div class="account-type-group-header" style="--group-color:${meta.color}">
          <i class="fas ${meta.icon}"></i>
          <span>${type}</span>
          <span class="acc-group-count">${grouped[type].length} 個</span>
        </div>`;
        const body = type === '信用卡'
          ? renderCreditCardsByBank(grouped[type])
          : grouped[type].map(a => renderAccountCard(a)).join('');
        return header + body;
      }).join('');
```

- [ ] **Step 3: 更新 `renderAccounts` 中「信用卡」tab 的渲染，使用 `renderCreditCardsByBank`**

找到 `app.js` 第 2413 行：
```javascript
      grid.innerHTML = filtered.map(a => renderAccountCard(a)).join('');
```
替換為：
```javascript
      grid.innerHTML = accountTypeFilter === '信用卡'
        ? renderCreditCardsByBank(filtered)
        : filtered.map(a => renderAccountCard(a)).join('');
```

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: group credit cards by bank in accounts page"
```

---

## Task 8: app.js — 還款 Modal 邏輯

**Files:**
- Modify: `app.js:5715` 附近（transferForm listener 之後）、`app.js:6097`（return {} 區塊）

- [ ] **Step 1: 新增還款 Modal 相關函式**

在 `openTransferModal` 函式（第 5494 行）之後，`// 分類` 注解之前，插入以下三個函式：

```javascript
  function openCreditRepaymentModal(bankId) {
    const bankAcc = cachedAccounts.find(a => a.id === bankId);
    if (!bankAcc) return;
    const cards = cachedAccounts.filter(a => a.linkedBankId === bankId && a.account_type === '信用卡');
    el('creditRepaymentTitle').textContent = `信用卡還款（${bankAcc.name}）`;
    el('crDate').value = today();
    const opts = cachedAccounts.map(a =>
      `<option value="${a.id}"${a.id === bankId ? ' selected' : ''}>${escHtml(a.name)}</option>`
    ).join('');
    el('crFromAccount').innerHTML = opts;
    el('crCardList').innerHTML = `<table class="cr-card-table">
      <thead><tr><th>信用卡</th><th>目前欠款</th><th>還款金額</th></tr></thead>
      <tbody>${cards.map(c => {
        const currency = normalizeCurrencyCode(c.currency);
        const debt = Math.max(0, -(c.balance));
        return `<tr>
          <td>${escHtml(c.name)}</td>
          <td>${fmtByCurrency(c.balance, currency)}</td>
          <td><input type="number" class="cr-amount-input" data-card-id="${c.id}" data-debt="${debt}"
            value="${debt}" min="0" step="0.01" oninput="App.crUpdateTotal()"></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
    crUpdateTotal();
    openModal('modalCreditRepayment');
  }

  function crUpdateTotal() {
    const inputs = document.querySelectorAll('.cr-amount-input');
    const total = Array.from(inputs).reduce((sum, inp) => sum + (Number(inp.value) || 0), 0);
    el('crTotal').textContent = fmt(total);
  }

  function crSetAll() {
    document.querySelectorAll('.cr-amount-input').forEach(inp => {
      inp.value = inp.dataset.debt || 0;
    });
    crUpdateTotal();
  }

  function crClearAll() {
    document.querySelectorAll('.cr-amount-input').forEach(inp => { inp.value = ''; });
    crUpdateTotal();
  }
```

- [ ] **Step 2: 新增 `creditRepaymentForm` submit event listener**

找到 `app.js` 第 5715 行（`el('tfFrom')?.addEventListener('change', updateTransferAmountLabel);` 之後），插入：

```javascript
    el('creditRepaymentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fromAccountId = el('crFromAccount').value;
      const date = el('crDate').value || today();
      const inputs = document.querySelectorAll('.cr-amount-input');
      const repayments = Array.from(inputs)
        .map(inp => ({ cardId: inp.dataset.cardId, amount: Number(inp.value) || 0 }))
        .filter(r => r.amount > 0);
      if (repayments.length === 0) return toast('請輸入至少一筆還款金額', 'error');
      try {
        await API.post('/api/accounts/credit-card-repayment', { fromAccountId, date, repayments });
        closeModal('modalCreditRepayment');
        toast('還款成功', 'success');
        await refreshCache();
        await renderPage(currentPage);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
```

- [ ] **Step 3: 在 `return {}` 區塊暴露新函式**

找到 `app.js` 第 6060 行（`setAccountTypeFilter` 那行），在其後加入：

```javascript
    openCreditRepaymentModal,
    crUpdateTotal,
    crSetAll,
    crClearAll,
```

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add credit card repayment modal logic"
```

---

## Task 9: CSS — 銀行子群組與還款 Modal 樣式

**Files:**
- Modify: `style.css` — 在 `.acc-group-count` 規則之後（第 756 行）

- [ ] **Step 1: 新增樣式**

在 `style.css` 第 756 行（`.acc-group-count { ... }` 規則之後）插入：

```css
/* ── 信用卡銀行子群組 ── */
.acc-bank-group-header {
  grid-column: 1 / -1;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: color-mix(in srgb, #8b5cf6 8%, var(--surface));
  border: 1px solid color-mix(in srgb, #8b5cf6 20%, transparent);
  border-radius: var(--radius-sm);
  color: #8b5cf6;
  font-size: 13px; font-weight: 600;
  margin-top: 8px;
}
.acc-bank-group-header:first-child { margin-top: 0; }
.acc-bank-debt { font-size: 12px; font-weight: 500; color: var(--text-muted); }
.acc-repay-btn { margin-left: auto; }
/* ── 還款 Modal 表格 ── */
.cr-card-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.cr-card-table th { text-align: left; padding: 6px 8px; color: var(--text-muted); font-weight: 500; border-bottom: 1px solid var(--border); }
.cr-card-table td { padding: 8px 8px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.cr-card-table td:last-child { width: 130px; }
.cr-amount-input { width: 100%; padding: 5px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 14px; text-align: right; background: var(--surface); color: var(--text); }
.cr-amount-input:focus { outline: none; border-color: var(--primary); }
.cr-total-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; font-size: 15px; border-top: 2px solid var(--border); margin-top: 4px; }
.cr-total-row strong { font-size: 18px; color: var(--primary); }
.cr-quick-btns { display: flex; gap: 8px; padding-top: 0; }
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: add CSS for bank group header and repayment modal"
```

---

## Task 10: 更新 changelog.json

**Files:**
- Modify: `changelog.json`

- [ ] **Step 1: 更新版本號並新增版本紀錄**

在 `changelog.json` 中，將 `"currentVersion": "4.0.10"` 改為 `"currentVersion": "4.1"`，並在 `releases` 陣列最前面新增：

```json
{
  "version": "4.1",
  "date": "2026-04-02",
  "title": "信用卡銀行分組與一鍵還款",
  "type": "feature",
  "changes": [
    { "tag": "new", "text": "信用卡帳戶可連結所屬銀行帳戶，帳戶管理頁依銀行分組顯示" },
    { "tag": "new", "text": "信用卡銀行群組新增「還款」按鈕，支援逐張設定還款金額、全部歸零、清除全部" },
    { "tag": "improved", "text": "刪除銀行帳戶時自動解除旗下信用卡的銀行連結" }
  ]
},
```

- [ ] **Step 2: 更新 `SRS.md` 版本歷程表（8.2 節）**

在 `SRS.md` 的版本歷程表中新增 4.1 版本行。

- [ ] **Step 3: Commit**

```bash
git add changelog.json SRS.md
git commit -m "docs: bump version to 4.1, update changelog and SRS"
```

---

## Task 11: 整合測試

- [ ] **Step 1: 啟動伺服器，完整手動測試流程**

```bash
node server.js
```

1. **新增銀行帳戶**：建立「國泰世華」銀行帳戶
2. **新增信用卡**：建立「CUBE 卡」信用卡，所屬銀行選「國泰世華」
3. **新增信用卡**：建立「鈦金卡」信用卡，所屬銀行選「國泰世華」
4. **新增交易**：在 CUBE 卡新增幾筆支出（讓餘額變負）
5. **帳戶管理頁**：確認信用卡在「全部」tab 和「信用卡」tab 下都以「國泰世華」為子群組顯示
6. **點擊「還款」按鈕**：確認 Modal 顯示正確，欠款金額填入正確
7. **全部歸零**：確認金額填入各卡欠款
8. **修改其中一張卡金額**：確認總計即時更新
9. **確認還款**：確認產生對應轉帳交易，信用卡餘額歸零（或部分歸零）
10. **刪除銀行帳戶**：確認信用卡的所屬銀行連結被清除，卡片移入「未分組」

- [ ] **Step 2: 確認 Final commit 無遺漏**

```bash
git log --oneline -10
git status
```
預期：working tree clean，10 個功能 commit 均已推送。

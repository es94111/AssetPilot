# 更新文件與版號

完成功能開發或修正後，依序執行以下步驟確保所有文件保持同步：

## 步驟 1：判斷版號

根據異動規模決定版號：
- **大版本**（如 4.0）：新增重大模組
- **小版本**（如 3.8）：新增功能或重要改進
- **修正版**（如 3.7.1）：Bug 修正

讀取 `changelog.json` 的 `currentVersion` 確認目前版號，再決定新版號。

## 步驟 2：更新 `changelog.json`

1. 將 `currentVersion` 改為新版號
2. 在 `releases` 陣列**最前面**插入新版本紀錄：

```json
{
  "version": "X.Y.Z",
  "date": "YYYY-MM-DD",
  "title": "簡短版本標題",
  "type": "feature",
  "changes": [
    { "tag": "new", "text": "新增的功能說明" },
    { "tag": "improved", "text": "改進的功能說明" },
    { "tag": "fixed", "text": "修正的問題說明" }
  ]
}
```

`tag` 可用值：`new`（新增）、`improved`（改進）、`fixed`（修正）、`removed`（移除）

## 步驟 3：更新 `SRS.md`

找到版本歷程表（8.2 節），在表格**最前面**插入一行：

```
| X.Y.Z | YYYY-MM-DD | 簡短說明 |
```

## 步驟 4：更新 `README.md`（若存在）

若 README.md 中有版本徽章或變更日誌區塊，同步更新版本號。

---

完成後回報：「已更新版號至 X.Y.Z，changelog.json、SRS.md 已同步。」

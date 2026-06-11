# Google Play 手機截圖

依 `mobile/GOOGLE_PLAY_GRAPHIC_GUIDE.md` 產生的 8 張上架手機截圖，畫面與真實 App
（`mobile/lib/screens/*.dart`，Material 3 深色主題，品牌藍 `#2563EB`）一致。

## 規格（皆符合 Google Play 要求）

- 格式：PNG
- 尺寸：1080 × 1920 px（精確 9:16）
- 每邊介於 320–3840 px ✓
- 檔案大小 < 8 MB（實際 < 150 KB）✓
- 全部使用假資料，無任何真實個資 / 真實財務資料 / 真實持倉

## 清單

| # | 檔案 | 畫面 |
| - | ---- | ---- |
| 1 | `01-login.png` | 登入（安全登入與伺服器連線） |
| 2 | `02-dashboard.png` | 首頁儀表板（收支總覽、淨額、支出分類） |
| 3 | `03-transactions.png` | 記帳（快速記錄收支） |
| 4 | `04-stocks-holdings.png` | 股票 – 持股（追蹤台股投資） |
| 5 | `05-stocks-realized.png` | 股票 – 已實現損益 |
| 6 | `06-budgets.png` | 預算（掌握每月預算） |
| 7 | `07-reports.png` | 統計報表（用圖表看懂現金流） |
| 8 | `08-more.png` | 更多（帳戶、分類、設定…） |

## 重新產生

來源在 `mobile/assets/play-store/_build/`（`style.js` = Material 3 深色樣式與圖示、
`gen.js` = 8 個畫面）。

```powershell
# 1) 產生 HTML
cd mobile/assets/play-store/_build
node gen.js

# 2) 用 Edge headless 渲染成 1080x1920 PNG（432x768 邏輯像素 × 2.5 DSF）
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir  = "..\screenshots"
Get-ChildItem $dir -Filter *.html | ForEach-Object {
  $png = $_.FullName -replace '\.html$', '.png'
  $url = "file:///" + ($_.FullName -replace '\\','/')
  Start-Process $edge -Wait -NoNewWindow -ArgumentList `
    "--headless=new","--disable-gpu","--hide-scrollbars",
    "--force-device-scale-factor=2.5","--window-size=432,768",
    "--screenshot=$png",$url
}
```

> 若日後 App 畫面（版面/配色/文案）有調整，請同步更新 `gen.js` 後重新產生，
> 以維持「與真實 App 畫面一致」。

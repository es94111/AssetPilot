# Google Play 7 吋平板截圖

依 `mobile/GOOGLE_PLAY_GRAPHIC_GUIDE.md` 產生的 8 張 7 吋平板上架截圖，畫面與真實
App（`mobile/lib/screens/*.dart`，Material 3 深色主題，品牌藍 `#2563EB`）一致。

> AssetPilot 的畫面為**單欄版面、無平板專屬響應式重排**，因此平板上的真實畫面即同一套
> UI 在更寬／更高的畫布上自然撐開（卡片更寬、留白更多）。截圖即據此產生。

## 規格（皆符合 Google Play 要求）

- 格式：PNG
- 尺寸：1440 × 2560 px（精確 9:16，2K 平板解析度）
- 每邊介於 320–3840 px ✓
- 檔案大小 < 8 MB（實際 < 160 KB）✓
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

來源在 `mobile/assets/play-store/_build/`（與手機版共用 `style.js` / `gen.js`）。
平板用 576×1024 邏輯像素 + CSS `zoom:2.5`（DSF=1）渲染成 1440×2560。

> 為何用 `zoom` 而非 `--force-device-scale-factor`：Edge headless 在 DSF 縮放路徑下
> 對較高的頁面有點陣化異常；`zoom` + DSF=1 可得到單一乾淨點陣圖。

```powershell
# 1) 產生平板 HTML（576x1024 + zoom 2.5）
cd mobile/assets/play-store/_build
node gen.js tablet

# 2) 用 Edge headless 渲染成 1440x2560 PNG（DSF=1）
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir  = "..\screenshots-tablet-7in"
Get-ChildItem $dir -Filter *.html | ForEach-Object {
  $png = $_.FullName -replace '\.html$', '.png'
  $url = "file:///" + ($_.FullName -replace '\\','/')
  Start-Process $edge -Wait -NoNewWindow -ArgumentList `
    "--headless=new","--disable-gpu","--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--force-device-scale-factor=1","--window-size=1440,2560",
    "--screenshot=$png",$url
}
```

> 手機版截圖（1080×1920）在 `../screenshots/`，由 `node gen.js`（無參數）產生。
> App 畫面若有調整，請同步更新 `gen.js` 後重新產生兩種尺寸。

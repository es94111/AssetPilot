# Firebase Test Lab Robo scripts

Use one Robo script per app locale. The selectors are language-specific, so run
the same APK twice in Firebase Test Lab:

- `assetpilot-robo-script.en.json`: English UI, use an English device locale.
- `assetpilot-robo-script.zh-TW.json`: Traditional Chinese UI, use a zh-TW
  device locale.
- `assetpilot-robo-script.json`: legacy/default copy of the English script.

Before uploading, replace these placeholders in the script you use:

- `GOOGLE_PLAY_TEST_ACCOUNT_EMAIL_HERE`
- `GOOGLE_PLAY_TEST_ACCOUNT_PASSWORD_HERE`

Both locale scripts create visible Firebase Test Lab records. Fixed values that
would otherwise block repeated runs, such as the temporary category, stock
symbol, and same-month category budget, are deleted before crawl termination.

Example:

```powershell
gcloud firebase test android run --type robo --app path\to\app-release.apk --robo-script mobile\test-lab\assetpilot-robo-script.en.json --device model=Pixel2,version=30,locale=en,orientation=portrait
gcloud firebase test android run --type robo --app path\to\app-release.apk --robo-script mobile\test-lab\assetpilot-robo-script.zh-TW.json --device model=Pixel2,version=30,locale=zh_TW,orientation=portrait
```

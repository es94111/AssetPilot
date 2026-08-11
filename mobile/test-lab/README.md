# Robo scripts

These Robo scripts drive the app's key flows (login, transactions, accounts,
recurring expenses, reports, settings, stocks, budgets, categories) and stop
the crawl before generic exploration can reach destructive account actions.

## Play Console pre-launch report

`assetpilot-robo-script.pre-launch.json` is the script to upload in Play
Console under **Release > Testing > Pre-launch report > Settings**, in the
"Control how pre-launch report explores your app" section (控管正式發布前測試報告對應用程式的測試方式).

The pre-launch report accepts the same Firebase Test Lab Robo script format, so
this file is the zh-TW script (the app's default locale) with the `pm clear`
command using the explicit package name and pre-launch-specific descriptions.

Steps:

1. In Play Console, open **Release > Testing > Pre-launch report > Settings**.
2. Under "Control how pre-launch report explores your app", upload
   `mobile\test-lab\assetpilot-robo-script.pre-launch.json`.
3. Replace the two placeholders in the uploaded copy with the Google Play test
   account credentials before the report runs:
   - `GOOGLE_PLAY_TEST_ACCOUNT_EMAIL_HERE`
   - `GOOGLE_PLAY_TEST_ACCOUNT_PASSWORD_HERE`
4. Pick device models whose locale matches the script (zh-TW). If the report
   will run on English-locale devices, upload the English script instead.
5. The crawler runs the scripted actions first, then `TERMINATE_CRAWL` stops
   it so it cannot reach destructive actions.

Coordinate-based steps (`ADB_SHELL_COMMAND` `input swipe` / `input tap`) assume
a ~1080×2340 screen like the Pixel 2 used in the Firebase Test Lab examples; on
a device with a different resolution those steps can miss their targets.

## Firebase Test Lab

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

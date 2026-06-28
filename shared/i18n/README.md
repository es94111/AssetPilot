# Shared i18n

This directory is the single maintained source for Web and Flutter text.

- `locales.json` registers supported locales and platform-specific tags.
- `app_*.arb` files contain stable message ids and translated strings.
- Run `npm run i18n:generate` after editing either file.

Generated outputs include:

- `lib/i18n/dictionaries/*.ts` for the Next.js app.
- `lib/i18n/generated/config.ts` for Web locale metadata.
- `mobile/lib/generated/app_locales.dart` and `mobile/lib/generated/shared_translations.dart` for the Flutter compatibility layer.
- `mobile/lib/generated/l10n/arb/*.arb` for Flutter `gen-l10n`, including generated base fallbacks such as `zh` and `pt` when Flutter requires them.

Do not edit generated i18n outputs by hand.

# Shared-ledger investment data

Investment records follow the active financial ledger, just like bookkeeping records. Each ledger's `data_owner_id` is the namespace for stocks, trades, dividends, recurring investments, ledger-level stock fee settings, funding-account links, and FX rates. A new shared ledger starts with no investment records; personal holdings and transactions are never copied into it.

## Currency and FX

Stocks retain their market currency (for example, TWD or USD). Combined portfolio values and investment reports use TWD, matching the existing report contract. Exchange rates are stored against the ledger namespace, can be set manually or explicitly refreshed, and fall back to the system rate when the ledger has no rate. Shared reports never use a member's personal FX rates or auto-update preference. Auto-update settings remain private and are not returned or changed through a shared-ledger request. Stock fee and tax defaults are likewise loaded from the selected ledger namespace, not from a member's personal settings.

## Permissions, auditing, and notifications

Owners and editors can write investment data; viewers can only read it. Investment requests resolve membership before accessing data, and stock trades, dividends, and recurring-investment operations are audited with the acting member, role, endpoint, and success/failure outcome. Funding accounts must belong to the same ledger namespace as the investment record. Invalid legacy recurring plans referencing an account outside that namespace are skipped rather than generating a linked trade.

Investment changes and recurring-investment processing do not send email or LINE notifications. Personal report schedules, notification preferences, and credentials remain private to each member and are not shared with the ledger. Removing a member or leaving revokes ledger access immediately; investment records remain with the ledger.

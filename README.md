<p align="center">
  🌐 &nbsp;
  <strong>English</strong> &nbsp;|&nbsp;
  <a href="README_ch.md">中文</a> &nbsp;|&nbsp;
  <a href="README_es.md">Español</a> &nbsp;|&nbsp;
  <a href="README_fr.md">Français</a> &nbsp;|&nbsp;
  <a href="README_ja.md">日本語</a> &nbsp;|&nbsp;
  <a href="README_ko.md">한국어</a>
</p>

# AssetPilot — Personal Asset Management

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  A personal asset management web application — bookkeeping, stock tracking, and budget management, all in one place.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.0.4-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="license">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="docker">
</p>

---

## Table of Contents

- [Introduction](#introduction)
- [Key Features](#key-features)
- [Features](#features)
  - [Dashboard](#dashboard)
  - [Finance Management](#finance-management)
  - [Stock Records](#stock-records)
  - [Reports](#reports)
  - [Budget Management](#budget-management)
  - [Account Management](#account-management)
  - [Settings & Admin](#settings--admin)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
  - [Option 1: Docker Hub One-click Deploy (Recommended)](#option-1-docker-hub-one-click-deploy-recommended)
  - [Option 2: Docker Compose](#option-2-docker-compose)
  - [Option 3: Node.js Direct Run](#option-3-nodejs-direct-run)
- [Environment Variables](#environment-variables)
- [Deployment Guide](#deployment-guide)
  - [Synology NAS](#synology-nas)
  - [Cloud VPS](#cloud-vps)
  - [Nginx Reverse Proxy](#nginx-reverse-proxy)
  - [Caddy Reverse Proxy](#caddy-reverse-proxy)
- [Google SSO Setup](#google-sso-setup)
- [Usage Guide](#usage-guide)
  - [First-time Setup](#first-time-setup)
  - [Adding a Transaction](#adding-a-transaction)
  - [Credit Card Payment Guide](#credit-card-payment-guide)
  - [Stock Management](#stock-management)
  - [Exchange Rate Management](#exchange-rate-management)
  - [CSV Export & Import](#csv-export--import)
  - [Admin Operations](#admin-operations)
- [Docker Advanced Management](#docker-advanced-management)
- [Security](#security)
- [File Structure](#file-structure)
- [API Sources](#api-sources)
- [License](#license)

---

## Introduction

**AssetPilot** is a privacy-first personal asset management web application.

All data is stored locally (or on your self-hosted server) — no third-party cloud database required. Deploy with a single Docker command, making it ideal for home NAS devices (e.g. Synology), VPS, or your local machine.

**Who is it for?**

- Anyone who wants to track their personal cash flow, monthly income/expenses, and budget
- Investors in the Taiwan stock market who need to manage holdings, P&L, and dividends
- Privacy-conscious users who don't want their financial data stored on third-party platforms

---

## Key Features

| Feature | Description |
|---------|-------------|
| 🏠 **Self-hosted, Data Ownership** | Encrypted database stored locally; no financial data uploaded to external servers |
| 🐳 **One-click Docker Deploy** | Zero configuration required; JWT keys and encryption keys are auto-generated |
| 📊 **Deep TWSE Integration** | Real-time stock prices, automatic ex-dividend sync, FIFO P&L calculation via TWSE OpenAPI |
| 💱 **Multi-currency Support** | 150+ currencies supported, with live exchange rates from exchangerate-api.com |
| 📱 **Responsive Design** | Works smoothly on both desktop and mobile |
| 🔒 **Enterprise-grade Security** | ChaCha20-Poly1305 database encryption, Helmet security headers, rate limiting, CSP |
| 👥 **Multi-user Management** | Supports multiple users; admin can control registration policy and audit login logs |
| 🔑 **Google SSO** | Optional Google one-click login via OAuth Authorization Code Flow |

---

## Features

### Dashboard

- Total asset overview card (sum of all account balances)
- Monthly income / expense summary
- Expense category doughnut chart (supports dual-ring chart: inner ring = parent category, outer ring = subcategory)
- Asset allocation doughnut chart (account assets + stock market value, switchable to dual-ring)
- Recent transactions list

### Finance Management

**Transactions**
- Income / expense / transfer CRUD with notes, categories, accounts, and currencies
- Future-dated transactions auto-tagged with a "Future" label for identification and filtering
- Multi-select batch operations: batch delete, batch change category / account / date
- Account-to-account transfers with bidirectional auto-pairing (`linked_id`)

**Budget Management**
- Monthly total budget + per-category budgets
- Visual progress bars showing remaining budget in real time

**Account Management**
- Multiple accounts (cash, bank, credit card, etc.)
- Balances auto-calculated from transaction records
- Multi-currency accounts with live exchange rate conversion

**Exchange Rate Settings**
- Connected to exchangerate-api.com, supporting 150+ currencies
- Manual trigger or auto-sync; displays last-updated timestamp

**Category Management**
- Two-level parent-child category structure (e.g. Food → Breakfast / Lunch / Dinner)
- Custom category colors

**Recurring Transactions**
- Set up periodic income/expenses (rent, salary, etc.) that automatically generate transaction records

### Stock Records

**Portfolio Overview**
- Real-time market value, unrealized P&L, and return rate calculation
- Auto-fetches live / closing prices from TWSE (3-stage strategy)
- Batch price update with source (real-time price / closing price) and timestamp per stock

**Transaction Records**
- Buy / sell records supporting full lots and fractional shares
- Auto-calculated brokerage fee (`0.1425%`, minimum NT$20 for full lots)
- Auto-calculated securities transaction tax on sells (regular stock `0.3%`, ETF/warrants `0.1%`)
- Enter a stock ticker to auto-query TWSE and create the stock entry (no need to add manually first)
- Search/filter, pagination, multi-select batch delete

**Dividend Records**
- Cash dividend / stock dividend records
- Auto-sync ex-dividends from TWSE (`TWT49U` + `TWT49UDetail`), duplicate-safe

**Realized P&L**
- FIFO calculation of average cost, realized P&L, and return rate per sale
- Summary cards: total realized P&L, overall return rate, current-year P&L

**Regular Investment Plan (DCA)**
- Set a period and budget per cycle; buy transactions are automatically generated

### Reports

- **Category Report**: Parent-category doughnut chart, switchable to dual-ring (inner = parent, outer = sub); legend and tooltip show amount and percentage
- **Trend Analysis**: Monthly income / expense line chart
- **Daily Spending**: Daily expense bar chart
- Custom date range filter

### Account Management

- Add, edit, and delete multiple accounts
- Displays live balance for each account

### Settings & Admin

**Account Settings**
- Edit display name and password
- View personal login history (last 100 entries) with timestamp, IP, country, and login method

**Data Export & Import**
- Transaction records CSV export / import (including category structure)
- Stock transactions CSV export / import
- Dividend records CSV export / import

**Admin Features**
- Toggle public registration; configure email whitelist
- Add / delete user accounts
- View all users' login records (including failed attempts)
- Manually sync login records without page refresh

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML / CSS / JavaScript (SPA with `history.pushState`) |
| Backend | Node.js + Express |
| Database | SQLite (sql.js, in-memory + file persistence) |
| Encryption | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 |
| Auth | JWT (Bearer Token) + bcryptjs; Google OAuth Code Flow (optional) |
| Charts | Chart.js |
| Icons | Font Awesome 6 |
| Security | Helmet, express-rate-limit, SRI, CORS whitelist, CSP |

---

## Installation

### Option 1: Docker Hub One-click Deploy (Recommended)

No configuration needed — just run:

```bash
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  es94111/assetpilot:latest
```

Open [http://localhost:3000](http://localhost:3000) and you're ready to go.

> **That's it!** The database, JWT key, encryption key, and volume are all created automatically.

---

### Option 2: Docker Compose

Create a `docker-compose.yml` file:

```yaml
services:
  assetpilot:
    image: es94111/assetpilot:latest
    container_name: assetpilot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - assetpilot-data:/app/data
    environment:
      - GOOGLE_CLIENT_ID=          # Optional: enter your Google OAuth Client ID to enable SSO
      # - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
```

Start the container:

```bash
docker compose up -d
```

---

### Option 3: Node.js Direct Run

**Requirements:** Node.js >= 18

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env as needed

# 3. Start the server
node server.js
```

Open [http://localhost:3000](http://localhost:3000) to start using the app.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | JWT signing key (must change in production) | Auto-generated by Docker |
| `JWT_EXPIRES` | JWT expiration period | `7d` |
| `DB_ENCRYPTION_KEY` | Database encryption key | Auto-generated by Docker |
| `DB_PATH` | Database file path | `/app/data/database.db` |
| `ENV_PATH` | Auto-generated .env file path | `/app/data/.env` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (optional) | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret (optional) | — |
| `ALLOWED_ORIGINS` | CORS whitelist, comma-separated (unrestricted if empty) | — |
| `EXCHANGE_RATE_API_KEY` | exchangerate-api.com API Key (optional) | — |
| `IPINFO_TOKEN` | ipinfo.io token for higher IP lookup quota (optional) | — |
| `CHANGELOG_URL` | Remote changelog.json URL | Default GitHub repo URL |

---

## Deployment Guide

### Synology NAS

**Option A: Container Manager GUI (Easiest)**

1. DSM → **Container Manager** → **Registry** → Search `es94111/assetpilot` → Download
2. **Container** → **Create** → Select `es94111/assetpilot:latest`
3. Set Port: `3000 → 3000`; Volume is created automatically
4. Start the container

**Option B: SSH Command**

```bash
sudo docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /volume1/docker/assetpilot/data:/app/data \
  es94111/assetpilot:latest
```

**Reverse Proxy (Custom Domain + HTTPS)**

DSM → **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**, add a rule:

| Field | Value |
|-------|-------|
| Source Protocol | HTTPS |
| Source Hostname | `your-domain.com` |
| Source Port | 443 |
| Destination Protocol | HTTP |
| Destination Hostname | `localhost` |
| Destination Port | `3000` |

Add custom header: `X-Forwarded-For` → `$proxy_add_x_forwarded_for`

---

### Cloud VPS

```bash
mkdir assetpilot && cd assetpilot

cat > docker-compose.yml << 'EOF'
services:
  assetpilot:
    image: es94111/assetpilot:latest
    container_name: assetpilot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - assetpilot-data:/app/data
    environment:
      - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
EOF

docker compose up -d
```

---

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Caddy Reverse Proxy

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy automatically provisions and renews HTTPS certificates.

---

## Google SSO Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create an OAuth 2.0 Client ID (type: Web application)
2. Set **Authorized JavaScript Origins**:
   - Local: `http://localhost:3000`
   - Production: `https://your-domain.com`
3. Set **Authorized Redirect URIs**:
   - Local: `http://localhost:3000/`
   - Production: `https://your-domain.com/`
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as environment variables and restart
5. If not configured, the Google login button is automatically hidden and does not affect password login

> ⚠️ If you get stuck at `/?code=...` after login, ensure the redirect URI in Google Console exactly matches your domain (including `https://` and the trailing `/`).

---

## Usage Guide

### First-time Setup

1. Open your browser and go to `http://localhost:3000`
2. Click **"Register Now"** to create an account
3. **The first registered user automatically becomes the admin**
4. Default categories (food, clothing, housing, transport, etc.) and accounts (cash, bank account) are created automatically
5. You're ready to start using the app after logging in

---

### Adding a Transaction

1. Click **"Finance"** in the sidebar
2. Click **"+ Add Transaction"** in the top right
3. Fill in date, type (income / expense / transfer), amount, category, and account
4. Optionally add notes and currency
5. Click **"Save"**

**Batch Operations:** Select multiple transactions with checkboxes, then use the action bar to batch delete or batch change category / account / date.

---

### Credit Card Payment Guide

When spending with a credit card, record it as an **expense** with the credit card as the account, allowing the balance to go negative (reflecting your actual debt).

**When paying your credit card bill:**

1. **Finance** → **Add Transaction**
2. Set type to **Transfer**
3. From account: your **bank account**
4. To account: your **credit card account**
5. Enter the payment amount and save

This deducts from your bank balance and offsets the negative credit card balance — without double-counting it as an expense.

---

### Stock Management

**Adding a Stock Position**

1. **Stock Records** → **Transactions** → **+ Add Stock Transaction**
2. Enter the stock ticker (e.g. `2330`); the system auto-queries TWSE and fills in the name and current price
3. Fill in purchase date, number of shares, and transaction price
4. Brokerage fee and transaction tax are auto-calculated (editable)
5. The position is added to your portfolio after saving

**Updating Stock Prices**

Click **"Update Prices"** on the Portfolio page. The system uses a 3-stage strategy to fetch the latest prices:
- During trading hours → TWSE real-time price
- After market close → STOCK_DAY closing price
- Other times → STOCK_DAY_ALL fallback

**Syncing Ex-dividends**

**Dividend Records** → **Sync Ex-dividends** — automatically adds cash and stock dividends based on your holding period (duplicate-safe).

---

### Exchange Rate Management

1. **Finance** → **Account Management** → **Exchange Rate Settings**
2. Click **"Fetch Live Rates Now"** to manually sync
3. Or enable **"Auto-update Exchange Rates"** to sync automatically when entering the page
4. Add any 3-letter currency code as a custom currency

---

### CSV Export & Import

**Path:** **Settings** → **Data Export & Import**

| Type | Exported Fields |
|------|----------------|
| Transactions | Date, type, amount, currency, category, account, notes |
| Stock Transactions | Date, ticker, name, type (buy/sell), shares, price, fee, tax, account, notes |
| Dividend Records | Date, ticker, name, cash dividend, stock dividend, notes |

**Import Notes:** If a stock ticker doesn't exist, it will be created automatically on import. If the name is incorrect, it will be updated with the name from the CSV.

---

### Admin Operations

**Path:** **Settings** → **Admin**

| Feature | Description |
|---------|-------------|
| Toggle Public Registration | Control whether anyone can self-register |
| Email Whitelist | Only allow emails on the whitelist to register (one per line) |
| Add Account | Directly create a new user, optionally as an admin |
| Delete Account | Permanently delete a user and all their associated data |
| Login Audit | View all users' login timestamps, IPs, countries, and success/failure status |

---

## Docker Advanced Management

### Image Information

| Item | Value |
|------|-------|
| Docker Hub | [`es94111/assetpilot`](https://hub.docker.com/r/es94111/assetpilot) |
| Supported Architectures | `linux/amd64`, `linux/arm64` |
| Base Image | `node:24-alpine` |
| Image Size | ~180 MB |
| Health Check | Auto-checks every 30 seconds |

### Volume & Data Persistence

The `/app/data` directory inside the container holds all persistent data:

```
/app/data/
├── database.db    # Encrypted SQLite database
└── .env           # Auto-generated keys (JWT_SECRET, DB_ENCRYPTION_KEY)
```

**Three mounting options:**

```bash
# 1. Anonymous Volume (simplest)
docker run -d -p 3000:3000 es94111/assetpilot:latest

# 2. Named Volume (recommended, easy to manage)
docker run -d -p 3000:3000 -v assetpilot-data:/app/data es94111/assetpilot:latest

# 3. Bind Mount (for direct file access)
docker run -d -p 3000:3000 -v /path/to/data:/app/data es94111/assetpilot:latest
```

### Backup & Restore

```bash
# Backup
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/assetpilot-backup.tar.gz -C /data .

# Restore
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar xzf /backup/assetpilot-backup.tar.gz -C /data
```

> ⚠️ **Important:** Deleting a volume will permanently destroy your database and encryption keys. Always back up before doing so.

### Common Management Commands

```bash
# View container status (including health check)
docker ps

# View live logs
docker logs -f assetpilot

# Stop / Restart
docker stop assetpilot
docker restart assetpilot

# Update to the latest version
docker pull es94111/assetpilot:latest
docker rm -f assetpilot
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v assetpilot-data:/app/data \
  es94111/assetpilot:latest
```

### Build Your Own Image

```bash
docker build -t assetpilot .

docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  assetpilot
```

---

## Security

| Mechanism | Description |
|-----------|-------------|
| **Database Encryption** | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 key derivation |
| **Password Hashing** | bcryptjs hash storage — passwords are never stored in plaintext |
| **XSS Protection** | All user input is escaped via `escHtml()` before being inserted into the DOM |
| **Security Headers** | Helmet (HSTS, X-Content-Type-Options, Referrer-Policy) |
| **CSP Protection** | Inline scripts blocked; script and resource sources restricted |
| **Rate Limiting** | Login / registration API limited to 20 requests per IP per 15 minutes |
| **CORS Control** | `ALLOWED_ORIGINS` restricts allowed origin domains |
| **OAuth State Validation** | Google login uses a one-time state token to prevent CSRF / replay attacks |
| **SRI Verification** | External CDN scripts (Font Awesome, Chart.js) include integrity attributes |
| **Attribute Injection Protection** | Account icon field validated against a whitelist (only `fa-*` allowed) |
| **Login Audit** | Logs login timestamp, IP, country, and method; admins can view failed attempts |
| **Health Check** | Docker HEALTHCHECK auto-detects service status every 30 seconds |

---

## File Structure

```
├── server.js              # Express backend (API + database)
├── app.js                 # Frontend SPA logic (IIFE module)
├── index.html             # Single-page HTML (all pages + modals)
├── style.css              # Global styles
├── logo.svg               # Website logo (login page)
├── favicon.svg            # Favicon + sidebar logo
├── changelog.json         # Version update records
├── Dockerfile             # Docker build configuration
├── docker-compose.yml     # Docker Compose configuration
├── .env.example           # Environment variable template
├── .gitignore             # Git ignore list
├── SRS.md                 # Software Requirements Specification
├── .github/workflows/
│   └── docker-publish.yml # CI/CD automated build & push
└── data/                  # Data directory (Docker Volume mount)
    ├── database.db        # Encrypted SQLite database (auto-generated)
    └── .env               # Key file (auto-generated)
```

---

## API Sources

| Service | Purpose | Link |
|---------|---------|------|
| **TWSE OpenAPI** | Taiwan stock real-time prices and ex-dividend data | [openapi.twse.com.tw](https://openapi.twse.com.tw/) |
| **exchangerate-api.com** | Global live exchange rates (base currency: TWD) | [exchangerate-api.com](https://www.exchangerate-api.com/) |
| **Google Identity Services** | Google SSO login | [developers.google.com/identity](https://developers.google.com/identity) |
| **IPinfo Lite** | IP country lookup | [ipinfo.io/lite](https://ipinfo.io/lite) |

IP address data is powered by <a href="https://ipinfo.io/lite" target="_blank" rel="noopener noreferrer">IPinfo</a>.

---

## License

[MIT License](LICENSE)

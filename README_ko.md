<p align="center">
  🌐 &nbsp;
  <a href="README.md">English</a> &nbsp;|&nbsp;
  <a href="README_ch.md">中文</a> &nbsp;|&nbsp;
  <a href="README_es.md">Español</a> &nbsp;|&nbsp;
  <a href="README_fr.md">Français</a> &nbsp;|&nbsp;
  <a href="README_ja.md">日本語</a> &nbsp;|&nbsp;
  <strong>한국어</strong>
</p>

# AssetPilot — 개인 자산 관리

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  개인 자산 관리 웹 애플리케이션 — 가계부, 주식 관리, 예산 관리를 한 곳에서.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.0.4-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="license">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="docker">
</p>

---

## 목차

- [소개](#소개)
- [주요 기능 요약](#주요-기능-요약)
- [기능 상세](#기능-상세)
  - [대시보드](#대시보드)
  - [가계부 관리](#가계부-관리)
  - [주식 기록](#주식-기록)
  - [통계 보고서](#통계-보고서)
  - [예산 관리](#예산-관리)
  - [계좌 관리](#계좌-관리)
  - [설정 및 관리자](#설정-및-관리자)
- [기술 스택](#기술-스택)
- [설치 방법](#설치-방법)
  - [방법 1: Docker Hub 원클릭 배포 (권장)](#방법-1-docker-hub-원클릭-배포-권장)
  - [방법 2: Docker Compose](#방법-2-docker-compose)
  - [방법 3: Node.js 직접 실행](#방법-3-nodejs-직접-실행)
- [환경 변수](#환경-변수)
- [배포 가이드](#배포-가이드)
  - [Synology NAS](#synology-nas)
  - [클라우드 VPS](#클라우드-vps)
  - [Nginx 리버스 프록시](#nginx-리버스-프록시)
  - [Caddy 리버스 프록시](#caddy-리버스-프록시)
- [Google SSO 설정](#google-sso-설정)
- [사용 가이드](#사용-가이드)
  - [최초 설정](#최초-설정)
  - [거래 내역 추가](#거래-내역-추가)
  - [신용카드 결제 가이드](#신용카드-결제-가이드)
  - [주식 관리](#주식-관리)
  - [환율 관리](#환율-관리)
  - [CSV 내보내기 및 가져오기](#csv-내보내기-및-가져오기)
  - [관리자 기능](#관리자-기능)
- [Docker 고급 관리](#docker-고급-관리)
- [보안](#보안)
- [파일 구조](#파일-구조)
- [API 출처](#api-출처)
- [라이선스](#라이선스)

---

## 소개

**AssetPilot**은 프라이버시를 최우선으로 하는 개인 자산 관리 웹 애플리케이션입니다.

모든 데이터는 로컬(또는 자체 호스팅 서버)에 저장되며, 외부 클라우드 데이터베이스가 필요하지 않습니다. 단일 Docker 명령으로 배포할 수 있어 홈 NAS(예: Synology), VPS, 또는 로컬 환경에 적합합니다.

**이런 분께 적합합니다:**

- 개인 현금 흐름, 월별 수입/지출, 예산을 관리하고 싶으신 분
- 대만 주식 시장에 투자하며 보유 종목, 손익, 배당금을 관리해야 하는 투자자
- 금융 데이터를 외부 플랫폼에 저장하고 싶지 않은 프라이버시 중시 사용자

---

## 주요 기능 요약

| 기능 | 설명 |
|---------|-------------|
| 🏠 **자체 호스팅, 데이터 소유권** | 암호화된 데이터베이스를 로컬에 저장; 금융 데이터를 외부 서버에 업로드하지 않음 |
| 🐳 **원클릭 Docker 배포** | 별도 설정 불필요; JWT 키와 암호화 키 자동 생성 |
| 📊 **TWSE 심층 연동** | TWSE OpenAPI를 통한 실시간 주가, 자동 배당락 동기화, FIFO 손익 계산 |
| 💱 **다중 통화 지원** | 150개 이상의 통화 지원, exchangerate-api.com에서 실시간 환율 제공 |
| 📱 **반응형 디자인** | 데스크톱과 모바일 모두에서 원활하게 작동 |
| 🔒 **엔터프라이즈급 보안** | ChaCha20-Poly1305 데이터베이스 암호화, Helmet 보안 헤더, 요청 제한, CSP |
| 👥 **다중 사용자 관리** | 여러 사용자 지원; 관리자가 회원가입 정책 제어 및 로그인 기록 감사 가능 |
| 🔑 **Google SSO** | OAuth Authorization Code Flow를 통한 선택적 Google 원클릭 로그인 |

---

## 기능 상세

### 대시보드

- 전체 자산 개요 카드 (모든 계좌 잔액 합계)
- 월별 수입 / 지출 요약
- 지출 카테고리 도넛 차트 (이중 링 차트 지원: 내부 링 = 상위 카테고리, 외부 링 = 하위 카테고리)
- 자산 배분 도넛 차트 (계좌 자산 + 주식 시가, 이중 링으로 전환 가능)
- 최근 거래 내역 목록

### 가계부 관리

**거래 내역**
- 메모, 카테고리, 계좌, 통화를 포함한 수입 / 지출 / 이체 CRUD
- 미래 날짜 거래는 "예정" 라벨이 자동으로 붙어 식별 및 필터링 가능
- 다중 선택 일괄 작업: 일괄 삭제, 카테고리 / 계좌 / 날짜 일괄 변경
- `linked_id`를 통한 양방향 자동 매칭으로 계좌 간 이체 지원

**예산 관리**
- 월별 총 예산 + 카테고리별 예산
- 잔여 예산을 실시간으로 표시하는 시각적 진행 막대

**계좌 관리**
- 복수 계좌 (현금, 은행, 신용카드 등)
- 거래 내역에서 자동 계산된 잔액
- 실시간 환율 변환을 적용한 다중 통화 계좌

**환율 설정**
- exchangerate-api.com 연동, 150개 이상의 통화 지원
- 수동 갱신 또는 자동 동기화; 마지막 업데이트 타임스탬프 표시

**카테고리 관리**
- 2단계 부모-자식 카테고리 구조 (예: 식비 → 아침/점심/저녁)
- 사용자 지정 카테고리 색상

**고정 수입/지출**
- 정기적인 수입/지출(임대료, 급여 등)을 설정하면 거래 내역이 자동으로 생성됨

### 주식 기록

**포트폴리오 현황**
- 실시간 시가, 미실현 손익, 수익률 계산
- TWSE에서 실시간/종가 자동 조회 (3단계 전략)
- 종목별 데이터 출처(실시간가/종가)와 타임스탬프를 표시하는 일괄 가격 업데이트

**거래 내역**
- 정수 주식과 소수점 주식을 모두 지원하는 매수/매도 기록
- 자동 계산 수수료 (`0.1425%`, 정수 주식 최소 NT$20)
- 매도 시 자동 계산 증권거래세 (일반 주식 `0.3%`, ETF/워런트 `0.1%`)
- 주식 코드를 입력하면 TWSE를 자동 조회하고 종목을 생성 (수동 추가 불필요)
- 검색/필터, 페이지네이션, 다중 선택 일괄 삭제

**배당금 기록**
- 현금 배당 / 주식 배당 기록
- TWSE에서 배당락 자동 동기화 (`TWT49U` + `TWT49UDetail`), 중복 방지

**실현 손익**
- 매도별 FIFO 방식으로 평균 취득 원가, 실현 손익, 수익률 계산
- 요약 카드: 총 실현 손익, 전체 수익률, 당해 연도 손익

**정액 적립식 투자 (DCA)**
- 주기와 회당 예산을 설정하면 매수 거래가 자동으로 생성됨

### 통계 보고서

- **카테고리 보고서**: 상위 카테고리 도넛 차트, 이중 링으로 전환 가능 (내부 = 상위, 외부 = 하위); 범례와 툴팁에 금액 및 비율 표시
- **추세 분석**: 월별 수입/지출 꺾은선 차트
- **일별 지출**: 일별 지출 막대 차트
- 사용자 지정 날짜 범위 필터

### 계좌 관리

- 복수 계좌 추가, 수정, 삭제
- 각 계좌의 실시간 잔액 표시

### 설정 및 관리자

**계정 설정**
- 표시 이름 및 비밀번호 수정
- 개인 로그인 기록 조회 (최근 100건): 타임스탬프, IP, 국가, 로그인 방법 포함

**데이터 내보내기 및 가져오기**
- 거래 내역 CSV 내보내기/가져오기 (카테고리 구조 포함)
- 주식 거래 내역 CSV 내보내기/가져오기
- 배당금 기록 CSV 내보내기/가져오기

**관리자 기능**
- 공개 회원가입 허용 여부 설정; 이메일 화이트리스트 구성
- 사용자 계정 추가/삭제
- 모든 사용자의 로그인 기록 조회 (실패 시도 포함)
- 페이지 새로고침 없이 로그인 기록 수동 동기화

---

## 기술 스택

| 계층 | 기술 |
|-------|------------|
| 프론트엔드 | Vanilla HTML / CSS / JavaScript (`history.pushState` 기반 SPA) |
| 백엔드 | Node.js + Express |
| 데이터베이스 | SQLite (sql.js, 인메모리 + 파일 영속성) |
| 암호화 | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 |
| 인증 | JWT (Bearer Token) + bcryptjs; Google OAuth Code Flow (선택) |
| 차트 | Chart.js |
| 아이콘 | Font Awesome 6 |
| 보안 | Helmet, express-rate-limit, SRI, CORS 화이트리스트, CSP |

---

## 설치 방법

### 방법 1: Docker Hub 원클릭 배포 (권장)

별도 설정 없이 바로 실행하세요:

```bash
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  es94111/assetpilot:latest
```

[http://localhost:3000](http://localhost:3000)을 열면 바로 사용할 수 있습니다.

> **이게 전부입니다!** 데이터베이스, JWT 키, 암호화 키, 볼륨이 모두 자동으로 생성됩니다.

---

### 방법 2: Docker Compose

`docker-compose.yml` 파일을 생성하세요:

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
      - GOOGLE_CLIENT_ID=          # 선택 사항: SSO를 활성화하려면 Google OAuth Client ID를 입력하세요
      # - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
```

컨테이너를 시작하세요:

```bash
docker compose up -d
```

---

### 방법 3: Node.js 직접 실행

**요구 사항:** Node.js >= 18

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env
# 필요에 따라 .env 파일 수정

# 3. 서버 시작
node server.js
```

[http://localhost:3000](http://localhost:3000)을 열어 앱을 시작하세요.

---

## 환경 변수

| 변수 | 설명 | 기본값 |
|----------|-------------|---------|
| `PORT` | 서버 포트 | `3000` |
| `JWT_SECRET` | JWT 서명 키 (운영 환경에서는 반드시 변경) | Docker에서 자동 생성 |
| `JWT_EXPIRES` | JWT 만료 기간 | `7d` |
| `DB_ENCRYPTION_KEY` | 데이터베이스 암호화 키 | Docker에서 자동 생성 |
| `DB_PATH` | 데이터베이스 파일 경로 | `/app/data/database.db` |
| `ENV_PATH` | 자동 생성 .env 파일 경로 | `/app/data/.env` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (선택) | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret (선택) | — |
| `ALLOWED_ORIGINS` | CORS 화이트리스트, 쉼표로 구분 (비워두면 제한 없음) | — |
| `EXCHANGE_RATE_API_KEY` | exchangerate-api.com API Key (선택) | — |
| `IPINFO_TOKEN` | IP 조회 할당량 증가를 위한 ipinfo.io 토큰 (선택) | — |
| `CHANGELOG_URL` | 원격 changelog.json URL | 기본 GitHub 저장소 URL |

---

## 배포 가이드

### Synology NAS

**방법 A: Container Manager GUI (가장 간편)**

1. DSM → **Container Manager** → **레지스트리** → `es94111/assetpilot` 검색 → 다운로드
2. **컨테이너** → **생성** → `es94111/assetpilot:latest` 선택
3. 포트 설정: `3000 → 3000`; 볼륨은 자동으로 생성됨
4. 컨테이너 시작

**방법 B: SSH 명령어**

```bash
sudo docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /volume1/docker/assetpilot/data:/app/data \
  es94111/assetpilot:latest
```

**리버스 프록시 (사용자 도메인 + HTTPS)**

DSM → **제어판** → **로그인 포털** → **고급** → **리버스 프록시**에서 규칙 추가:

| 항목 | 값 |
|-------|-------|
| 소스 프로토콜 | HTTPS |
| 소스 호스트명 | `your-domain.com` |
| 소스 포트 | 443 |
| 대상 프로토콜 | HTTP |
| 대상 호스트명 | `localhost` |
| 대상 포트 | `3000` |

사용자 지정 헤더 추가: `X-Forwarded-For` → `$proxy_add_x_forwarded_for`

---

### 클라우드 VPS

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

### Nginx 리버스 프록시

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

### Caddy 리버스 프록시

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy는 HTTPS 인증서를 자동으로 발급하고 갱신합니다.

---

## Google SSO 설정

1. [Google Cloud Console](https://console.cloud.google.com/)로 이동하여 OAuth 2.0 Client ID 생성 (유형: 웹 애플리케이션)
2. **승인된 JavaScript 출처** 설정:
   - 로컬: `http://localhost:3000`
   - 운영: `https://your-domain.com`
3. **승인된 리디렉션 URI** 설정:
   - 로컬: `http://localhost:3000/`
   - 운영: `https://your-domain.com/`
4. `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`을 환경 변수로 설정하고 재시작
5. 설정하지 않으면 Google 로그인 버튼이 자동으로 숨겨지며 비밀번호 로그인에는 영향 없음

> ⚠️ 로그인 후 `/?code=...`에서 멈추는 경우, Google Console의 리디렉션 URI가 도메인과 정확히 일치하는지 확인하세요 (`https://`와 마지막 `/` 포함).

---

## 사용 가이드

### 최초 설정

1. 브라우저에서 `http://localhost:3000`으로 이동
2. **"지금 가입하기"**를 클릭하여 계정 생성
3. **최초 가입 사용자가 자동으로 관리자가 됩니다**
4. 기본 카테고리(식비, 의류, 주거, 교통 등)와 계좌(현금, 은행 계좌)가 자동으로 생성됨
5. 로그인 후 바로 사용 시작 가능

---

### 거래 내역 추가

1. 사이드바에서 **"가계부"** 클릭
2. 우측 상단의 **"+ 거래 추가"** 클릭
3. 날짜, 유형(수입/지출/이체), 금액, 카테고리, 계좌 입력
4. 선택적으로 메모와 통화 추가
5. **"저장"** 클릭

**일괄 작업:** 체크박스로 여러 거래를 선택한 후, 작업 표시줄을 사용하여 일괄 삭제 또는 카테고리/계좌/날짜를 일괄 변경할 수 있습니다.

---

### 신용카드 결제 가이드

신용카드로 결제할 때는 신용카드를 계좌로 하여 **지출**로 기록하면, 잔액이 마이너스가 될 수 있습니다(실제 부채를 반영).

**신용카드 대금 결제 시:**

1. **가계부** → **거래 추가**
2. 유형을 **이체**로 설정
3. 출금 계좌: **은행 계좌**
4. 입금 계좌: **신용카드 계좌**
5. 결제 금액을 입력하고 저장

이렇게 하면 은행 잔액에서 차감되고 신용카드의 마이너스 잔액이 상쇄되며, 지출로 이중 계산되지 않습니다.

---

### 주식 관리

**주식 보유 추가**

1. **주식 기록** → **거래 내역** → **+ 주식 거래 추가**
2. 주식 코드 입력 (예: `2330`); 시스템이 TWSE를 자동 조회하여 종목명과 현재가를 입력
3. 매수일, 주수, 거래가 입력
4. 수수료와 거래세가 자동 계산됨 (수정 가능)
5. 저장 후 포트폴리오에 포지션이 추가됨

**주가 업데이트**

포트폴리오 페이지에서 **"가격 업데이트"**를 클릭하면, 시스템이 3단계 전략으로 최신 가격을 조회합니다:
- 거래 시간 중 → TWSE 실시간 가격
- 장 마감 후 → STOCK_DAY 종가
- 기타 시간 → STOCK_DAY_ALL 대체

**배당락 동기화**

**배당금 기록** → **배당락 동기화** — 보유 기간을 기준으로 현금 배당과 주식 배당을 자동으로 추가합니다 (중복 방지).

---

### 환율 관리

1. **가계부** → **계좌 관리** → **환율 설정**
2. **"지금 실시간 환율 가져오기"**를 클릭하여 수동 동기화
3. 또는 **"환율 자동 업데이트"**를 활성화하여 페이지 진입 시 자동 동기화
4. 3자리 통화 코드로 사용자 지정 통화 추가 가능

---

### CSV 내보내기 및 가져오기

**경로:** **설정** → **데이터 내보내기 및 가져오기**

| 유형 | 내보내기 항목 |
|------|----------------|
| 거래 내역 | 날짜, 유형, 금액, 통화, 카테고리, 계좌, 메모 |
| 주식 거래 내역 | 날짜, 코드, 종목명, 유형(매수/매도), 주수, 가격, 수수료, 세금, 계좌, 메모 |
| 배당금 기록 | 날짜, 코드, 종목명, 현금 배당, 주식 배당, 메모 |

**가져오기 참고사항:** 주식 코드가 존재하지 않으면 가져오기 시 자동으로 생성됩니다. 종목명이 잘못된 경우, CSV의 종목명으로 자동 업데이트됩니다.

---

### 관리자 기능

**경로:** **설정** → **관리자**

| 기능 | 설명 |
|---------|-------------|
| 공개 회원가입 허용 설정 | 누구나 자가 가입할 수 있는지 여부 제어 |
| 이메일 화이트리스트 | 화이트리스트에 있는 이메일만 가입 허용 (한 줄에 하나씩) |
| 계정 추가 | 새 사용자를 직접 생성, 선택적으로 관리자로 지정 |
| 계정 삭제 | 사용자와 모든 관련 데이터를 영구 삭제 |
| 로그인 감사 | 모든 사용자의 로그인 타임스탬프, IP, 국가, 성공/실패 여부 조회 |

---

## Docker 고급 관리

### 이미지 정보

| 항목 | 값 |
|------|-------|
| Docker Hub | [`es94111/assetpilot`](https://hub.docker.com/r/es94111/assetpilot) |
| 지원 아키텍처 | `linux/amd64`, `linux/arm64` |
| 베이스 이미지 | `node:24-alpine` |
| 이미지 크기 | ~180 MB |
| 헬스 체크 | 30초마다 자동 확인 |

### 볼륨 및 데이터 영속성

컨테이너 내부의 `/app/data` 디렉터리에 모든 영속 데이터가 저장됩니다:

```
/app/data/
├── database.db    # 암호화된 SQLite 데이터베이스
└── .env           # 자동 생성된 키 (JWT_SECRET, DB_ENCRYPTION_KEY)
```

**세 가지 마운트 옵션:**

```bash
# 1. 익명 볼륨 (가장 간단)
docker run -d -p 3000:3000 es94111/assetpilot:latest

# 2. 네임드 볼륨 (권장, 관리 편의)
docker run -d -p 3000:3000 -v assetpilot-data:/app/data es94111/assetpilot:latest

# 3. 바인드 마운트 (파일 직접 접근)
docker run -d -p 3000:3000 -v /path/to/data:/app/data es94111/assetpilot:latest
```

### 백업 및 복원

```bash
# 백업
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/assetpilot-backup.tar.gz -C /data .

# 복원
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar xzf /backup/assetpilot-backup.tar.gz -C /data
```

> ⚠️ **중요:** 볼륨을 삭제하면 데이터베이스와 암호화 키가 영구적으로 손실됩니다. 삭제하기 전에 반드시 백업하세요.

### 자주 사용하는 관리 명령어

```bash
# 컨테이너 상태 확인 (헬스 체크 포함)
docker ps

# 실시간 로그 확인
docker logs -f assetpilot

# 중지 / 재시작
docker stop assetpilot
docker restart assetpilot

# 최신 버전으로 업데이트
docker pull es94111/assetpilot:latest
docker rm -f assetpilot
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v assetpilot-data:/app/data \
  es94111/assetpilot:latest
```

### 직접 이미지 빌드

```bash
docker build -t assetpilot .

docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  assetpilot
```

---

## 보안

| 메커니즘 | 설명 |
|-----------|-------------|
| **데이터베이스 암호화** | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 키 파생 |
| **비밀번호 해싱** | bcryptjs 해시 저장 — 비밀번호는 평문으로 저장되지 않음 |
| **XSS 방지** | 모든 사용자 입력은 DOM에 삽입되기 전에 `escHtml()`로 이스케이프 처리 |
| **보안 헤더** | Helmet (HSTS, X-Content-Type-Options, Referrer-Policy) |
| **CSP 보호** | 인라인 스크립트 차단; 스크립트 및 리소스 출처 제한 |
| **요청 제한** | 로그인/가입 API는 IP당 15분에 20회로 제한 |
| **CORS 제어** | `ALLOWED_ORIGINS`로 허용된 출처 도메인 제한 |
| **OAuth State 검증** | Google 로그인은 CSRF/재전송 공격 방지를 위한 일회용 state 토큰 사용 |
| **SRI 검증** | 외부 CDN 스크립트(Font Awesome, Chart.js)에 integrity 속성 포함 |
| **속성 주입 방지** | 계좌 아이콘 필드는 화이트리스트로 검증 (`fa-*`만 허용) |
| **로그인 감사** | 로그인 타임스탬프, IP, 국가, 방법 기록; 관리자는 실패 시도 조회 가능 |
| **헬스 체크** | Docker HEALTHCHECK로 30초마다 서비스 상태 자동 감지 |

---

## 파일 구조

```
├── server.js              # Express 백엔드 (API + 데이터베이스)
├── app.js                 # 프론트엔드 SPA 로직 (IIFE 모듈)
├── index.html             # 단일 페이지 HTML (모든 페이지 + 모달)
├── style.css              # 전역 스타일
├── logo.svg               # 웹사이트 로고 (로그인 페이지)
├── favicon.svg            # Favicon + 사이드바 로고
├── changelog.json         # 버전 업데이트 기록
├── Dockerfile             # Docker 빌드 설정
├── docker-compose.yml     # Docker Compose 설정
├── .env.example           # 환경 변수 템플릿
├── .gitignore             # Git 무시 목록
├── SRS.md                 # 소프트웨어 요구사항 명세서
├── .github/workflows/
│   └── docker-publish.yml # CI/CD 자동 빌드 및 푸시
└── data/                  # 데이터 디렉터리 (Docker Volume 마운트)
    ├── database.db        # 암호화된 SQLite 데이터베이스 (자동 생성)
    └── .env               # 키 파일 (자동 생성)
```

---

## API 출처

| 서비스 | 용도 | 링크 |
|---------|---------|------|
| **TWSE OpenAPI** | 대만 주식 실시간 가격 및 배당락 데이터 | [openapi.twse.com.tw](https://openapi.twse.com.tw/) |
| **exchangerate-api.com** | 글로벌 실시간 환율 (기준 통화: TWD) | [exchangerate-api.com](https://www.exchangerate-api.com/) |
| **Google Identity Services** | Google SSO 로그인 | [developers.google.com/identity](https://developers.google.com/identity) |
| **IPinfo Lite** | IP 국가 조회 | [ipinfo.io/lite](https://ipinfo.io/lite) |

IP 주소 데이터는 IPinfo가 제공합니다.

---

## 라이선스

[GNU AGPL v3](LICENSE)

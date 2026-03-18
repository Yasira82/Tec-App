## TEC Ecosystem - 24 App Digital Platform

![TEC Platform](https://img.shields.io/badge/TEC-Platform-gold)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![License](https://img.shields.io/badge/License-MIT-green)

**TEC** (The Ecosystem Core) is a comprehensive digital platform built on the Pi Network ecosystem, offering 24 integrated applications for finance, commerce, real estate, and more.

## 🏗️ Architecture

TEC Platform follows a microservices architecture with the following components:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│              (Next.js 14 App Router Frontend)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway (Port 3000)                  │
│        Rate Limiting • Logging • Request Routing             │
└────────────┬───────────────┬───────────────┬────────────────┘
             │               │               │
    ┌────────▼────┐  ┌──────▼──────┐  ┌────▼─────────┐
    │ Auth Service│  │   Wallet    │  │   Payment    │
    │  (Port 5001)│  │   Service   │  │   Service    │
    │             │  │ (Port 5002) │  │ (Port 5003)  │
    └──────┬──────┘  └──────┬──────┘  └──────┬───────┘
           │                │                │
           └────────────────┼────────────────┘
                            ▼
                ┌───────────────────────┐
                │  PostgreSQL Database  │
                │     (Port 5432)       │
                └───────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose (recommended)
- Node.js 18+ (for local development)
- PostgreSQL 15+ (for local development)

### Environment Setup

1. **Clone the repository:**
```bash
git clone https://github.com/Yasser1728/Tec-App.git
cd Tec-App
```

2. **Set up environment variables:**
```bash
# Required secrets
export POSTGRES_PASSWORD="your_secure_password"
export JWT_SECRET="your_jwt_secret_key_min_32_chars"
export JWT_REFRESH_SECRET="your_refresh_secret_key_min_32_chars"

# Pi Network integration (required for payment processing)
export PI_API_KEY="your_pi_network_api_key"      # from https://developers.minepi.com
export PI_APP_ID="tec-app-de161fa2243c797b"        # from https://developers.minepi.com

# Environment (sandbox = Pi Sandbox, production = mainnet)
export PI_SANDBOX="true"                         # 'false' for Mainnet/Production
export NEXT_PUBLIC_PI_SANDBOX="true"             # frontend counterpart

# Optional
export NODE_ENV="production"
export CORS_ORIGIN="http://localhost:3000"
```

> **⚠️ Important for Payment Service:**
> - **`DATABASE_URL`**: Required for payment processing. Automatically set by docker-compose from `POSTGRES_PASSWORD`.
> - **`CORS_ORIGIN`**: Must match your frontend URL. Use `http://localhost:3000` for local development and your production URL (e.g., `https://tec-app.vercel.app`) in production.
> - **`PI_API_KEY`** and **`PI_APP_ID`**: Required for Pi Network payment integration. Obtain both from [Pi Developer Portal](https://developers.minepi.com/).
> - **`PI_SANDBOX`** / **`NEXT_PUBLIC_PI_SANDBOX`**: Set to `'true'` for Sandbox and `'false'` for Mainnet (production).
>
> If the payment service fails to start or returns database errors, verify these environment variables are correctly set.

3. **Start the platform:**
```bash
docker-compose up -d
```

4. **Access the services:**
- **API Gateway:** http://localhost:3000
- **Frontend:** Deploy separately (Next.js app in `tec-frontend/`)
- **Health checks:** 
  - http://localhost:3000/health (API Gateway)
  - http://localhost:5001/health (Auth Service)
  - http://localhost:5002/health (Wallet Service)
  - http://localhost:5003/health (Payment Service)

## 🥧 Pi Sandbox Setup

| Item | Value |
|------|-------|
| Pi App ID | `tec-app-de161fa2243c797b` |
| Pi Sandbox App URL | `https://sandbox.minepi.com/app/tec-app-de161fa2243c797b` |

**Allowed domains (configure in Pi Developer Portal):**
- `https://tec-app.vercel.app`
- `https://sandbox.minepi.com/app/tec-app-de161fa2243c797b`
- `https://api-gateway-production-6a68.up.railway.app`

**Frontend environment variables (`tec-frontend/.env.local`):**
```
NEXT_PUBLIC_PI_APP_ID=tec-app-de161fa2243c797b
NEXT_PUBLIC_PI_APP_URL=https://sandbox.minepi.com/app/tec-app-de161fa2243c797b
NEXT_PUBLIC_PI_SANDBOX=true
NEXT_PUBLIC_API_GATEWAY_URL=https://api-gateway-production-6a68.up.railway.app
# NEXT_PUBLIC_PI_SDK_TIMEOUT=35000   # increase for slow networks
```

**Backend environment variables (`.env`):**
```
PI_APP_ID=tec-app-de161fa2243c797b
PI_SANDBOX=true
PI_API_KEY=                          # obtain from https://developers.minepi.com
PI_TEST_WALLET=                      # your test wallet address
```

## 🧪 Pi Sandbox Test Flow

A dedicated test page is available at **`/pi-test`** to verify the full auth + payment flow end-to-end without touching production data.

### How to use

1. Open the app inside **Pi Browser** (the SDK is only available there).
2. Navigate to `/pi-test` (e.g. `https://tec-app.vercel.app/pi-test`).
3. Click **"Authenticate with Pi"** — watch the log panel for `[AUTH]` events.
4. Once authenticated, click **"Pay 0.001 Pi (test)"** — the log panel shows each callback:
   - `onReadyForServerApproval` → POST `/api/payments/approve`
   - `onReadyForServerCompletion` → POST `/api/payments/complete`
   - `onCancel` / `onError` → logged with details

### Required env vars for the test page

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_PI_APP_ID` | Passed to `Pi.init({ appId })` |
| `NEXT_PUBLIC_PI_APP_URL` | Sandbox deep-link URL (informational) |
| `NEXT_PUBLIC_PI_SANDBOX` | `true` → sandbox mode, `false` → mainnet |
| `NEXT_PUBLIC_API_GATEWAY_URL` | Backend gateway for approve/complete callbacks |
| `NEXT_PUBLIC_PI_SDK_TIMEOUT` | *(optional)* SDK load timeout in ms (default 25 000) |

### Allowed domains

Register the following in the [Pi Developer Portal](https://developers.minepi.com) under your app's **Allowed Domains**:

- `https://tec-app.vercel.app`
- `http://localhost:3001` *(local dev)*

## 📡 API Endpoints

### Authentication Service (`/api/auth/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |

### Wallet Service (`/api/wallets/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallets?userId={id}` | Get user wallets |
| POST | `/api/wallets/link` | Link new wallet |
| GET | `/api/wallets/{id}/balance` | Get wallet balance |
| GET | `/api/wallets/{id}/transactions` | Get transactions (paginated) |

### Payment Service (`/api/payments/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/create` | Create payment |
| POST | `/api/payments/approve` | Approve payment |
| POST | `/api/payments/complete` | Complete payment |
| POST | `/api/payments/cancel` | Cancel payment |
| POST | `/api/payments/fail` | Record payment failure |
| GET | `/api/payments/{id}/status` | Get payment status |

#### Payment Workflow

The payment service implements a five-state payment lifecycle:

1. **Create** (`POST /api/payments/create`): Initiates a payment with user ID, amount, and payment method.
   - Required fields: `userId` (UUID), `amount` (> 0), `payment_method` (pi/card/wallet)
   - Optional: `currency` (default: PI), `metadata` (JSON object)

2. **Approve** (`POST /api/payments/approve`): Approves a created payment, typically after user confirmation.
   - Required: `payment_id` (UUID)
   - Optional: `pi_payment_id` (for Pi Network payments)

3. **Complete** (`POST /api/payments/complete`): Finalizes an approved payment with transaction details.
   - Required: `payment_id` (UUID)
   - Optional: `transaction_id` (blockchain transaction ID)

4. **Cancel** (`POST /api/payments/cancel`): Cancels a payment that is in `created` or `approved` state.
   - Required: `payment_id` (UUID)
   - Records `cancelled_at` timestamp in the database.

5. **Fail** (`POST /api/payments/fail`): Records a payment failure for a `created` or `approved` payment.
   - Required: `payment_id` (UUID)
   - Optional: `reason` (failure description, stored in metadata)
   - Records `failed_at` timestamp in the database.

#### Error Codes

The payment service returns specific error codes for better debugging:
- `VALIDATION_ERROR`: Invalid input data (check field details)
- `NOT_FOUND`: Payment not found
- `INVALID_STATUS`: Payment cannot transition from current status
- `INVALID_USER`: User ID does not exist
- `DATABASE_UNAVAILABLE`: Database connection failed (check `DATABASE_URL`)
- `DUPLICATE_PAYMENT`: Payment already exists
- `DUPLICATE_PI_PAYMENT`: Pi payment ID already in use
- `PAYMENT_MODIFIED`: Payment was modified or deleted concurrently

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Pi SDK** - Pi Network integration
- **i18n** - Multi-language support (EN/AR)

### Backend Services
- **Express.js** - Web framework
- **TypeScript** - Type-safe APIs
- **Prisma ORM** - Database toolkit
- **PostgreSQL** - Primary database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **nginx** - Reverse proxy (optional)

### Security
- **Helmet.js** - Security headers
- **CORS** - Cross-origin protection
- **Rate Limiting** - DDoS protection (100 req/15min)
- **JWT Secrets** - Required environment variables

## 📦 Project Structure

```
Tec-App/
├── tec-frontend/              # Next.js 14 frontend
│   ├── app/                   # App Router pages
│   ├── components/            # React components
│   ├── lib/                   # Utilities (i18n, Pi SDK)
│   └── types/                 # TypeScript types
├── tec-api-gateway/           # API Gateway service
│   ├── src/
│   │   ├── routes/            # Proxy routes
│   │   └── middleware/        # Rate limiting, logging
│   └── Dockerfile
├── tec-auth-service/          # Authentication service
│   ├── src/
│   │   ├── controllers/       # Request handlers
│   │   ├── routes/            # API routes
│   │   ├── middleware/        # Auth middleware
│   │   ├── utils/             # JWT, hashing
│   │   └── config/            # Database config
│   └── Dockerfile
├── tec-wallet-service/        # Wallet management service
│   ├── src/
│   │   ├── controllers/       # Wallet operations
│   │   └── routes/            # Wallet routes
│   └── Dockerfile
├── tec-payment-service/       # Payment processing service
│   ├── src/
│   │   ├── controllers/       # Payment workflow
│   │   └── routes/            # Payment routes
│   └── Dockerfile
├── prisma/                    # Database schema & migrations
│   └── schema.prisma
├── shared/                    # Shared TypeScript types
│   └── types/
├── docker-compose.yml         # Service orchestration
└── README.md
```

## 🩺 Health Check & Backend Status

The frontend includes a built-in health check system that monitors backend availability and surfaces issues to users immediately.

### How It Works

1. **`tec-frontend/src/lib/health-check.ts`** — Core utility that calls `GET ${NEXT_PUBLIC_API_GATEWAY_URL}/health` with a 5-second timeout and returns a `HealthStatus` object (`online`, `status`, `services`, `error`).

2. **`tec-frontend/src/hooks/useBackendHealth.ts`** — React hook (`useBackendHealth(intervalMs?)`) that components use to subscribe to backend health state. Optionally polls on a configurable interval.

3. **`tec-frontend/src/components/BackendOfflineBanner.tsx`** — Client component rendered in the root layout that displays a red warning banner when the backend is unreachable. Polls every 30 seconds and provides a **Retry** button to recheck immediately.

### Backend Downtime Behavior

- On initial page load the frontend silently checks the gateway health endpoint.
- If the backend is offline, a `⚠️ Backend Offline` banner appears at the top of every page.
- The banner auto-clears once the backend comes back online (next 30-second poll or after clicking **Retry**).
- Auth and payment operations remain available in the UI but will fail gracefully with error messages if the backend is unreachable.

### Gateway Health Endpoint

- **URL:** `https://api-gateway-production-6a68.up.railway.app/health`
- **Method:** `GET`
- **Success response:** `{ "status": "ok" | "degraded", "services": { ... } }`

## 🔐 Security Features

- **JWT-based authentication** with access and refresh tokens
- **bcryptjs password hashing** (10 salt rounds)
- **Required secrets** - Application fails on startup if JWT secrets missing
- **Rate limiting** at API Gateway (100 requests per 15 minutes)
- **CORS protection** with configurable origins
- **Helmet.js** security headers
- **Input validation** with express-validator
- **Prisma parameterized queries** preventing SQL injection
- **Docker health checks** for all services

## 🗄️ Database Schema

### Core Models
- **User** - Authentication and profile
- **Session** - JWT session tracking
- **Wallet** - Multi-wallet support (Pi/Crypto/Fiat)
- **Transaction** - Transaction history
- **Payment** - Payment processing
- **Plan** - Subscription plans
- **Subscription** - User subscriptions
- **Device** - Trusted device management

### Relationships
- User → Sessions[], Wallets[], Payments[], Subscriptions[]
- Wallet → Transactions[]
- Plan → Subscriptions[]

## 🧪 Development

### Run services locally:

```bash
# Install dependencies for each service
cd tec-api-gateway && npm install
cd tec-auth-service && npm install
cd tec-wallet-service && npm install
cd tec-payment-service && npm install

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start services in dev mode
npm run dev
```

### Run frontend tests locally:

The frontend uses [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) for unit/component tests.

```bash
cd tec-frontend

# Install dependencies
npm ci

# Run tests (headless, single pass)
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Also available: lint, typecheck, format
npm run lint
npm run typecheck
npm run format
```

Test files live in `tec-frontend/src/__tests__/`:
- `homepage.test.tsx` — smoke test for the HomePage component
- `usePiAuth.test.ts` — unit tests for the `usePiAuth` hook (Pi SDK mocked)
- `usePiPayment.test.ts` — unit tests for the `usePiPayment` hook (Pi SDK mocked)

The CI workflow (`.github/workflows/frontend-ci.yml`) runs `lint → typecheck → test` automatically on every pull request that touches `tec-frontend/`.

### Build for production:

```bash
# Build all services
docker-compose build

# Start in production mode
docker-compose up -d
```

## 📝 Environment Variables

### Required
- `POSTGRES_PASSWORD` - PostgreSQL password
- `JWT_SECRET` - JWT access token secret (min 32 chars)
- `JWT_REFRESH_SECRET` - JWT refresh token secret (min 32 chars)

### Pi Network (Required for Payment Integration)
- `PI_API_KEY` - Pi Network server-side API key (from [developers.minepi.com](https://developers.minepi.com))
- `PI_APP_ID` - Pi App identifier (from [developers.minepi.com](https://developers.minepi.com))
- `PI_SANDBOX` - `'true'` for Sandbox, `'false'` for Mainnet (production)
- `NEXT_PUBLIC_PI_SANDBOX` - Frontend counterpart; `'true'` for Sandbox

### Optional
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed CORS origins
- `RATE_LIMIT_WINDOW_MS` - Rate limit window (default: 900000)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)
- `NEXT_PUBLIC_PI_SDK_TIMEOUT` - Pi SDK load timeout in ms (default: 25000)
- `NEXT_PUBLIC_PI_AUTH_TIMEOUT` - Pi auth timeout in ms (default: 45000)
- `NEXT_PUBLIC_PI_APPROVAL_TIMEOUT` - Payment approval stage timeout in ms (default: 180000)
- `NEXT_PUBLIC_PI_COMPLETION_TIMEOUT` - Payment completion stage timeout in ms (default: 180000)

## 🌍 The 24 Apps

1. **Nexus** - Social networking
2. **Commerce** - E-commerce platform
3. **Assets** - Asset management
4. **Fundx** - Investment platform
5. **Estate** - Real estate marketplace
6. **Analytics** - Business intelligence
7. **Connection** - Professional networking
8. **Life** - Lifestyle services
9. **Insure** - Insurance platform
10. **Vip** - Premium services
11. **Zone** - Geographic services
12. **Explorer** - Discovery platform
13. **Alert** - Notification system
14. **System** - System management
15. **Ecommerce** - Online shopping
16. **Dx** - Developer tools
17. **Nx** - Network utilities
18. **Nbf** - Financial services
19. **Epic** - Gaming platform
20. **Legend** - Achievement tracking
21. **Titan** - Enterprise solutions
22. **Elite** - Premium memberships
23. **Brookfield** - Property management
24. **TEC** - Core platform (this)

## 📄 License

MIT License - see LICENSE file for details

## 🐛 Troubleshooting

Encountering issues with GitHub Actions or workflows? Check our [Troubleshooting Guide](.github/TROUBLESHOOTING.md) for common problems and solutions.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

- **GitHub:** [@Yasser1728](https://github.com/Yasser1728)
- **Project:** [Tec-App](https://github.com/Yasser1728/Tec-App)

---

Built with ❤️ for the Pi Network Ecosystem

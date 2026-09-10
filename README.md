# ReachInbox Email Scheduler

A production-grade email scheduling platform built with TypeScript, Express.js, BullMQ, Redis, PostgreSQL (Prisma), Elasticsearch, and React (Vite + Tailwind CSS).

## Repository Structure

```
.
├── backend/            # Express.js + Prisma + BullMQ API Server
│   ├── prisma/         # Database schema & migrations
│   └── src/
│       ├── config/     # Environment, Redis, & Bull Board configurations
│       ├── controllers/# API route controllers (Thin request handlers)
│       ├── services/   # Business logic layer (Scheduling, Rate-Limiting, Email, Slack)
│       ├── routes/     # Express route definitions
│       ├── queues/     # BullMQ queues & worker definitions
│       ├── jobs/       # Job processors & lifecycle handlers
│       ├── middlewares/# Global middlewares (auth, validation, errors)
│       ├── models/     # Prisma database access models
│       ├── utils/      # Utility helpers
│       └── types/      # TypeScript type declarations
├── frontend/           # Vite + React + Tailwind CSS Dashboard
│   └── src/
│       ├── api/        # Typed API clients
│       ├── components/ # Reusable UI components
│       ├── pages/      # Application pages (Login, Dashboard)
│       ├── hooks/      # React hooks (React Query wrappers)
│       ├── context/    # Global context providers
│       └── types/      # UI TypeScript definitions
└── docker-compose.yml  # Local infrastructure (Postgres, Redis, Elasticsearch)
```

## Architecture

### Queue Engine & Restart Persistence
Traditional email schedulers rely on OS cron or `node-cron` timers that poll database tables every minute. This approach does not scale across multiple process instances, suffers from race conditions, and misses executions if the process is down at the trigger instant.

ReachInbox Email Scheduler uses **BullMQ backed by Redis sorted sets (`zset`)**:
1. **At-Time Scheduling**: When an email is scheduled, BullMQ inserts a job entry into Redis indexed by its absolute target timestamp (`scheduledAt`).
2. **Process Independence**: Redis acts as the persistent state storage. If the Node.js application process restarts, crashes, or scales to multiple worker replicas, no jobs are lost or duplicated.
3. **Automatic Recovery**: Upon backend restart, BullMQ workers reconnect to Redis, evaluate delayed jobs against current server time, and immediately process any jobs whose trigger time passed during downtime.
4. **Idempotency & Deduplication**: Each email job uses a deterministic `jobId` derived from database IDs (`email-job-<uuid>`). BullMQ enforces uniqueness in Redis, preventing duplicate job creation even under retries or repeated API calls.

### Rate Limiting & Concurrency Architecture

#### 1. Disambiguating the Two "Delay" Knobs
To avoid confusion between batch sequencing and global worker throttling:
- **`delayMs` (Per-Batch Stagger Interval)**: Passed in the request body of `POST /api/emails/schedule`. Controls the scheduled spread across emails in a single batch (e.g. email 1 at `t=0`, email 2 at `t=delayMs`, email 3 at `t=2*delayMs`).
- **`MIN_DELAY_MS_BETWEEN_SENDS` (Global Worker Throttle)**: An environment variable passed to BullMQ's native worker `limiter: { max: 1, duration: MIN_DELAY_MS_BETWEEN_SENDS }`. Enforces a strict minimum spacing between any two outgoing SMTP socket operations across all concurrent workers, preventing burst flooding of SMTP servers regardless of batch sizes.

#### 2. Redis Atomic Hourly Cap Per Sender (Race-Condition Free)
- **Key Pattern**: `rate:{senderId}:{YYYY-MM-DDTHH}` (UTC hourly bucket).
- **Atomic Execution**: Follows the **unconditional INCR-first pattern** (`currentCount = await redis.incr(key)`). If `currentCount > limit`, the job is immediately rescheduled for the next hour window. This completely eliminates check-then-increment race conditions where multiple concurrent workers might read the same count and simultaneously over-send.
- **Order-Preserving Rescheduling**: When a limit is breached, jobs are **never failed or dropped**. Instead, jobs are deferred to the start of the next hour window (`YYYY-MM-DDTHH+1:00:00.000Z`) with incremental stagger offsets (`staggerOffset = index * MIN_DELAY_MS_BETWEEN_SENDS`), preserving original queue order.
- **Real-Time Slack Alerts**: When the cap is breached, the worker queries PostgreSQL for an active `SlackIntegration` and posts an alert to the user's workspace. If no integration is connected, it gracefully no-ops without error.

---

## Slack Integration Setup

To connect your Slack workspace for rate limit alerts:
1. Visit [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** > **From scratch**.
2. Navigate to **OAuth & Permissions** in the sidebar.
3. Under **Bot Token Scopes**, add:
   - `chat:write`
   - `chat:write.public`
4. Under **Redirect URLs**, add:
   - `http://localhost:5000/api/slack/callback`
5. Click **Install to Workspace** and authorize.
6. Copy the **Client ID** and **Client Secret** into `backend/.env`:
   ```env
   SLACK_CLIENT_ID=your_slack_client_id
   SLACK_CLIENT_SECRET=your_slack_client_secret
   SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback
   ```
7. Click **Connect Slack** in the app or visit `http://localhost:5000/api/slack/connect`.

---

## Tech Stack

- **Backend**: Node.js, TypeScript, Express.js, Prisma ORM, PostgreSQL, BullMQ, Redis, Bull Board, Elasticsearch, Ethereal Email, Passport.js (Google OAuth 2.0), Slack Web API.
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, TanStack React Query, React Router v6.
- **Infra**: Docker Compose.

## Prerequisites

- Node.js (v18+ recommended)
- Docker & Docker Desktop
- npm or yarn

## Getting Started

### 1. Infrastructure Setup
Start PostgreSQL, Redis, and Elasticsearch using Docker Compose:
```bash
docker compose up -d
```

### 2. Backend Setup
Navigate to `backend/`, install dependencies, set up environment variables, run migrations, and boot the server:
```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```
- API Server: `http://localhost:5000`
- Bull Board Queue Dashboard: `http://localhost:5000/admin/queues`

### 3. Frontend Setup
Navigate to `frontend/`, install dependencies, and start the development server:
```bash
cd frontend
npm install
npm run dev
```

---

## Google OAuth Setup

To enable real Google login (optional — dev-token works without this):
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** (type: Web Application).
3. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`.
4. Copy Client ID & Secret into `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```
5. Restart the backend — `GET /api/auth/google` will redirect to Google's consent screen.

---

## Deliverable Checklist
- [x] Monorepo layout (`backend/`, `frontend/`, `docker-compose.yml`)
- [x] Docker Compose setup for PostgreSQL, Redis, and Elasticsearch with healthchecks
- [x] Backend TypeScript + Express.js setup with MVC architecture
- [x] Prisma database schema & migration (`User`, `Sender`, `SlackIntegration`, `EmailJob`)
- [x] BullMQ Queue (`emailQueue`) + Worker setup with configurable concurrency
- [x] Bull Board Express Dashboard mounted at `/admin/queues`
- [x] Process restart persistence & idempotency verification
- [x] Real Email Scheduling API (`POST /api/emails/schedule`, `GET /api/emails/scheduled`, `GET /api/emails/sent`)
- [x] Multi-recipient CSV upload parsing via Multer (backend) + file picker UI (frontend)
- [x] Ethereal Email SMTP delivery with preview URLs
- [x] Redis-backed atomic hourly rate limiter per sender (INCR-first, race-condition free)
- [x] Next-hour order-preserving staggered rescheduling for over-limit emails
- [x] Real-time Slack rate-limit alert notifications with graceful fallback
- [x] Fail-fast environment variable validation with Zod
- [x] Health check endpoint `GET /api/health`
- [x] Elasticsearch index with explicit field mapping (`emails` index)
- [x] Email indexing on PENDING schedule, SENT, and FAILED status transitions
- [x] Full-text search API `GET /api/emails/search?q=...` (multi-match + wildcard + fuzzy)
- [x] Google OAuth 2.0 via Passport.js (`GET /api/auth/google`, callback, `/api/auth/me`)
- [x] JWT sessions in httpOnly cookies (`Secure`, `SameSite: lax`)
- [x] `authGuard` middleware protecting `/api/emails` and `/api/slack` routes
- [x] Dev quick-login endpoint (`POST /api/auth/dev-token`) for testing without GCP credentials
- [x] Frontend React + Vite + TypeScript with Tailwind CSS & TanStack React Query
- [x] Auth context with session restore, Google login, dev login, and logout
- [x] Protected `/dashboard` route with ProtectedRoute guard
- [x] Login page with Google OAuth button and dev quick-login
- [x] Dashboard with stats bar, schedule form, tabbed email list (scheduled/sent/failed)
- [x] Elasticsearch live search panel with 350ms debounce
- [x] CSV/TXT file upload in schedule form with client-side recipient count detection
- [x] Auto-refresh of scheduled email list every 10 seconds

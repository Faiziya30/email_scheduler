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
- **Worker Concurrency**: Driven by `WORKER_CONCURRENCY` (default `5`), allowing parallel execution without thread starving.
- **Minimum Inter-Send Delay**: Configured via BullMQ's native worker `limiter` option (`max: 1, duration: MIN_DELAY_MS_BETWEEN_SENDS`), enforcing a uniform gap between outgoing SMTP connections.
- **Redis Atomic Hourly Cap Per Sender**:
  - Key format: `rate:{senderId}:{YYYY-MM-DDTHH}`.
  - Increment: Atomic `INCR` with a 2-hour TTL (`EXPIRE`). Multi-process and multi-worker safe.
  - Rescheduling Behavior: When a sender's cap (`MAX_EMAILS_PER_HOUR_PER_SENDER`) is reached, jobs are **never failed or dropped**. Instead, jobs are deferred to the beginning of the next hour window (`YYYY-MM-DDTHH+1:00:00.000Z`) with incremental staggering (`+ 1000ms * n`), preserving original dispatch order.
- **Real-Time Slack Alerts**: The moment a sender's hourly limit is reached, a live alert is posted to the user's integrated Slack workspace.

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

## Deliverable Checklist
- [x] Monorepo layout (`backend/`, `frontend/`, `docker-compose.yml`)
- [x] Docker Compose setup for PostgreSQL, Redis, and Elasticsearch with healthchecks
- [x] Backend TypeScript + Express.js setup with MVC architecture
- [x] Prisma database schema & migration (`User`, `Sender`, `SlackIntegration`, `EmailJob`)
- [x] BullMQ Queue (`emailQueue`) + Worker setup with configurable concurrency
- [x] Bull Board Express Dashboard mounted at `/admin/queues`
- [x] Process restart persistence & idempotency verification
- [x] Real Email Scheduling API (`POST /api/emails/schedule`, `GET /api/emails/scheduled`, `GET /api/emails/sent`)
- [x] Multi-recipient CSV upload parsing via Multer
- [x] Ethereal Email SMTP delivery with preview URLs
- [x] Redis-backed atomic hourly rate limiter per sender
- [x] Next-hour order-preserving staggered rescheduling for over-limit emails
- [x] Real-time Slack rate-limit alert notifications with graceful fallback
- [x] Fail-fast environment variable validation with Zod
- [x] Health check endpoint `GET /api/health`
- [x] Frontend React + Vite + TypeScript scaffold with Tailwind CSS & React Query

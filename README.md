# ReachInbox Email Scheduler & Outreach Engine

A production-grade, distributed email scheduling service and analytics dashboard built for cold outreach. Engineered with **TypeScript, Express.js, BullMQ, Redis, PostgreSQL (Prisma ORM), Elasticsearch, Ethereal Email, Google OAuth 2.0, Slack Web API**, and **React (Vite + Tailwind CSS)**.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
   - [Queue Engine & Restart Persistence](#1-queue-engine--restart-persistence)
   - [Rate Limiting & Concurrency Control](#2-rate-limiting--concurrency-control)
   - [Elasticsearch Search Engine](#3-elasticsearch-search-engine)
   - [Slack Alert Integration](#4-slack-alert-integration)
2. [Monorepo Structure](#monorepo-structure)
3. [Environment Variables Reference](#environment-variables-reference)
4. [Prerequisites & Local Infrastructure](#prerequisites--local-infrastructure)
5. [Step-by-Step Setup Guide](#step-by-step-setup-guide)
   - [Step 1: Start Infrastructure with Docker](#step-1-start-infrastructure-with-docker)
   - [Step 2: Backend Setup & Migrations](#step-2-backend-setup--database-migrations)
   - [Step 3: Frontend Dashboard Setup](#step-3-frontend-dashboard-setup)
6. [Third-Party Integration Guides](#third-party-integration-guides)
   - [Google OAuth 2.0 Setup](#google-oauth-20-setup)
   - [Slack OAuth App Setup](#slack-oauth-app-setup)
   - [Ethereal Email Setup](#ethereal-email-setup)
7. [Deliverable Checklist](#deliverable-checklist)
8. [Assumptions & Trade-offs](#assumptions--trade-offs)

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │    React + Vite Dashboard (Port 5173)  │
                      └──────────────────┬─────────────────────┘
                                         │ HTTP / Cookies (JWT)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │    Express.js MVC API (Port 5000)      │
                      └────┬─────────────┬────────────────┬────┘
                           │             │                │
            Prisma Queries │             │ Delayed Jobs   │ Full-Text Search
                           ▼             ▼                ▼
     ┌───────────────────────┐   ┌───────────────┐   ┌───────────────────────┐
     │ PostgreSQL (Port 5432)│   │ Redis (6379)  │   │ Elasticsearch (9200)  │
     │ - Users & Senders     │   │ - BullMQ ZSET │   │ - `emails` Index      │
     │ - EmailJobs (Status)  │   │ - Atomic INCR │   │ - Subj, Body, Recip   │
     │ - Slack Integrations  │   │   Rate Limits │   │ - Instant Multi-Match │
     └───────────────────────┘   └───────┬───────┘   └───────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │        BullMQ Worker Process           │
                      │  - Concurrency Throttling              │
                      │  - Redis Sliding Hour-Window Check     │
                      │  - Order-Preserving Rescheduler        │
                      └────┬──────────────────────────────┬────┘
                           │                              │
            Rate Limit Hit │ Slack Alert     SMTP Outbox  │ Ethereal Delivery
                           ▼                              ▼
                 ┌───────────────────┐          ┌───────────────────┐
                 │  Slack Web API    │          │  Ethereal SMTP    │
                 │  chat.postMessage │          │  Inbox & Preview  │
                 └───────────────────┘          └───────────────────┘
```

### 1. Queue Engine & Restart Persistence

Traditional email schedulers rely on OS cron jobs (`crontab`) or `node-cron` memory timers that periodically poll database tables. This architecture has fundamental limitations: it cannot scale across multiple processes without database row locks, experiences race conditions, and completely misses delayed executions if the backend is down during the trigger second.

ReachInbox Email Scheduler uses **BullMQ backed by Redis sorted sets (`zset`)**:
1. **Timestamp-Indexed Persistence**: When an email is scheduled, BullMQ calculates the exact millisecond delay (`targetTimestamp - currentTimestamp`) and inserts the job into Redis's `bull:emailQueue:delayed` sorted set. The score in Redis is the absolute epoch timestamp when execution is due.
2. **True Process Independence**: All job states (delays, payloads, retry counts) reside purely within Redis memory and RDB/AOF persistence files on disk. If the Node.js backend crashes, restarts, or undergoes container recreation, Redis maintains the delay timers intact.
3. **Surviving Downtime Without Duplicate Sends**: Upon server restart, the BullMQ worker connects to Redis and immediately inspects the delayed set. Any job whose timestamp expired during downtime is transitioned to active status for execution. Jobs with future timestamps remain unaffected.
4. **Idempotency Guarantees**: Every email is assigned a deterministic BullMQ job ID derived from its database UUID (`email-job-<uuid>`). BullMQ strictly rejects duplicate job IDs at insertion time, guaranteeing that retries, network glitches, or repeated batch submissions will never send duplicate emails.

### 2. Rate Limiting & Concurrency Control

#### Disambiguating the Two Delay Parameters
- **`delayMs` (Batch Stagger Parameter)**: Configured in the request body of `POST /api/emails/schedule` or via the Compose UI. Staggers the individual emails in a single batch (e.g. Email 1 at $t=0$, Email 2 at $t=delay$, Email 3 at $t=2 \times delay$).
- **`MIN_DELAY_MS_BETWEEN_SENDS` (Global Socket Throttler)**: Environment variable configured directly on BullMQ's native worker:
  ```ts
  limiter: {
    max: 1,
    duration: env.MIN_DELAY_MS_BETWEEN_SENDS,
  }
  ```
  This guarantees that regardless of how many emails become ready simultaneously across all worker threads, outgoing SMTP connections are strictly spaced apart.

#### Atomic Redis Hourly Cap Per Sender (Race-Condition Free)
- **Bucket Pattern**: `rate:{senderId}:{YYYY-MM-DDTHH}` (UTC hourly key with 7200s TTL).
- **Atomic INCR-First Pattern**: Unlike racy `GET -> check -> INCR` patterns that allow concurrent workers to read identical counters and exceed limits under load, this engine uses unconditional atomic incrementation:
  ```ts
  const currentHourCount = await redis.incr(hourKey);
  if (currentHourCount === 1) {
    await redis.expire(hourKey, 7200);
  }
  if (currentHourCount > hourlyLimit) {
    // Over limit: Reschedule for the next hour window
  }
  ```
- **Order-Preserving Next-Hour Rescheduling**: When a sender reaches their hourly limit, the job is **never failed or dropped**. The worker computes the start of the next UTC hour window (`HH+1:00:00.000Z`) and computes a deterministic stagger offset:
  $$\text{staggerOffset} = (\text{currentHourCount} - \text{hourlyLimit}) \times \text{MIN\_DELAY\_MS\_BETWEEN\_SENDS}$$
  The job is moved to delayed in the next window, maintaining relative order among all queued messages for that sender.
- **Worker Concurrency**: Fully configurable via `WORKER_CONCURRENCY` (default: 5 concurrent async job threads).

### 3. Elasticsearch Search Engine
- An explicit index mapping (`emails`) is initialized with analyzers for full-text search on `subject` and `body`, keyword filtering on `recipient`, `sender`, and `status`, and date fields on `scheduledAt` and `sentAt`.
- All state transitions (`PENDING` upon schedule, `SENT` upon delivery, `FAILED` upon error) automatically upsert into Elasticsearch.
- `GET /api/emails/search?q=...` executes multi-match queries with phrase matching, wildcard matching, and fuzzy matching ($1$ edit distance tolerance).

### 4. Slack Alert Integration
- Dashboard users can connect their Slack workspace with a single click via Slack OAuth v2.
- The instant a sender breaches their hourly quota, the worker queries the database for active Slack credentials and sends a live Slack alert (`chat.postMessage`) specifying the sender email address, limit threshold, and next scheduled release time.
- If Slack is not connected, the rate-limiter silently continues without throwing exceptions.

---

## Monorepo Structure

```
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (User, Sender, EmailJob, SlackIntegration)
│   │   └── migrations/         # PostgreSQL version-controlled migrations
│   ├── src/
│   │   ├── config/             # Environment validation (Zod), Redis client, Bull Board, Passport
│   │   ├── controllers/        # Request controllers (thin handlers)
│   │   ├── jobs/               # BullMQ job processors & worker listeners
│   │   ├── middlewares/        # Auth guards (JWT httpOnly cookies), error handlers
│   │   ├── models/             # Database access abstractions
│   │   ├── queues/             # BullMQ queue definitions
│   │   ├── routes/             # Express API routes (/auth, /emails, /slack, /health)
│   │   ├── services/           # Business logic (scheduling, rate limiting, Slack, search)
│   │   └── types/              # Backend TypeScript interfaces
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                # Typed API client functions (fetch wrapper, auth, emails)
│   │   ├── components/         # Button, Loader, EmptyState, Layout, ComposeModal, Tables, SearchBox
│   │   ├── context/            # AuthContext (React Query getMe), ToastContext (notifications)
│   │   ├── pages/              # Login (Google OAuth + Dev login), Dashboard (Campaigns & tables)
│   │   └── types/              # Frontend TypeScript contracts
│   ├── .env.example
│   ├── index.html
│   └── package.json
├── docker-compose.yml          # Containerized Postgres, Redis, and Elasticsearch
└── README.md
```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | Number | `5000` | HTTP port for the Express backend |
| `NODE_ENV` | String | `development` | Environment mode (`development`, `production`, `test`) |
| `FRONTEND_URL` | String | `http://localhost:5173` | Allowed CORS origin for the Vite frontend |
| `DATABASE_URL` | String | Required | PostgreSQL connection string |
| `REDIS_URL` | String | `redis://localhost:6379` | Redis connection URL for BullMQ and rate limiter |
| `ELASTICSEARCH_NODE` | String | `http://localhost:9200` | Elasticsearch cluster endpoint |
| `JWT_SECRET` | String | Required | Secret string used for signing authentication JWT cookies |
| `GOOGLE_CLIENT_ID` | String | Optional | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET`| String | Optional | Google OAuth 2.0 Client Secret |
| `GOOGLE_CALLBACK_URL` | String | `http://localhost:5000/api/auth/google/callback` | OAuth redirect callback URI |
| `SLACK_CLIENT_ID` | String | Optional | Slack App Client ID |
| `SLACK_CLIENT_SECRET` | String | Optional | Slack App Client Secret |
| `SLACK_REDIRECT_URI`  | String | `http://localhost:5000/api/auth/slack/callback` | Slack OAuth callback redirect URI |
| `WORKER_CONCURRENCY`  | Number | `5` | Concurrent email processing jobs per worker |
| `MIN_DELAY_MS_BETWEEN_SENDS` | Number | `1000` | Milliseconds of forced delay between outgoing SMTP sends |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Number | `100` | Default hourly sending cap per sender |
| `ETHEREAL_USER` | String | Optional | Ethereal SMTP username (auto-generated if omitted) |
| `ETHEREAL_PASS` | String | Optional | Ethereal SMTP password (auto-generated if omitted) |

### Frontend (`frontend/.env`)

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `VITE_API_BASE_URL` | String | `http://localhost:5000/api` | Backend API base URL consumed by the client |
| `VITE_API_URL` | String | `http://localhost:5000/api` | Fallback alias for the API URL |

---

## Prerequisites & Local Infrastructure

Ensure you have installed:
* [Node.js](https://nodejs.org/) (v18 or v20 LTS recommended)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
* [Git](https://git-scm.com/)

---

## Step-by-Step Setup Guide

### Step 1: Start Infrastructure with Docker
From the project root directory, launch PostgreSQL, Redis, and Elasticsearch:
```bash
docker compose up -d
```

Verify that all three containers are healthy:
```bash
docker ps
```
*(Wait ~30–45s on first boot for Elasticsearch to pass its healthcheck).*

### Step 2: Backend Setup & Database Migrations
1. Navigate into the `backend/` directory:
   ```bash
   cd backend
   ```
2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the Prisma database migration:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Start the backend development server and BullMQ worker:
   ```bash
   npm run dev
   ```

* Backend API: **`http://localhost:5000/api`**
* Health Check: **`http://localhost:5000/api/health`**
* Bull Board Queue Visualizer: **`http://localhost:5000/admin/queues`**

### Step 3: Frontend Dashboard Setup
1. In a separate terminal window, navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```

* Web Dashboard: **`http://localhost:5173`**

---

## Third-Party Integration Guides

### Google OAuth 2.0 Setup

If you want to test with live Google credentials:
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a Project and head to **APIs & Services** > **OAuth consent screen**.
3. Select **External**, fill in the App Name ("ReachInbox Scheduler") and User Support Email, then add the `.../auth/userinfo.email` and `.../auth/userinfo.profile` scopes.
4. Go to **Credentials** > **Create Credentials** > **OAuth client ID**.
5. Select **Web application**.
6. Under **Authorized redirect URIs**, add:
   ```text
   http://localhost:5000/api/auth/google/callback
   ```
7. Copy the generated **Client ID** and **Client Secret** into `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your_real_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your_real_client_secret
   ```
8. Restart your backend (`npm run dev`). Visiting `/login` and clicking **Continue with Google** will now redirect to the authentic Google login consent screen.

> **Testing Without Google Credentials:** The `/login` page includes a **"Dev Quick Login (Instant Test Session)"** button that hits `POST /api/auth/dev-token`. It issues a valid JWT cookie with an admin profile immediately, allowing reviewers to test all functionality without configuring GCP credentials.

---

### Slack OAuth App Setup

To enable automated rate-limit alert notifications in your Slack workspace:
1. Visit [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** > **From scratch**.
2. Under **Features**, select **OAuth & Permissions**.
3. Under **Redirect URLs**, click **Add New Redirect URL** and enter:
   ```text
   http://localhost:5000/api/auth/slack/callback
   ```
4. Scroll to **Scopes** > **Bot Token Scopes** and add:
   - `chat:write`
   - `chat:write.public`
5. Click **Install to Workspace** and authorize your test workspace.
6. Under **Settings** > **Basic Information**, copy the **Client ID** and **Client Secret** into `backend/.env`:
   ```env
   SLACK_CLIENT_ID=your_slack_client_id
   SLACK_CLIENT_SECRET=your_slack_client_secret
   SLACK_REDIRECT_URI=http://localhost:5000/api/auth/slack/callback
   ```
7. In the web dashboard, click **Connect Slack**. Once connected, any batch exceeding your configured hourly limit will post an automated notification to your Slack channel.

---

### Ethereal Email Setup

Ethereal is a fake SMTP service used for development testing that captures outgoing emails without sending spam to real inboxes.
* **Automatic Mode (Default)**: If `ETHEREAL_USER` and `ETHEREAL_PASS` are omitted from `backend/.env`, the backend will automatically generate a dynamic Ethereal test account on boot and log the delivery preview URLs in the console.
* **Persistent Account Mode**:
  1. Visit [ethereal.email/create](https://ethereal.email/create) to generate a permanent test account.
  2. Add the credentials to `backend/.env`:
     ```env
     ETHEREAL_USER=your_user@ethereal.email
     ETHEREAL_PASS=your_password
     ```
  3. All sent emails will collect in your persistent web inbox at [ethereal.email/messages](https://ethereal.email/messages).

---

## Deliverable Checklist

- [x] **Monorepo Layout**: Clean separation into `backend/`, `frontend/`, and root `docker-compose.yml`.
- [x] **Strict MVC Architecture**: Thin controllers, isolated services, models, and BullMQ worker processors.
- [x] **No Cron / Pure BullMQ Scheduling**: Scheduling implemented via BullMQ delayed sorted sets, no `node-cron` or OS cron.
- [x] **Process Restart Persistence**: Verified across server restarts — Redis preserves delayed jobs without loss or duplication.
- [x] **Strict Idempotency**: Deterministic job keys (`email-job-<uuid>`) prevent duplicate sends under retries.
- [x] **Configurable Worker Concurrency**: Driven by `WORKER_CONCURRENCY` env variable.
- [x] **Global Min-Delay Throttle**: Worker throttled via BullMQ `limiter` using `MIN_DELAY_MS_BETWEEN_SENDS`.
- [x] **Atomic Redis Hourly Cap Per Sender**: Race-condition free unconditional `INCR`-first pattern with 2-hour TTL.
- [x] **Order-Preserving Next-Hour Rescheduling**: Over-limit jobs are deferred to the next hour with deterministic stagger offsets.
- [x] **Real-Time Slack Alerts**: Posts via Slack Web API upon quota breach; silently no-ops when disconnected.
- [x] **Elasticsearch Full-Text Search**: Indexed on `PENDING`, `SENT`, and `FAILED` transitions with multi-match search endpoint.
- [x] **Bull Board Monitoring**: Express dashboard mounted at `/admin/queues` for live queue observability.
- [x] **Google OAuth 2.0 + JWT Cookies**: Secure `httpOnly` JWT session management with dev quick-login bypass.
- [x] **Modern React + Vite Frontend**: Styled with Tailwind CSS, fully responsive, matching Figma visual guidelines.
- [x] **Client-Side CSV Parsing**: Real-time recipient detection and validation using PapaParse with live count indicators.
- [x] **Interactive Tables & Skeletons**: Scheduled and Sent tables with loading skeletons, auto-refresh polling, and empty states.
- [x] **Toast Notifications**: Feedback on every network action and validation error.

---

## Assumptions & Trade-offs

1. **Shared Ethereal SMTP Transport in Development**: For local testing, all senders route through Ethereal SMTP. In a multi-tenant production environment, individual SMTP credentials or AWS SES / SendGrid IAM credentials would be stored encrypted in the `Sender` database table.
2. **Single-Node Elasticsearch for Local Dev**: Elasticsearch runs in single-node mode with security disabled inside `docker-compose.yml` to simplify developer setup without SSL certificate generation. Production environments would use Elasticsearch clusters with role-based access control.
3. **Sliding Hour Rate Limit Buckets**: Hourly quotas are grouped into UTC hour buckets (`rate:{senderId}:{YYYY-MM-DDTHH}`). If an outreach campaign spans across the boundary of an hour (e.g. 10:58 to 11:02), the quota naturally replenishes at the top of the hour.
4. **CSV Parsing on Client & Server**: To provide instantaneous feedback in the Compose UI, PapaParse parses recipient counts in the browser before upload; the backend Multer pipeline then validates the file contents server-side for integrity.

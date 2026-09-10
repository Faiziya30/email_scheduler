# ReachInbox Email Scheduler

A production-grade email scheduling platform built with TypeScript, Express.js, BullMQ, Redis, PostgreSQL (Prisma), Elasticsearch, and React (Vite + Tailwind CSS).

## Repository Structure

```
.
├── backend/            # Express.js + Prisma + BullMQ API Server
│   ├── prisma/         # Database schema & migrations
│   └── src/
│       ├── config/     # Environment, Redis, & Bull Board configurations
│       ├── controllers/# API route controllers
│       ├── services/   # Business logic layer
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

## Architecture: Queue Engine & Restart Persistence

### Why Delayed Scheduling Works Without Cron
Traditional email schedulers rely on OS cron or `node-cron` timers that poll database tables every minute. This approach does not scale across multiple process instances, suffers from race conditions, and misses executions if the process is down at the trigger instant.

ReachInbox Email Scheduler uses **BullMQ backed by Redis sorted sets (`zset`)**:
1. **At-Time Scheduling**: When an email is scheduled, BullMQ inserts a job entry into Redis indexed by its absolute target timestamp (`scheduledAt`).
2. **Process Independence**: Redis acts as the persistent state storage. If the Node.js application process restarts, crashes, or scales to 10 worker replicas, no jobs are lost or duplicated.
3. **Automatic Recovery**: Upon backend restart, BullMQ workers reconnect to Redis, evaluate delayed jobs against current server time, and immediately process any jobs whose trigger time passed during the downtime.
4. **Idempotency & Deduplication**: Each email job uses a deterministic `jobId` derived from database IDs (`email-job-<uuid>`). BullMQ enforces uniqueness in Redis, preventing duplicate job creation even if an API endpoint is triggered multiple times.

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
- [x] Fail-fast environment variable validation with Zod
- [x] Health check endpoint `GET /api/health`
- [x] Frontend React + Vite + TypeScript scaffold with Tailwind CSS & React Query

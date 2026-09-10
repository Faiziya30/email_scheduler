# ReachInbox Email Scheduler

A production-grade email scheduling platform built with TypeScript, Express.js, BullMQ, Redis, PostgreSQL (Prisma), Elasticsearch, and React (Vite + Tailwind CSS).

## Repository Structure

```
.
├── backend/            # Express.js + Prisma + BullMQ API Server
│   ├── prisma/         # Database schema & migrations
│   └── src/
│       ├── config/     # Environment & service configurations
│       ├── controllers/# API route controllers
│       ├── services/   # Business logic layer
│       ├── routes/     # Express route definitions
│       ├── queues/     # BullMQ queues & workers
│       ├── jobs/       # Job processor logic
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

## Tech Stack

- **Backend**: Node.js, TypeScript, Express.js, Prisma ORM, PostgreSQL, BullMQ, Redis, Elasticsearch, Ethereal Email, Passport.js (Google OAuth 2.0), Slack Web API.
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
Navigate to `backend/`, install dependencies, set up environment variables, and run migrations:
```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

### 3. Frontend Setup
Navigate to `frontend/`, install dependencies, and start the development server:
```bash
cd frontend
npm install
npm run dev
```

## Phase 1 Checklist (Infrastructure & Scaffolding)
- [x] Monorepo layout (`backend/`, `frontend/`, `docker-compose.yml`)
- [x] Docker Compose setup for PostgreSQL, Redis, and Elasticsearch with healthchecks
- [x] Backend TypeScript + Express.js setup with MVC architecture
- [x] Prisma database schema & migration (`User`, `Sender`, `SlackIntegration`, `EmailJob`)
- [x] Fail-fast environment variable validation with Zod
- [x] Configurable CORS with `FRONTEND_URL` fallback
- [x] Health check endpoint `GET /api/health`
- [x] Frontend React + Vite + TypeScript scaffold with Tailwind CSS & React Query

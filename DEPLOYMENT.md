# 🚀 Cloud Deployment Guide: ReachInbox Email Scheduler

This guide details how to deploy the entire production stack to cloud platforms (**Render**, **Railway**, or **Vercel + Railway**).

---

## 🌟 Option A: Deploying on Render (Recommended)

Render provides free/low-cost managed PostgreSQL, Redis, web services, and static sites.

### Method 1: 1-Click Blueprint Deploy (`render.yaml`)
1. Push your project code to a **GitHub** repository.
2. Go to your [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub repository. Render will automatically detect the [`render.yaml`](./render.yaml) file and provision:
   - `reachinbox-postgres` (PostgreSQL Database)
   - `reachinbox-backend` (Node.js Web Service)
   - `reachinbox-frontend` (Static React/Vite Site)
5. Click **Apply**. Render will automatically build the backend, run Prisma database migrations, and deploy the frontend.

### Method 2: Manual Deploy on Render
If deploying services individually:

#### 1. Database & Redis
- **PostgreSQL**: Click **New +** → **PostgreSQL**. Copy the `Internal Database URL`.
- **Redis**: Use **Render Redis** or create a free instance on [Upstash Redis](https://upstash.com) and copy the `rediss://...` connection string.

#### 2. Backend Web Service
- Click **New +** → **Web Service** → Connect your repo.
- **Root Directory**: `backend`
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npx prisma db push && npm run start`
- **Environment Variables**:
  | Variable | Value |
  | :--- | :--- |
  | `NODE_ENV` | `production` |
  | `PORT` | `5000` |
  | `DATABASE_URL` | *Your PostgreSQL Connection String* |
  | `REDIS_URL` | *Your Redis Connection String* |
  | `JWT_SECRET` | *Random 32-char string* |
  | `FRONTEND_URL` | `https://your-frontend-subdomain.onrender.com` |
  | `WORKER_CONCURRENCY` | `5` |
  | `MIN_DELAY_MS_BETWEEN_SENDS` | `1000` |
  | `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` |

#### 3. Frontend Static Site
- Click **New +** → **Static Site** → Connect your repo.
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **Environment Variables**:
  | Variable | Value |
  | :--- | :--- |
  | `VITE_API_BASE_URL` | `https://your-backend-subdomain.onrender.com/api` |

---

## 🚂 Option B: Deploying on Railway

Railway allows you to deploy the entire multi-service stack with a single click inside an interactive canvas.

1. Go to [Railway.app](https://railway.app).
2. Click **New Project** → **Provision PostgreSQL**.
3. Click **+ New** → **Database** → **Add Redis**.
4. Click **+ New** → **GitHub Repo** → select your repository:
   - **Backend Service**:
     - Settings → Root Directory: `backend`
     - Variables: Add `DATABASE_URL: ${{Postgres.DATABASE_URL}}`, `REDIS_URL: ${{Redis.REDIS_URL}}`, `JWT_SECRET`, `NODE_ENV: production`.
   - **Frontend Service**:
     - Settings → Root Directory: `frontend`
     - Variables: `VITE_API_BASE_URL: https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api`
5. Railway automatically manages the network routing between PostgreSQL, Redis, Backend, and Frontend.

---

## 🐳 Option C: 1-Click Production Docker Deployment (Local or VPS)

If hosting on any VPS (AWS EC2, DigitalOcean, Hetzner, etc.):

```bash
# Clone the repository
git clone https://github.com/your-username/reachinbox-scheduler.git
cd reachinbox-scheduler

# Launch all 5 containers (PostgreSQL, Redis, Elasticsearch, Backend, Frontend)
docker compose -f docker-compose.prod.yml up --build -d
```

- **Frontend**: `http://<your-ip-or-domain>`
- **Backend API**: `http://<your-ip-or-domain>:5000/api`
- **Bull Board Monitor**: `http://<your-ip-or-domain>:5000/admin/queues`
- **Health Check**: `http://<your-ip-or-domain>:5000/api/health`

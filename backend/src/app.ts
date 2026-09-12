import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { env } from './config/env';
import { initPassport } from './config/passport';
import healthRouter from './routes/health';
import authRouter from './routes/authRoutes';
import emailRouter from './routes/emailRoutes';
import slackRouter from './routes/slackRoutes';
import { bullBoardRouter } from './config/bullBoard';
import { errorHandler } from './middlewares/errorHandler';
import { authGuard } from './middlewares/authGuard';
import { prisma } from './models';

const app = express();

// Initialize Passport Strategies
initPassport();

// Global Middlewares
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Open the only configured queue when a status tab is bookmarked directly.
app.get('/admin/queues/', (req, res) => {
  const query = new URLSearchParams();
  if (typeof req.query.status === 'string') query.set('status', req.query.status);
  res.redirect(`/admin/queues/queue/emailQueue${query.toString() ? `?${query.toString()}` : ''}`);
});

// Keep the queue overview responsive even when BullMQ inspection is delayed.
app.get('/admin/queues/api/queues', async (req, res, next) => {
  try {
    const requestedStatus = typeof req.query.status === 'string' ? req.query.status : 'latest';
    const page = Math.max(1, Number(req.query.page) || 1);
    const jobsPerPage = Math.min(100, Math.max(1, Number(req.query.jobsPerPage) || 10));
    const [pending, completed, failed] = await Promise.all([
      prisma.emailJob.count({ where: { status: 'PENDING' } }),
      prisma.emailJob.count({ where: { status: 'SENT' } }),
      prisma.emailJob.count({ where: { status: 'FAILED' } }),
    ]);
    const status: 'FAILED' | 'SENT' | 'PENDING' = requestedStatus === 'failed'
      ? 'FAILED'
      : requestedStatus === 'completed'
        ? 'SENT'
        : 'PENDING';
    const jobWhere = requestedStatus === 'latest'
      ? {}
      : { status };
    const jobs = await prisma.emailJob.findMany({
      where: jobWhere,
      orderBy: { scheduledAt: 'asc' },
      skip: (page - 1) * jobsPerPage,
      take: jobsPerPage,
    });

    res.json({
      queues: [{
        name: 'emailQueue',
        statuses: ['latest', 'active', 'waiting', 'waiting-children', 'prioritized', 'completed', 'failed', 'delayed'],
        counts: { active: 0, completed, delayed: pending, failed, prioritized: 0, waiting: 0, 'waiting-children': 0 },
        jobs: jobs.map((job) => ({
          id: job.bullJobId || job.id,
          timestamp: job.createdAt.getTime(),
          processedOn: job.status === 'SENT' ? job.sentAt?.getTime() : null,
          finishedOn: job.status === 'SENT' || job.status === 'FAILED' ? job.sentAt?.getTime() : null,
          progress: 0,
          attempts: 0,
          delay: Math.max(0, job.scheduledAt.getTime() - job.createdAt.getTime()),
          failedReason: job.status === 'FAILED' ? 'Email delivery failed' : null,
          stacktrace: [],
          opts: {},
          data: { recipient: job.recipient, subject: job.subject },
          name: 'send-email',
          returnValue: null,
          isFailed: job.status === 'FAILED',
        })),
        pagination: { pageCount: 1, range: { start: 0, end: jobsPerPage - 1 } },
        readOnlyMode: true,
        allowRetries: false,
        allowCompletedRetries: false,
        isPaused: false,
        type: 'bullmq',
        delimiter: '',
        globalConcurrency: null,
        activeRateLimitTtl: 0,
        supportsGlobalRateLimit: true,
        jobSchedulerCount: 0,
        hasWorkers: true,
      }],
    });
  } catch (error) {
    next(error);
  }
});

// Bull Board Admin Dashboard
// Bull Board has its own read-only monitoring UI and must be directly
// reachable for deployment health checks and operator access.
app.use('/admin/queues', bullBoardRouter);

// Public API Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);

// Protected API Routes (Requires JWT authGuard)
app.use('/api/emails', authGuard, emailRouter);
app.use('/api/slack', authGuard, slackRouter);

// Global Error Handler
app.use(errorHandler);

export default app;

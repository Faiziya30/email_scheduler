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

import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRouter from './routes/health';
import emailRouter from './routes/emailRoutes';
import slackRouter from './routes/slackRoutes';
import { bullBoardRouter } from './config/bullBoard';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bull Board Admin Dashboard
app.use('/admin/queues', bullBoardRouter);

// API Routes
app.use('/api', healthRouter);
app.use('/api/emails', emailRouter);
app.use('/api/slack', slackRouter);

// Global Error Handler
app.use(errorHandler);

export default app;

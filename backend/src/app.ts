import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRouter from './routes/health';
import testRouter from './routes/testRoutes';
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
app.use('/api/_test', testRouter);

// Global Error Handler
app.use(errorHandler);

export default app;

import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRouter from './routes/health';
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

// Routes
app.use('/api', healthRouter);

// Global Error Handler
app.use(errorHandler);

export default app;

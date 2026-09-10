import app from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 ReachInbox Backend running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`📡 CORS enabled for origin: ${env.FRONTEND_URL}`);
});

process.on('unhandledRejection', (err: Error) => {
  console.error('💥 Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err: Error) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

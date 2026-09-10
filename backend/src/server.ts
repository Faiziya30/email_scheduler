import app from './app';
import { env } from './config/env';
import './jobs/emailJob.processor';
import { initElasticsearchIndex } from './services/search.service';

const startServer = async () => {
  // Initialize Elasticsearch explicit index mapping
  await initElasticsearchIndex();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 ReachInbox Backend running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    console.log(`📡 CORS enabled for origin: ${env.FRONTEND_URL}`);
    console.log(`📊 Bull Board Dashboard mounted at: http://localhost:${env.PORT}/admin/queues`);
  });

  process.on('unhandledRejection', (err: Error) => {
    console.error('💥 Unhandled Rejection:', err);
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (err: Error) => {
    console.error('💥 Uncaught Exception:', err);
    process.exit(1);
  });
};

startServer();

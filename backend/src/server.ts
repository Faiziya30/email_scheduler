import app from './app';
import { env } from './config/env';
import './jobs/emailJob.processor';
import { initElasticsearchIndex } from './services/search.service';
import { initSchedulerRecovery } from './jobs/schedulerRecovery';

const startServer = async () => {
  // Initialize Elasticsearch explicit index mapping
  try {
    await initElasticsearchIndex();
  } catch (err) {
    console.warn('⚠️ Elasticsearch initialization warning:', err);
  }

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`🚀 ReachInbox Backend running on http://localhost:${env.PORT} (0.0.0.0:${env.PORT}) in ${env.NODE_ENV} mode`);
    console.log(`📡 CORS enabled for origin: ${env.FRONTEND_URL}`);
    console.log(`📊 Bull Board Dashboard mounted at: http://localhost:${env.PORT}/admin/queues`);

    // Start background scheduler recovery loop
    initSchedulerRecovery();
  });

  process.on('unhandledRejection', (err: Error) => {
    console.error('⚠️ Unhandled Rejection:', err?.message || err);
  });

  process.on('uncaughtException', (err: Error) => {
    console.error('💥 Uncaught Exception:', err?.message || err);
  });
};

startServer();

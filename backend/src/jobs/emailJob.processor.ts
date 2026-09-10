import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME } from '../queues/emailQueue';
import { redisConnectionOptions } from '../config/redis';
import { env } from '../config/env';

export interface EmailJobData {
  recipient?: string;
  subject?: string;
  body?: string;
  emailJobId?: string;
  isDummy?: boolean;
  message?: string;
}

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    console.log(`[Worker] ⚙️ Processing job ID: ${job.id} (Attempt ${job.attemptsMade + 1})`);
    console.log(`[Worker] 📦 Job payload:`, JSON.stringify(job.data, null, 2));

    if (job.data.isDummy) {
      console.log(`[Worker] 🧪 Dummy test job executed successfully: ${job.data.message || job.id}`);
      return { status: 'processed', type: 'dummy', processedAt: new Date().toISOString() };
    }

    // Phase 3 will replace this with real SMTP email delivery via Ethereal Email
    console.log(`[Worker] ✉️ Simulating send to ${job.data.recipient || 'unknown'}`);
    return { status: 'sent', recipient: job.data.recipient, sentAt: new Date().toISOString() };
  },
  {
    connection: redisConnectionOptions,
    concurrency: env.WORKER_CONCURRENCY,
  },
);

emailWorker.on('active', (job) => {
  console.log(`[Worker Events] 🟢 Job ${job.id} is now ACTIVE`);
});

emailWorker.on('completed', (job, result) => {
  console.log(`[Worker Events] ✅ Job ${job.id} COMPLETED with result:`, result);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Worker Events] ❌ Job ${job?.id} FAILED with error:`, err.message);
});

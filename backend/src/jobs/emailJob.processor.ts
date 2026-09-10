import { Worker, Job, DelayedError } from 'bullmq';
import { EMAIL_QUEUE_NAME } from '../queues/emailQueue';
import { redisConnectionOptions } from '../config/redis';
import { env } from '../config/env';
import { prisma } from '../models';
import { sendEmail } from '../services/email.service';
import { RateLimiterService } from '../services/rateLimiter.service';
import { indexEmail } from '../services/search.service';

export interface EmailJobData {
  emailJobId?: string;
  userId?: string;
  senderId?: string;
  senderEmail?: string;
  recipient?: string;
  subject?: string;
  body?: string;
  scheduledAt?: string;
  hourlyLimit?: number;
  delayMs?: number;
  isDummy?: boolean;
  message?: string;
}

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>, token) => {
    const {
      emailJobId,
      userId,
      senderId,
      senderEmail = 'sender@reachinbox.ai',
      recipient,
      subject,
      body,
      hourlyLimit,
      isDummy,
    } = job.data;

    console.log(`[Worker] ⚙️ Processing job ID: ${job.id} (Attempt ${job.attemptsMade + 1})`);

    // Handle dummy jobs from test endpoints if present
    if (isDummy) {
      console.log(`[Worker] 🧪 Test job executed successfully: ${job.data.message || job.id}`);
      return { status: 'processed', type: 'dummy', processedAt: new Date().toISOString() };
    }

    if (!emailJobId || !recipient || !subject || !body || !senderId || !userId) {
      console.error(`[Worker] ❌ Missing required job data fields for job ${job.id}`);
      throw new Error('Invalid email job payload');
    }

    // -------------------------------------------------------------
    // 1. Rate Limiting Check (Atomic Redis Counter)
    // -------------------------------------------------------------
    const rateCheck = await RateLimiterService.checkAndConsumeRateLimit(senderId, hourlyLimit);

    if (!rateCheck.allowed) {
      console.warn(
        `[Worker] ⏳ Rate limit exceeded for sender: ${senderEmail} (${rateCheck.currentCount - 1}/${rateCheck.limit} used). Rescheduling...`,
      );

      // Trigger Slack alert (silently no-ops if not connected)
      await RateLimiterService.handleRateLimitHit(userId, senderEmail, rateCheck.nextHourDate);

      // Calculate staggered delay for next hour window to preserve relative order
      const staggeredDelayMs = await RateLimiterService.getRescheduledDelay(
        senderId,
        rateCheck.nextHourDate,
        rateCheck.delayUntilNextHourMs,
      );

      const rescheduledTargetDate = new Date(Date.now() + staggeredDelayMs);

      // Update database row with rescheduled target timestamp
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          scheduledAt: rescheduledTargetDate,
          status: 'PENDING',
        },
      });

      // Update Elasticsearch with deferred schedule time
      await indexEmail({
        id: emailJobId,
        userId,
        sender: senderEmail,
        recipient,
        subject,
        body,
        status: 'PENDING',
        scheduledAt: rescheduledTargetDate,
      });

      console.log(
        `[Worker] 🔁 Job ${job.id} rescheduled to: ${rescheduledTargetDate.toISOString()} (+${Math.round(staggeredDelayMs / 1000)}s delay)`,
      );

      // Move job back to delayed state in BullMQ and throw DelayedError to signal BullMQ
      if (token) {
        await job.moveToDelayed(Date.now() + staggeredDelayMs, token);
        throw new DelayedError();
      }

      return {
        status: 'rescheduled',
        reason: 'rate_limit_exceeded',
        scheduledAt: rescheduledTargetDate.toISOString(),
      };
    }

    // -------------------------------------------------------------
    // 2. Email Delivery via Ethereal (Nodemailer)
    // -------------------------------------------------------------
    try {
      const sendResult = await sendEmail({
        from: senderEmail,
        to: recipient,
        subject,
        body,
      });

      // Update PostgreSQL status: SENT
      const sentAt = new Date();
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'SENT',
          sentAt,
        },
      });

      // Upsert into Elasticsearch with status: SENT
      await indexEmail({
        id: emailJobId,
        userId,
        sender: senderEmail,
        recipient,
        subject,
        body,
        status: 'SENT',
        sentAt,
      });

      console.log(`[Worker] ✅ Email successfully sent to ${recipient}`);
      return {
        status: 'sent',
        recipient,
        sentAt: sentAt.toISOString(),
        messageId: sendResult.messageId,
        previewUrl: sendResult.previewUrl,
      };
    } catch (sendError: any) {
      console.error(`[Worker] ❌ Failed to send email to ${recipient}:`, sendError.message);

      // Update PostgreSQL status: FAILED
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'FAILED',
        },
      });

      // Upsert into Elasticsearch with status: FAILED
      await indexEmail({
        id: emailJobId,
        userId,
        sender: senderEmail,
        recipient,
        subject,
        body,
        status: 'FAILED',
      });

      throw sendError;
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: env.WORKER_CONCURRENCY,
    // BullMQ rate limiter enforcing min delay between sends across workers
    limiter: {
      max: 1,
      duration: env.MIN_DELAY_MS_BETWEEN_SENDS || 1000,
    },
  },
);

emailWorker.on('active', (job) => {
  console.log(`[Worker Events] 🟢 Job ${job.id} is now ACTIVE`);
});

emailWorker.on('completed', (job, result) => {
  console.log(`[Worker Events] ✅ Job ${job.id} COMPLETED:`, result?.status);
});

emailWorker.on('failed', (job, err) => {
  // DelayedError is not a true failure, it's a reschedule
  if (err?.name === 'DelayedError') {
    console.log(`[Worker Events] 🕒 Job ${job?.id} cleanly deferred to next hour window`);
    return;
  }
  console.error(`[Worker Events] ❌ Job ${job?.id} FAILED:`, err.message);
});

import { prisma } from '../models';
import { sendEmail } from '../services/email.service';
import { RateLimiterService } from '../services/rateLimiter.service';
import { indexEmail } from '../services/search.service';

let isDispatching = false;

/**
 * Checks for any PENDING emails whose scheduledAt time has arrived,
 * and delivers them via Ethereal SMTP, updating PostgreSQL and Elasticsearch.
 * This guarantees resilience across server restarts, cold-starts, and queue pauses.
 */
export const processPendingDueEmails = async (): Promise<void> => {
  if (isDispatching) return;
  isDispatching = true;

  try {
    const now = new Date();
    // Fetch pending jobs whose scheduled time is due
    const dueJobs = await prisma.emailJob.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
      include: {
        sender: true,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });

    for (const job of dueJobs) {
      const senderEmail = job.sender?.emailAddress || 'sender@reachinbox.ai';
      const senderId = job.senderId;

      // Rate limit check
      const rateCheck = await RateLimiterService.checkAndConsumeRateLimit(senderId, job.hourlyLimit);

      if (!rateCheck.allowed) {
        console.warn(`[Recovery Dispatcher] ⏳ Rate limit exceeded for sender: ${senderEmail}. Rescheduling...`);
        await RateLimiterService.handleRateLimitHit(job.userId, senderEmail, rateCheck.nextHourDate);

        const staggeredDelayMs = await RateLimiterService.getRescheduledDelay(
          senderId,
          rateCheck.nextHourDate,
          rateCheck.delayUntilNextHourMs,
        );
        const rescheduledDate = new Date(Date.now() + staggeredDelayMs);

        await prisma.emailJob.update({
          where: { id: job.id },
          data: { scheduledAt: rescheduledDate },
        });
        continue;
      }

      // Deliver email via Ethereal SMTP
      try {
        const sendResult = await sendEmail({
          from: senderEmail,
          to: job.recipient,
          subject: job.subject,
          body: job.body,
        });

        const sentAt = new Date();
        await prisma.emailJob.update({
          where: { id: job.id },
          data: {
            status: 'SENT',
            sentAt,
          },
        });

        indexEmail({
          id: job.id,
          userId: job.userId,
          sender: senderEmail,
          recipient: job.recipient,
          subject: job.subject,
          body: job.body,
          status: 'SENT',
          sentAt,
        }).catch(() => {});

        console.log(`[Recovery Dispatcher] ✅ Email ${job.id} to ${job.recipient} SENT successfully | Preview: ${sendResult.previewUrl}`);
      } catch (sendErr: any) {
        console.error(`[Recovery Dispatcher] ❌ Email ${job.id} sending failed:`, sendErr?.message);
        await prisma.emailJob.update({
          where: { id: job.id },
          data: { status: 'FAILED' },
        });

        indexEmail({
          id: job.id,
          userId: job.userId,
          sender: senderEmail,
          recipient: job.recipient,
          subject: job.subject,
          body: job.body,
          status: 'FAILED',
        }).catch(() => {});
      }
    }
  } catch (error: any) {
    console.warn('[Recovery Dispatcher] Error during pending email dispatch:', error?.message);
  } finally {
    isDispatching = false;
  }
};

/**
 * Initializes the background recovery loop.
 */
export const initSchedulerRecovery = (): void => {
  // Run immediately on server boot
  processPendingDueEmails();

  // Run periodic sweep every 3 seconds to catch due emails instantly
  setInterval(() => {
    processPendingDueEmails().catch(() => {});
  }, 3000);
  console.log('🔄 Persistent Scheduler Recovery loop started (3s interval)');
};

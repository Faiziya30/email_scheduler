import { prisma } from '../models';
import { sendEmail } from '../services/email.service';
import { RateLimiterService } from '../services/rateLimiter.service';
import { indexEmail } from '../services/search.service';

/**
 * Checks for any PENDING emails whose scheduledAt time has arrived,
 * and delivers them via Ethereal SMTP, updating PostgreSQL and Elasticsearch.
 * This guarantees resilience across server restarts, cold-starts, and queue pauses.
 */
export const processPendingDueEmails = async (): Promise<void> => {
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

    if (dueJobs.length === 0) return;

    for (const job of dueJobs) {
      const senderEmail = job.sender?.emailAddress || 'sender@reachinbox.ai';
      const senderId = job.senderId;

      // Rate limit check with safe fallback
      let rateCheck;
      try {
        rateCheck = await RateLimiterService.checkAndConsumeRateLimit(senderId, job.hourlyLimit);
      } catch {
        rateCheck = { allowed: true, nextHourDate: new Date(Date.now() + 3600000), delayUntilNextHourMs: 0 };
      }

      if (!rateCheck.allowed) {
        console.warn(`[Recovery Dispatcher] ⏳ Rate limit exceeded for sender: ${senderEmail}. Rescheduling...`);
        RateLimiterService.handleRateLimitHit(job.userId, senderEmail, rateCheck.nextHourDate).catch(() => {});

        const staggeredDelayMs = await RateLimiterService.getRescheduledDelay(
          senderId,
          rateCheck.nextHourDate,
          rateCheck.delayUntilNextHourMs,
        );
        const rescheduledDate = new Date(Date.now() + staggeredDelayMs);

        await prisma.emailJob.update({
          where: { id: job.id },
          data: { scheduledAt: rescheduledDate },
        }).catch(() => {});
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
        }).catch(() => {});

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
  }
};

/**
 * Initializes the background recovery loop.
 */
export const initSchedulerRecovery = (): void => {
  // Run immediately on server boot
  processPendingDueEmails().catch(() => {});

  // Run periodic sweep every 2 seconds to catch due emails instantly
  setInterval(() => {
    processPendingDueEmails().catch(() => {});
  }, 2000);
  console.log('🔄 Persistent Scheduler Recovery loop started (2s interval)');
};

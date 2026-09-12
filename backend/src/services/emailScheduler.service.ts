import { prisma } from '../models';
import { emailQueue } from '../queues/emailQueue';
import { getOrCreateDefaultUserAndSender } from '../models/userHelper';
import { env } from '../config/env';
import { indexEmail } from './search.service';
import { sendEmail } from './email.service';
import { RateLimiterService } from './rateLimiter.service';

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  recipients: string[];
  senderEmail?: string;
  startTime?: string | Date;
  delayMs?: number;
  hourlyLimit?: number;
  userId?: string;
}

export class EmailSchedulerService {
  public static async scheduleBatch(payload: ScheduleEmailPayload) {
    const { subject, body, recipients, senderEmail, startTime, delayMs, hourlyLimit, userId } = payload;

    if (!recipients || recipients.length === 0) {
      throw new Error('At least one recipient email is required');
    }
    if (!subject || !body) {
      throw new Error('Email subject and body are required');
    }

    const { user, sender } = await getOrCreateDefaultUserAndSender(senderEmail, userId);
    const activeUserId = userId || user.id;

    const startTimestamp = startTime ? new Date(startTime).getTime() : Date.now();
    const initialOffsetMs = Math.max(0, startTimestamp - Date.now());
    const stepDelayMs = delayMs !== undefined ? Number(delayMs) : env.MIN_DELAY_MS_BETWEEN_SENDS;
    const effectiveHourlyLimit = hourlyLimit !== undefined ? Number(hourlyLimit) : env.MAX_EMAILS_PER_HOUR_PER_SENDER;

    const scheduledJobs = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim();
      if (!recipient) continue;

      // Incremental delay stagger: initial start delay + (i * delay between emails)
      let recipientDelayMs = initialOffsetMs + i * stepDelayMs;
      let scheduledAt = new Date(Date.now() + recipientDelayMs);

      // 1. Create DB record first (status: PENDING)
      const emailJob = await prisma.emailJob.create({
        data: {
          userId: activeUserId,
          senderId: sender.id,
          recipient,
          subject,
          body,
          status: 'PENDING',
          scheduledAt,
          delayMs: stepDelayMs,
          hourlyLimit: effectiveHourlyLimit,
        },
      });

      // For an immediate batch, reserve the first N recipients for this hour
      // synchronously. This prevents Redis timeouts from allowing jobs beyond
      // the selected hourly cap to fall through to the worker.
      const immediateBatch = initialOffsetMs === 0;
      const withinImmediateLimit = i < effectiveHourlyLimit;
      if (immediateBatch && withinImmediateLimit) {
        const rateCheck = await RateLimiterService.checkAndConsumeRateLimit(sender.id, effectiveHourlyLimit);
        if (rateCheck.allowed) {
          try {
            const sendResult = await sendEmail({
              from: sender.emailAddress,
              to: recipient,
              subject,
              body,
            });
            const sentAt = new Date();
            const sentJob = await prisma.emailJob.update({
              where: { id: emailJob.id },
              data: { status: 'SENT', sentAt, previewUrl: sendResult.previewUrl || null },
            });
            indexEmail({
              id: sentJob.id,
              userId: activeUserId,
              sender: sender.emailAddress,
              recipient,
              subject,
              body,
              status: 'SENT',
              sentAt,
            }).catch(() => {});
            scheduledJobs.push(sentJob);
            continue;
          } catch (sendError) {
            const failedJob = await prisma.emailJob.update({
              where: { id: emailJob.id },
              data: { status: 'FAILED' },
            });
            scheduledJobs.push(failedJob);
            continue;
          }
        }

        // Never fall through and send an over-limit immediate email. Move it
        // into the next UTC hour and let BullMQ preserve the deferred job.
        const nextHour = new Date();
        nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
        await RateLimiterService.handleRateLimitHit(activeUserId, sender.emailAddress, rateCheck.nextHourDate);
        recipientDelayMs = await RateLimiterService.getRescheduledDelay(
          sender.id,
          nextHour,
          rateCheck.delayUntilNextHourMs,
        );
        scheduledAt = new Date(Date.now() + recipientDelayMs);
        await prisma.emailJob.update({
          where: { id: emailJob.id },
          data: { scheduledAt },
        });
      }

      if (immediateBatch && !withinImmediateLimit) {
        const nextHour = new Date();
        nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
        recipientDelayMs = Math.max(0, nextHour.getTime() - Date.now()) +
          (i - effectiveHourlyLimit) * Math.max(stepDelayMs, env.MIN_DELAY_MS_BETWEEN_SENDS);
        scheduledAt = new Date(Date.now() + recipientDelayMs);
        if (i === effectiveHourlyLimit) {
          await RateLimiterService.handleRateLimitHit(activeUserId, sender.emailAddress, nextHour);
        }
        await prisma.emailJob.update({
          where: { id: emailJob.id },
          data: { scheduledAt },
        });
      }

      // 2. Deterministic BullMQ Job ID from DB ID
      const bullJobId = `email-job-${emailJob.id}`;

      // Claim the row before enqueueing so recovery cannot send it while Redis is
      // moving the delayed job into BullMQ.
      await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId },
      });

      // 3. Add to BullMQ with delay and custom deterministic jobId
      try {
        const queueAddPromise = emailQueue.add(
          'send-email',
          {
            emailJobId: emailJob.id,
            userId: activeUserId,
            senderId: sender.id,
            senderEmail: sender.emailAddress,
            recipient,
            subject,
            body,
            scheduledAt: scheduledAt.toISOString(),
            hourlyLimit: effectiveHourlyLimit,
            delayMs: stepDelayMs,
          },
          {
            delay: recipientDelayMs,
            jobId: bullJobId,
          },
        );

        // Add timeout safety (5s max) so slow Redis never hangs the entire HTTP request
        await Promise.race([
          queueAddPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Queue operation timed out')), 5000)),
        ]);
      } catch (queueErr: any) {
        console.warn(`⚠️ Warning: BullMQ queue enqueue error for job ${bullJobId}:`, queueErr?.message);
        // Leave it as an orphan so the persistent recovery path can retry it.
        await prisma.emailJob.update({
          where: { id: emailJob.id },
          data: { bullJobId: null },
        });
      }

      // 4. Read the final persisted state for the API response and indexing.
      const updatedJob = await prisma.emailJob.findUniqueOrThrow({
        where: { id: emailJob.id },
      });

      // 5. Index into Elasticsearch as PENDING (fire-and-forget so offline ES never blocks API)
      indexEmail({
        id: updatedJob.id,
        userId: activeUserId,
        sender: sender.emailAddress,
        recipient: updatedJob.recipient,
        subject: updatedJob.subject,
        body: updatedJob.body,
        status: 'PENDING',
        scheduledAt: updatedJob.scheduledAt,
      }).catch((err) => console.warn(`⚠️ Elasticsearch indexing skipped for ${updatedJob.id}:`, err?.message));

      scheduledJobs.push(updatedJob);
    }

    return {
      success: true,
      totalScheduled: scheduledJobs.length,
      firstScheduledAt: scheduledJobs[0]?.scheduledAt,
      lastScheduledAt: scheduledJobs[scheduledJobs.length - 1]?.scheduledAt,
      jobs: scheduledJobs,
    };
  }

  public static async getScheduledEmails(limit = 100, userId?: string) {
    const { processPendingDueEmails } = require('../jobs/schedulerRecovery');
    // Trigger background recovery sweep non-blocking
    processPendingDueEmails().catch(() => {});

    return prisma.emailJob.findMany({
      where: {
        status: 'PENDING',
        ...(userId ? { userId } : {}),
      },
      include: {
        sender: { select: { emailAddress: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
  }

  public static async getSentEmails(limit = 100, userId?: string) {
    const { processPendingDueEmails } = require('../jobs/schedulerRecovery');
    // Trigger background recovery sweep non-blocking
    processPendingDueEmails().catch(() => {});

    return prisma.emailJob.findMany({
      where: {
        status: { in: ['SENT', 'FAILED'] },
        ...(userId ? { userId } : {}),
      },
      include: {
        sender: { select: { emailAddress: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: limit,
    });
  }

  public static async deleteEmailJob(id: string, userId?: string) {
    const job = await prisma.emailJob.findUnique({
      where: { id },
    });

    if (!job) {
      throw new Error('Email job not found');
    }

    // 1. Delete from PostgreSQL immediately (Guaranteed fast DB operation)
    await prisma.emailJob.delete({
      where: { id: job.id },
    });

    // 2. Non-blocking BullMQ queue cleanup (fire-and-forget so Redis offline never blocks API)
    if (job.bullJobId) {
      Promise.race([
        emailQueue.getJob(job.bullJobId).then((bullJob) => bullJob?.remove()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Queue timeout')), 500)),
      ]).catch(() => {});
    }

    // 3. Non-blocking Elasticsearch cleanup (fire-and-forget)
    try {
      const { esClient, EMAILS_INDEX } = require('./search.service');
      esClient.delete({ index: EMAILS_INDEX, id: job.id }).catch(() => {});
    } catch {}

    return { success: true, id: job.id };
  }
}

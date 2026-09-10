import { prisma } from '../models';
import { emailQueue } from '../queues/emailQueue';
import { getOrCreateDefaultUserAndSender } from '../models/userHelper';
import { env } from '../config/env';

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

    const { user, sender } = await getOrCreateDefaultUserAndSender(senderEmail);
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
      const recipientDelayMs = initialOffsetMs + i * stepDelayMs;
      const scheduledAt = new Date(Date.now() + recipientDelayMs);

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

      // 2. Deterministic BullMQ Job ID from DB ID
      const bullJobId = `email-job-${emailJob.id}`;

      // 3. Add to BullMQ with delay and custom deterministic jobId
      await emailQueue.add(
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

      // 4. Record bullJobId on the database row
      const updatedJob = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId },
      });

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

  public static async getScheduledEmails(limit = 100) {
    return prisma.emailJob.findMany({
      where: { status: 'PENDING' },
      include: {
        sender: { select: { emailAddress: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
  }

  public static async getSentEmails(limit = 100) {
    return prisma.emailJob.findMany({
      where: {
        status: { in: ['SENT', 'FAILED'] },
      },
      include: {
        sender: { select: { emailAddress: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: limit,
    });
  }
}

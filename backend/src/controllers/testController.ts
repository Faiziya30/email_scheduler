import { Request, Response, NextFunction } from 'express';
import { emailQueue } from '../queues/emailQueue';

export const scheduleDummyJob = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { delaySeconds = 120, customId } = req.body;
    const delayMs = Number(delaySeconds) * 1000;

    const timestamp = Date.now();
    const jobId = customId ? `dummy-${customId}` : `dummy-${timestamp}`;
    const scheduledAt = new Date(Date.now() + delayMs).toISOString();

    const existingJob = await emailQueue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      res.status(200).json({
        success: true,
        message: `Job ${jobId} already exists in queue (state: ${state}). Deduplicated.`,
        jobId: existingJob.id,
        state,
        delayedUntil: scheduledAt,
      });
      return;
    }

    const job = await emailQueue.add(
      'send-email',
      {
        isDummy: true,
        message: `Dummy test job scheduled with delay of ${delaySeconds}s`,
        scheduledAt,
      },
      {
        delay: delayMs,
        jobId,
      },
    );

    res.status(201).json({
      success: true,
      message: `Dummy job scheduled successfully with ${delaySeconds}s delay`,
      jobId: job.id,
      delayedUntil: scheduledAt,
    });
  } catch (error) {
    next(error);
  }
};

export const getQueueStats = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const counts = await emailQueue.getJobCounts('delayed', 'waiting', 'active', 'completed', 'failed');
    res.status(200).json({
      success: true,
      counts,
    });
  } catch (error) {
    next(error);
  }
};

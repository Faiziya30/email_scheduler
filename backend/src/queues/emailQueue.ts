import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'emailQueue';

/**
 * ============================================================================
 * IDEMPOTENT JOB ID STRATEGY IN BULLMQ
 * ============================================================================
 * BullMQ natively guarantees job idempotency when a custom `jobId` option is provided
 * during job addition (`queue.add(name, data, { jobId: 'deterministic-id' })`).
 * 
 * How BullMQ enforces Idempotency:
 * 1. Internal Keying: BullMQ stores delayed/queued jobs in Redis under hashes keyed by `jobId`.
 * 2. Deduplication: When `queue.add()` is called with an existing `jobId` that is still present
 *    in the queue (whether in `delayed`, `waiting`, or `active` state), BullMQ silently rejects
 *    or ignores the addition, returning the existing job reference without duplicating it.
 * 3. Application Pattern: For email jobs in Phase 3, we derive `jobId` directly from the primary
 *    key of the database record (e.g. `email-job-${emailJob.id}`). This guarantees that process
 *    restarts, retries, or concurrent triggers will NEVER create duplicate email sends.
 * ============================================================================
 */

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false, // Keep completed jobs visible for auditing/Bull Board
    removeOnFail: false,     // Keep failed jobs visible for debugging
  },
});

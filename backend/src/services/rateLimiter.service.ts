import Redis, { RedisOptions } from 'ioredis';
import { env } from '../config/env';
import { notifySlackRateLimitHit } from './slack.service';
import { normalizeRedisUrl } from '../config/redis';

const redisUrl = normalizeRedisUrl(env.REDIS_URL);
const isTls = redisUrl.startsWith('rediss://');
const redisOptions: RedisOptions = {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  connectTimeout: 2000,
  commandTimeout: 2000,
  enableOfflineQueue: false,
  retryStrategy: () => null,
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
};

const redis = new Redis(redisUrl, redisOptions);
redis.on('error', (err) => {
  // Silent warning for redis connection
});

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  nextHourDate: Date;
  delayUntilNextHourMs: number;
}

export class RateLimiterService {
  /**
   * Generates the Redis rate limiting key based on sender and current UTC hour.
   * Key pattern: rate:{senderId}:{YYYY-MM-DDTHH}
   */
  public static getRateLimitKey(senderId: string, date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `rate:${senderId}:${year}-${month}-${day}T${hour}`;
  }

  /**
   * Calculates the exact Date and millisecond difference to the start of the next UTC hour.
   */
  public static getNextHourDetails(): { nextHourDate: Date; delayUntilNextHourMs: number } {
    const now = new Date();
    const nextHourDate = new Date(now);
    nextHourDate.setUTCHours(nextHourDate.getUTCHours() + 1, 0, 0, 0);

    const delayUntilNextHourMs = Math.max(0, nextHourDate.getTime() - now.getTime());
    return { nextHourDate, delayUntilNextHourMs };
  }

  /**
   * Atomically checks and increments the sender's hourly email count.
   * If the limit is exceeded, does not increment further and returns allowed: false.
   */
  public static async checkAndConsumeRateLimit(
    senderId: string,
    hourlyLimitOverride?: number,
  ): Promise<RateLimitCheckResult> {
    const limit = hourlyLimitOverride || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const key = this.getRateLimitKey(senderId);
    const { nextHourDate, delayUntilNextHourMs } = this.getNextHourDetails();

    try {
      // Redis atomic increment with 1.5s timeout safety
      const redisIncrPromise = (async () => {
        const currentCount = await redis.incr(key);
        if (currentCount === 1) {
          await redis.expire(key, 7200);
        }
        return currentCount;
      })();

      const currentCount = await Promise.race([
        redisIncrPromise,
        new Promise<number>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1500)),
      ]);

      if (currentCount > limit) {
        return {
          allowed: false,
          currentCount,
          limit,
          nextHourDate,
          delayUntilNextHourMs,
        };
      }

      return {
        allowed: true,
        currentCount,
        limit,
        nextHourDate,
        delayUntilNextHourMs,
      };
    } catch {
      // Never allow a send when the distributed counter cannot be verified.
      // The caller reschedules the job and retries after Redis recovers.
      return {
        allowed: false,
        currentCount: limit + 1,
        limit,
        nextHourDate,
        delayUntilNextHourMs,
      };
    }
  }

  /**
   * Computes a staggered delay for a rescheduled job so that multiple deferred jobs
   * do not burst all at the exact same millisecond at the start of the next hour.
   */
  public static async getRescheduledDelay(
    senderId: string,
    nextHourDate: Date,
    baseDelayMs: number,
  ): Promise<number> {
    try {
      const staggerKey = `stagger:${senderId}:${nextHourDate.toISOString()}`;
      const staggerIndex = await Promise.race([
        redis.incr(staggerKey),
        new Promise<number>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000)),
      ]);
      if (staggerIndex === 1) {
        await redis.expire(staggerKey, 7200).catch(() => {});
      }
      const minDelay = env.MIN_DELAY_MS_BETWEEN_SENDS || 1000;
      return baseDelayMs + (staggerIndex - 1) * minDelay;
    } catch {
      return baseDelayMs + 1000;
    }
  }

  /**
   * Triggers a Slack notification if the rate limit was hit.
   */
  public static async handleRateLimitHit(
    userId: string,
    senderEmail: string,
    nextHourDate: Date,
  ): Promise<void> {
    await notifySlackRateLimitHit(userId, senderEmail, 1, nextHourDate);
  }
}

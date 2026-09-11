import Redis, { RedisOptions } from 'ioredis';
import { env } from '../config/env';
import { notifySlackRateLimitHit } from './slack.service';

const isTls = env.REDIS_URL.startsWith('rediss://');
const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
};

const redis = new Redis(env.REDIS_URL, redisOptions);


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

    // Redis atomic increment
    const currentCount = await redis.incr(key);

    // If this is the first item in this hourly bucket, set TTL for 2 hours (7200s)
    if (currentCount === 1) {
      await redis.expire(key, 7200);
    }

    if (currentCount > limit) {
      // Hour cap exceeded: do not count this toward the current bucket
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
    const staggerKey = `stagger:${senderId}:${nextHourDate.toISOString()}`;
    const staggerIndex = await redis.incr(staggerKey);
    if (staggerIndex === 1) {
      await redis.expire(staggerKey, 7200);
    }

    const minDelay = env.MIN_DELAY_MS_BETWEEN_SENDS || 1000;
    const staggerOffsetMs = (staggerIndex - 1) * minDelay;

    return baseDelayMs + staggerOffsetMs;
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

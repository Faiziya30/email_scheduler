import { WebClient } from '@slack/web-api';
import { env } from '../config/env';
import { prisma } from '../models';
import Redis, { RedisOptions } from 'ioredis';
import { normalizeRedisUrl } from '../config/redis';

// Dedicated lightweight Redis client for Slack dedup checks
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
const slackRedis = new Redis(redisUrl, redisOptions);
slackRedis.on('error', () => {}); // silent

export const getSlackAuthorizeUrl = (state?: string): string => {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'chat:write,chat:write.public,incoming-webhook',
    redirect_uri: env.SLACK_REDIRECT_URI,
    ...(state && { state }),
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
};

export const handleSlackCallback = async (code: string, userId: string) => {
  try {
    const client = new WebClient();
    const response = await client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    });

    if (!response.ok || !response.access_token) {
      throw new Error(`Slack OAuth error: ${response.error || 'Unknown error'}`);
    }

    const existing = await prisma.slackIntegration.findFirst({
      where: { userId },
    });

    let integration;
    if (existing) {
      integration = await prisma.slackIntegration.update({
        where: { id: existing.id },
        data: {
          accessToken: response.access_token,
          teamId: response.team?.id,
          teamName: response.team?.name,
          webhookUrl: (response as any).incoming_webhook?.url,
          channelId: (response as any).incoming_webhook?.channel_id,
          channelName: (response as any).incoming_webhook?.channel,
        },
      });
    } else {
      integration = await prisma.slackIntegration.create({
        data: {
          userId,
          accessToken: response.access_token,
          teamId: response.team?.id,
          teamName: response.team?.name,
          webhookUrl: (response as any).incoming_webhook?.url,
          channelId: (response as any).incoming_webhook?.channel_id,
          channelName: (response as any).incoming_webhook?.channel,
        },
      });
    }

    // Post an immediate live confirmation message into Slack
    try {
      const webhookUrl = (response as any).incoming_webhook?.url;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text: '✅ *ReachInbox Scheduler connected!*\nRate-limit alerts are now active. You will receive a message here whenever a sender hits the hourly email limit.',
          }),
        });
      }
    } catch (msgErr: any) {
      console.warn('⚠️ Welcome message posting note:', msgErr.message);
    }

    return integration;
  } catch (error: any) {
    console.error('❌ Failed to complete Slack OAuth callback:', error.message);
    throw error;
  }
};


/**
 * Sends a Slack rate-limit notification.
 *
 * Deduplication: Uses Redis key `slack_alert:{senderId}:{YYYY-MM-DDTHH}` with a 2-hour TTL
 * so that only ONE Slack message is sent per sender per UTC hour window, regardless of how
 * many individual jobs hit the rate limit during that window.
 *
 * @param isTest  When true, skips dedup so the test button always delivers a message.
 */
export const notifySlackRateLimitHit = async (
  userId: string,
  senderEmail: string,
  rescheduledCount: number,
  nextHourDate: Date,
  isTest = false,
): Promise<void> => {
  try {
    // ── Dedup check (skip for test calls) ──────────────────────────────────
    if (!isTest) {
      const now = new Date();
      const hourKey = `slack_alert:${userId}:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}`;
      try {
        const alreadyNotified = await Promise.race([
          slackRedis.get(hourKey),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
        ]);
        if (alreadyNotified) {
          console.log(`[Slack] ℹ️ Rate-limit alert already sent this hour for sender ${senderEmail}. Skipping duplicate.`);
          return;
        }
        // Mark as notified for this hour window (TTL = 2 hours for safety overlap)
        await Promise.race([
          slackRedis.setex(hourKey, 7200, '1'),
          new Promise<void>((resolve) => setTimeout(resolve, 800)),
        ]);
      } catch {
        // Redis dedup failure is non-fatal – still attempt to notify
      }
    }

    // ── Look up Slack integration for this user ────────────────────────────
    const integration = await prisma.slackIntegration.findFirst({
      where: { userId },
    });

    const timeStr = nextHourDate.toTimeString().split(' ')[0] + ' UTC';
    const prefix = isTest ? '🧪 *[TEST ALERT]* ' : '';
    const message =
      `${prefix}⚠️ *Rate Limit Warning*: Hourly limit reached for sender \`${senderEmail}\`.\n` +
      `📦 Rescheduled jobs: ${rescheduledCount} email(s) queued for next window starting at *${timeStr}*.`;

    if (!integration) {
      console.log(`[Slack] ℹ️ No Slack integration connected for user ${userId}. Skipping alert.`);
      return;
    }

    if (!integration.accessToken || integration.accessToken.startsWith('mock_')) {
      console.log(`[Slack] ℹ️ Mock Slack token for user ${userId}. Simulated notification:\n${message}`);
      return;
    }

    // ── Send via webhook (preferred) or Web API fallback ──────────────────
    if (integration.webhookUrl) {
      const response = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
      if (!response.ok) throw new Error(`Slack webhook returned ${response.status}`);
    } else if (integration.channelId) {
      const client = new WebClient(integration.accessToken);
      await client.chat.postMessage({ channel: integration.channelId, text: message });
    } else {
      throw new Error('Slack integration has no authorized channel');
    }

    console.log(`[Slack] ✅ Rate-limit notification sent to Slack (${isTest ? 'TEST' : 'LIVE'}).`);
  } catch (error: any) {
    console.error(`[Slack] ⚠️ Failed to send Slack alert (non-fatal):`, error.message);
  }
};

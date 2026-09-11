import { WebClient } from '@slack/web-api';
import { env } from '../config/env';
import { prisma } from '../models';

export const getSlackAuthorizeUrl = (state?: string): string => {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'chat:write,chat:write.public',
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
          webhookUrl: (response as any).incoming_webhook?.url,
        },
      });
    } else {
      integration = await prisma.slackIntegration.create({
        data: {
          userId,
          accessToken: response.access_token,
          teamId: response.team?.id,
          webhookUrl: (response as any).incoming_webhook?.url,
        },
      });
    }

    // Post an immediate live confirmation message into Slack
    try {
      const postClient = new WebClient(response.access_token);
      const targetChannel = (response as any).incoming_webhook?.channel_id || '#general';
      await postClient.chat.postMessage({
        channel: targetChannel,
        text: '🎉 *ReachInbox Scheduler Connected!* Your Slack workspace is now integrated and will receive real-time email rate-limit alerts.',
      });
      console.log('✅ Instant Slack welcome message sent to', targetChannel);
    } catch (msgErr: any) {
      console.warn('⚠️ Welcome message posting note:', msgErr.message);
    }

    return integration;
  } catch (error: any) {
    console.error('❌ Failed to complete Slack OAuth callback:', error.message);
    throw error;
  }
};


export const notifySlackRateLimitHit = async (
  userId: string,
  senderEmail: string,
  rescheduledCount: number,
  nextHourDate: Date,
): Promise<void> => {
  try {
    // Look up integration dynamically at event time (no static cache)
    const integration = await prisma.slackIntegration.findFirst({
      where: { userId },
    });

    const message = `⚠️ *Rate Limit Warning*: Hourly limit reached for sender \`${senderEmail}\`.\n` +
      `📦 Rescheduled jobs: ${rescheduledCount} email(s) queued for next window starting at *${nextHourDate.toTimeString().split(' ')[0]} UTC*.`;

    if (!integration) {
      console.log(`[Slack] ℹ️ No Slack integration connected for user ${userId}. Skipping alert notification.`);
      return;
    }

    if (!integration.accessToken || integration.accessToken.startsWith('mock_')) {
      console.log(`[Slack] ℹ️ Mock Slack integration token detected for user ${userId}. Notification simulated:\n${message}`);
      return;
    }

    const client = new WebClient(integration.accessToken);
    await client.chat.postMessage({
      channel: '#general', // or webhook if configured
      text: message,
    });

    console.log(`[Slack] ✅ Rate limit notification sent to Slack successfully.`);
  } catch (error: any) {
    console.error(`[Slack] ⚠️ Failed to send Slack alert (non-fatal):`, error.message);
  }
};

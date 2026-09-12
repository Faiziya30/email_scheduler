import { Router, Request, Response } from 'express';
import { notifySlackRateLimitHit } from '../services/slack.service';
import { getOrCreateDefaultUserAndSender } from '../models/userHelper';
import { RateLimiterService } from '../services/rateLimiter.service';
import { prisma } from '../models';

const router = Router();

// NOTE: /connect and /callback are now in slackPublicRoutes.ts (no authGuard needed)

/**
 * Returns current Slack connection status for the authenticated user.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    let userId = (req as any).user?.id;
    if (!userId) {
      const { user } = await getOrCreateDefaultUserAndSender();
      userId = user.id;
    }

    const integration = await prisma.slackIntegration.findFirst({
      where: { userId },
    });

    const isConnected = Boolean(
      integration && integration.accessToken && !integration.accessToken.startsWith('mock_'),
    );

    res.status(200).json({
      status: 'success',
      data: {
        connected: isConnected,
        teamId: integration?.teamId,
        teamName: integration?.teamName || undefined,
        channelName: integration?.channelName || undefined,
      },
    });
  } catch {
    res.status(200).json({
      status: 'success',
      data: { connected: false },
    });
  }
});

/**
 * Disconnect Slack for the authenticated user.
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    await prisma.slackIntegration.deleteMany({ where: { userId } });
    res.json({ status: 'success', message: 'Slack disconnected.' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Rate-limit usage stats for the current sender/user this hour.
 * Returns { used, limit, senderEmail, nextResetUtc }
 */
router.get('/rate-limit-stats', async (req: Request, res: Response) => {
  try {
    let userId = (req as any).user?.id;
    const { user, sender } = await getOrCreateDefaultUserAndSender(undefined, userId);
    userId = userId || user.id;

    const used = await RateLimiterService.getCurrentHourCount(sender.id);
    const { nextHourDate } = RateLimiterService.getNextHourDetails();

    res.status(200).json({
      status: 'success',
      data: {
        used,
        limit: 3, // matches MAX_EMAILS_PER_HOUR_PER_SENDER env — kept dynamic on client
        senderEmail: sender.emailAddress,
        nextResetUtc: nextHourDate.toISOString(),
      },
    });
  } catch (error: any) {
    res.status(200).json({
      status: 'success',
      data: { used: 0, limit: 3, nextResetUtc: new Date().toISOString() },
    });
  }
});

/**
 * Trigger a live test rate-limit alert message to the user's connected Slack channel.
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    let userId = (req as any).user?.id;
    if (!userId) {
      const { user } = await getOrCreateDefaultUserAndSender();
      userId = user.id;
    }

    const { sender } = await getOrCreateDefaultUserAndSender(undefined, userId);
    const testSender = sender.emailAddress;
    const nextHour = new Date();
    nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);

    await notifySlackRateLimitHit(userId, testSender, 1, nextHour, true /* isTest */);

    res.status(200).json({
      status: 'success',
      message: '✅ Test rate-limit alert dispatched to your Slack channel',
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;

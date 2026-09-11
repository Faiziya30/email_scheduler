import { Router, Request, Response } from 'express';
import { getSlackAuthorizeUrl, handleSlackCallback, notifySlackRateLimitHit } from '../services/slack.service';
import { getOrCreateDefaultUserAndSender } from '../models/userHelper';
import { prisma } from '../models';
import { env } from '../config/env';

const router = Router();

router.get('/connect', (_req: Request, res: Response) => {
  const url = getSlackAuthorizeUrl();
  res.redirect(url);
});

router.get('/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error) {
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=missing_code`);
    return;
  }

  try {
    const { user } = await getOrCreateDefaultUserAndSender();
    await handleSlackCallback(code, user.id);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err: any) {
    console.error('❌ Slack callback error:', err?.message || err);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Returns current Slack connection status
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

    const isConnected = Boolean(integration && integration.accessToken && !integration.accessToken.startsWith('mock_'));

    res.status(200).json({
      status: 'success',
      data: {
        connected: isConnected,
        teamId: integration?.teamId,
      },
    });
  } catch (error: any) {
    res.status(200).json({
      status: 'success',
      data: { connected: false },
    });
  }
});

/**
 * Trigger a test rate-limit alert message to Slack
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    let userId = (req as any).user?.id;
    if (!userId) {
      const { user } = await getOrCreateDefaultUserAndSender();
      userId = user.id;
    }

    const testSender = 'faiziya@reachinbox.ai';
    const nextHour = new Date(Date.now() + 3600000);
    await notifySlackRateLimitHit(userId, testSender, 5, nextHour);

    res.status(200).json({
      status: 'success',
      message: 'Test rate-limit alert dispatched to Slack channel',
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;



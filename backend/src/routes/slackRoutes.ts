import { Router, Request, Response } from 'express';
import { getSlackAuthorizeUrl, handleSlackCallback, notifySlackRateLimitHit } from '../services/slack.service';
import { getOrCreateDefaultUserAndSender } from '../models/userHelper';
import { prisma } from '../models';
import { env } from '../config/env';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/connect', (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Authentication required.' });
    return;
  }

  if (env.SLACK_CLIENT_ID.startsWith('mock_') || env.SLACK_CLIENT_SECRET.startsWith('mock_')) {
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent('Slack OAuth is not configured on the deployed backend')}`);
    return;
  }

  const state = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '10m' });
  const url = getSlackAuthorizeUrl(state);
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
    if (!req.query.state || typeof req.query.state !== 'string') {
      throw new Error('Missing Slack OAuth state');
    }

    const state = jwt.verify(req.query.state, env.JWT_SECRET) as { userId?: string };
    if (!state.userId) {
      throw new Error('Invalid Slack OAuth state');
    }

    await handleSlackCallback(code, state.userId);
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
        teamName: (integration as any)?.teamName || undefined,
        channelName: (integration as any)?.channelName || undefined,
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



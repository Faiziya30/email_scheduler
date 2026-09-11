import { Router, Request, Response } from 'express';
import { getSlackAuthorizeUrl, handleSlackCallback } from '../services/slack.service';
import { getOrCreateDefaultUserAndSender } from '../models/userHelper';
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

export default router;


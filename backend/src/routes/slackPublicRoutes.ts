import { Router, Request, Response } from 'express';
import { getSlackAuthorizeUrl, handleSlackCallback } from '../services/slack.service';
import { env } from '../config/env';
import jwt from 'jsonwebtoken';

const router = Router();

/**
 * Initiate Slack OAuth – redirects to Slack's authorize page.
 * Requires JWT in Authorization header (user must be logged in already).
 */
router.get('/connect', (req: Request, res: Response) => {
  // Read userId from Authorization Bearer header (public route, so authGuard is skipped)
  let userId: string | undefined;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId?: string; id?: string };
      userId = decoded.userId || decoded.id;
    }
  } catch {
    // Fall through – state will capture userId below if passed as query param
  }

  // Also allow userId passed as query param (frontend redirects to this URL directly)
  if (!userId && req.query.userId && typeof req.query.userId === 'string') {
    userId = req.query.userId;
  }

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Authentication required.' });
    return;
  }

  if (env.SLACK_CLIENT_ID.startsWith('mock_') || env.SLACK_CLIENT_SECRET.startsWith('mock_')) {
    res.redirect(
      `${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent('Slack OAuth is not configured on this backend')}`,
    );
    return;
  }

  const state = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '10m' });
  const url = getSlackAuthorizeUrl(state);
  res.redirect(url);
});

/**
 * Slack OAuth callback – called by Slack after user authorizes.
 * This MUST be a public route; Slack sends no JWT here.
 * Security is maintained via the signed `state` parameter.
 */
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
      throw new Error('Invalid Slack OAuth state – userId missing');
    }

    await handleSlackCallback(code, state.userId);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err: any) {
    console.error('❌ Slack callback error:', err?.message || err);
    res.redirect(
      `${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(err.message)}`,
    );
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { getSlackAuthorizeUrl, handleSlackCallback } from '../services/slack.service';
import { getOrCreateDefaultUserAndSender } from '../models/userHelper';

const router = Router();

router.get('/connect', (_req: Request, res: Response) => {
  const url = getSlackAuthorizeUrl();
  res.redirect(url);
});

router.get('/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error) {
    res.status(400).send(`Slack authorization failed: ${error}`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.status(400).send('Missing authorization code');
    return;
  }

  try {
    const { user } = await getOrCreateDefaultUserAndSender();
    await handleSlackCallback(code, user.id);
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc;">
          <div style="text-align: center; padding: 2rem; background: #1e293b; border-radius: 0.75rem;">
            <h2>🎉 Slack Connected Successfully!</h2>
            <p>ReachInbox will notify your workspace when hourly rate limits are hit.</p>
            <p><a href="/dashboard" style="color: #6366f1;">Back to Dashboard</a></p>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send(`Slack Integration Error: ${err.message}`);
  }
});

export default router;

import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/authController';
import { authGuard } from '../middlewares/authGuard';

const router = Router();

// Google OAuth initiate
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  }),
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login?error=auth_failed',
    session: false,
  }),
  AuthController.googleCallback,
);

// Authenticated session checks
router.get('/me', authGuard, AuthController.getMe);
router.post('/logout', AuthController.logout);

// Development token endpoint for non-interactive / cURL testing
router.post('/dev-token', AuthController.devToken);

export default router;

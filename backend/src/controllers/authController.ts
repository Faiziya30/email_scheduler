import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { getOrCreateDefaultUserAndSender } from '../models/userHelper';

export class AuthController {
  public static issueTokenAndSetCookie(res: Response, user: { id: string; email: string }) {
    const token = jwt.sign(
      { id: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return token;
  }

  public static async googleCallback(req: Request, res: Response) {
    if (!req.user) {
      res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
      return;
    }

    AuthController.issueTokenAndSetCookie(res, req.user);
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  }

  public static async getMe(req: Request, res: Response) {
    res.status(200).json({
      status: 'success',
      data: req.user,
    });
  }

  public static async logout(_req: Request, res: Response) {
    res.clearCookie('token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  }

  /**
   * Helper endpoint to issue a test JWT for the default seeded user.
   * Enables seamless API verification before Google Cloud OAuth credentials are configured.
   */
  public static async devToken(_req: Request, res: Response) {
    const { user } = await getOrCreateDefaultUserAndSender();
    const token = AuthController.issueTokenAndSetCookie(res, user);

    res.status(200).json({
      status: 'success',
      message: 'Dev test token issued',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  }
}

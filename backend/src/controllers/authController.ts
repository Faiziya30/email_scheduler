import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { getOrCreateDefaultUserAndSender } from '../models/userHelper';
import { prisma } from '../models/index';

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
   * Register a new user with email + password.
   */
  public static async signup(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        res.status(400).json({ status: 'error', message: 'Email and password are required.' });
        return;
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(409).json({ status: 'error', message: 'An account with this email already exists.' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || email.split('@')[0],
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email.split('@')[0])}&background=00A854&color=fff`,
        },
      });

      // Auto-create a default sender for this user
      await prisma.sender.create({
        data: {
          userId: user.id,
          emailAddress: email,
        },
      });

      const token = AuthController.issueTokenAndSetCookie(res, user);

      res.status(201).json({
        status: 'success',
        message: 'Account created successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error: any) {
      console.error('[Signup Error]', error);
      res.status(500).json({ status: 'error', message: 'Internal server error during signup.' });
    }
  }

  /**
   * Authenticate existing user with email + password.
   */
  public static async emailLogin(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ status: 'error', message: 'Email and password are required.' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.password) {
        res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
        return;
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
        return;
      }

      const token = AuthController.issueTokenAndSetCookie(res, user);

      res.status(200).json({
        status: 'success',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error: any) {
      console.error('[Email Login Error]', error);
      res.status(500).json({ status: 'error', message: 'Internal server error during login.' });
    }
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


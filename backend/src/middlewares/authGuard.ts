import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../models';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authGuard = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token = req.cookies?.token;

    // Also support Authorization: Bearer <token> for API testing and cURL
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'Authentication required. Missing access token.',
      });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'User no longer exists. Please re-authenticate.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    res.status(401).json({
      status: 'error',
      statusCode: 401,
      message: 'Invalid or expired access token.',
    });
  }
};

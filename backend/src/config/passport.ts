import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env';
import { prisma } from '../models';

export const initPassport = () => {
  const isMockGoogle =
    !env.GOOGLE_CLIENT_ID ||
    env.GOOGLE_CLIENT_ID.startsWith('mock_') ||
    env.GOOGLE_CLIENT_ID.startsWith('your_');

  if (isMockGoogle) {
    console.log(
      '🔑 Google OAuth: Mock/placeholder credentials detected. Google strategy registered in standby mode.',
    );
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID || 'placeholder_client_id',
        clientSecret: env.GOOGLE_CLIENT_SECRET || 'placeholder_client_secret',
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName || profile.name?.givenName || 'Google User';
          const avatarUrl = profile.photos?.[0]?.value;

          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          const user = await prisma.user.upsert({
            where: { googleId },
            create: {
              googleId,
              email,
              name,
              avatarUrl,
            },
            update: {
              email,
              name,
              avatarUrl,
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error as Error, undefined);
        }
      },
    ),
  );
};

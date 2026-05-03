import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

// We only need stateless OAuth (JWT) so no session serialization is strictly needed, 
// but passport sometimes complains without it.
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email found from Google'), false);

          let user = await prisma.user.findUnique({ where: { email } });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: profile.displayName || email.split('@')[0],
                avatar: profile.photos?.[0]?.value,
                googleId: profile.id,
              },
            });
            // Bootstrap usage and settings
            await prisma.usage.create({ data: { userId: user.id, credits: 100 } });
            await prisma.settings.create({ data: { userId: user.id } });
          } else if (!user.googleId) {
            // Link account
            user = await prisma.user.update({
              where: { email },
              data: { googleId: profile.id },
            });
          }

          return done(null, user);
        } catch (error) {
          logger.error(`Google Auth Error: ${error}`);
          return done(error, false);
        }
      }
    )
  );
}

// GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: '/api/auth/github/callback',
        scope: ['user:email'],
      },
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email found from GitHub'), false);

          let user = await prisma.user.findUnique({ where: { email } });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: profile.displayName || profile.username || email.split('@')[0],
                avatar: profile.photos?.[0]?.value,
                githubId: profile.id,
              },
            });
            // Bootstrap usage and settings
            await prisma.usage.create({ data: { userId: user.id, credits: 100 } });
            await prisma.settings.create({ data: { userId: user.id } });
          } else if (!user.githubId) {
            // Link account
            user = await prisma.user.update({
              where: { email },
              data: { githubId: profile.id },
            });
          }

          return done(null, user);
        } catch (error) {
          logger.error(`GitHub Auth Error: ${error}`);
          return done(error, false);
        }
      }
    )
  );
}

export default passport;

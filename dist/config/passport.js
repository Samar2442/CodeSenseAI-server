"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_github2_1 = require("passport-github2");
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../utils/logger");
// We only need stateless OAuth (JWT) so no session serialization is strictly needed, 
// but passport sometimes complains without it.
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser(async (id, done) => {
    try {
        const user = await prisma_1.default.user.findUnique({ where: { id } });
        done(null, user);
    }
    catch (error) {
        done(error, null);
    }
});
// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email)
                return done(new Error('No email found from Google'), false);
            let user = await prisma_1.default.user.findUnique({ where: { email } });
            if (!user) {
                user = await prisma_1.default.user.create({
                    data: {
                        email,
                        name: profile.displayName || email.split('@')[0],
                        avatar: profile.photos?.[0]?.value,
                        googleId: profile.id,
                    },
                });
                // Bootstrap usage and settings
                await prisma_1.default.usage.create({ data: { userId: user.id, credits: 100 } });
                await prisma_1.default.settings.create({ data: { userId: user.id } });
            }
            else if (!user.googleId) {
                // Link account
                user = await prisma_1.default.user.update({
                    where: { email },
                    data: { googleId: profile.id },
                });
            }
            return done(null, user);
        }
        catch (error) {
            logger_1.logger.error(`Google Auth Error: ${error}`);
            return done(error, false);
        }
    }));
}
// GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport_1.default.use(new passport_github2_1.Strategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: '/api/auth/github/callback',
        scope: ['user:email'],
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email)
                return done(new Error('No email found from GitHub'), false);
            let user = await prisma_1.default.user.findUnique({ where: { email } });
            if (!user) {
                user = await prisma_1.default.user.create({
                    data: {
                        email,
                        name: profile.displayName || profile.username || email.split('@')[0],
                        avatar: profile.photos?.[0]?.value,
                        githubId: profile.id,
                    },
                });
                // Bootstrap usage and settings
                await prisma_1.default.usage.create({ data: { userId: user.id, credits: 100 } });
                await prisma_1.default.settings.create({ data: { userId: user.id } });
            }
            else if (!user.githubId) {
                // Link account
                user = await prisma_1.default.user.update({
                    where: { email },
                    data: { githubId: profile.id },
                });
            }
            return done(null, user);
        }
        catch (error) {
            logger_1.logger.error(`GitHub Auth Error: ${error}`);
            return done(error, false);
        }
    }));
}
exports.default = passport_1.default;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthCallback = exports.getMe = exports.refreshToken = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    name: zod_1.z.string().min(1, 'Name is required').optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const generateTokens = (userId) => {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
    const accessToken = jsonwebtoken_1.default.sign({ userId }, secret, { expiresIn: '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ userId }, refreshSecret, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};
const register = async (req, res) => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0].message });
        }
        const { email, password, name } = parsed.data;
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists.' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const user = await prisma_1.default.user.create({
            data: { email, password: hashedPassword, name: name || email.split('@')[0] }
        });
        // Bootstrap usage and settings for new user
        await prisma_1.default.usage.create({ data: { userId: user.id, credits: 100 } });
        await prisma_1.default.settings.create({ data: { userId: user.id } });
        const { accessToken, refreshToken } = generateTokens(user.id);
        res.status(201).json({
            user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
            accessToken,
            refreshToken,
            // Legacy support: also send as 'token'
            token: accessToken,
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0].message });
        }
        const { email, password } = parsed.data;
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user || !user.password) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }
        const { accessToken, refreshToken } = generateTokens(user.id);
        res.status(200).json({
            user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
            accessToken,
            refreshToken,
            token: accessToken,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed. Please try again.' });
    }
};
exports.login = login;
const refreshToken = async (req, res) => {
    try {
        const { refreshToken: token } = req.body;
        if (!token)
            return res.status(401).json({ message: 'Refresh token required.' });
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_REFRESH_SECRET);
        const user = await prisma_1.default.user.findUnique({ where: { id: decoded.userId } });
        if (!user)
            return res.status(401).json({ message: 'User not found.' });
        const { accessToken, refreshToken: newRefresh } = generateTokens(user.id);
        res.json({ accessToken, refreshToken: newRefresh, token: accessToken });
    }
    catch {
        res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }
};
exports.refreshToken = refreshToken;
const getMe = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { usage: true, subscription: true, settings: true },
        });
        if (!user)
            return res.status(404).json({ message: 'User not found.' });
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            usage: user.usage,
            subscription: user.subscription,
            settings: user.settings,
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch user data.' });
    }
};
exports.getMe = getMe;
const oauthCallback = async (req, res) => {
    // Passport puts the authenticated user in req.user
    if (!req.user) {
        return res.status(401).json({ message: 'OAuth Authentication Failed' });
    }
    const user = req.user;
    const { accessToken, refreshToken } = generateTokens(user.id);
    // In a real app, you would redirect back to the client app with the token
    // For API context, if this is called via popup/redirect, we redirect to client
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
};
exports.oauthCallback = oauthCallback;

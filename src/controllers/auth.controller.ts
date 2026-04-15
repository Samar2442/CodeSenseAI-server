import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const generateTokens = (userId: string) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
  const accessToken = jwt.sign(
    { userId },
    secret,
    { expiresIn: '15m' as any }
  );
  const refreshToken = jwt.sign(
    { userId },
    refreshSecret,
    { expiresIn: '7d' as any }
  );
  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { email, password, name } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name: name || email.split('@')[0] }
    });

    // Bootstrap usage and settings for new user
    await prisma.usage.create({ data: { userId: user.id, credits: 100 } });
    await prisma.settings.create({ data: { userId: user.id } });

    const { accessToken, refreshToken } = generateTokens(user.id);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      accessToken,
      refreshToken,
      // Legacy support: also send as 'token'
      token: accessToken,
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
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
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(401).json({ message: 'Refresh token required.' });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ message: 'User not found.' });

    const { accessToken, refreshToken: newRefresh } = generateTokens(user.id);
    res.json({ accessToken, refreshToken: newRefresh, token: accessToken });
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token.' });
  }
};

export const getMe = async (req: Request & { user?: { userId: string } }, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { usage: true, subscription: true, settings: true },
    });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      usage: user.usage,
      subscription: user.subscription,
      settings: user.settings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user data.' });
  }
};

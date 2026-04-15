import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { analyzeCode, chatWithAI, detectLanguage } from '../services/ai.service';
import { AuthRequest } from '../middleware/auth.middleware';

const reviewSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  language: z.string().optional(),
});

export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { code, language } = parsed.data;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Auto-detect language if not provided
    const detectedLanguage = language || (await detectLanguage(code));

    // Run AI analysis
    const analysis = await analyzeCode(code, detectedLanguage);

    // Save to DB
    const review = await prisma.codeReview.create({
      data: {
        userId,
        codeSnippet: code,
        language: detectedLanguage,
        score: analysis.score || 0,
        issuesList: JSON.stringify(analysis.issues || []),
        optimized: analysis.optimizedCode || null,
        explanation: analysis.explanation || null,
      }
    });

    // Update analytics
    await updateAnalytics(userId, analysis.score || 0, (analysis.issues || []).length);

    res.status(201).json({
      id: review.id,
      language: review.language,
      score: review.score,
      issues: analysis.issues || [],
      optimizedCode: analysis.optimizedCode || null,
      explanation: analysis.explanation || null,
      createdAt: review.createdAt,
    });
  } catch (error: any) {
    console.error('Review error:', error.message);
    res.status(500).json({ message: 'Analysis failed. Please try again.', error: error.message });
  }
};

export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const reviews = await prisma.codeReview.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        language: true,
        score: true,
        issuesList: true,
        createdAt: true,
      }
    });

    const formatted = reviews.map(r => ({
      ...r,
      issues: (() => { try { return JSON.parse(r.issuesList); } catch { return []; } })(),
      issuesList: undefined,
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch history', error: error.message });
  }
};

export const getReviewById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const review = await prisma.codeReview.findFirst({
      where: { id, userId }
    });

    if (!review) return res.status(404).json({ message: 'Review not found' });

    res.json({
      ...review,
      issues: (() => { try { return JSON.parse(review.issuesList); } catch { return []; } })(),
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch review', error: error.message });
  }
};

export const chatWithCode = async (req: AuthRequest, res: Response) => {
  try {
    const { message, code, language, history } = req.body;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!message) return res.status(400).json({ message: 'Message is required' });

    const reply = await chatWithAI(message, code, language, history || []);

    // Save chat history
    await prisma.chatHistory.upsert({
      where: { id: `${userId}-latest` },
      create: {
        id: `${userId}-latest`,
        userId,
        messages: JSON.stringify([...(history || []), { role: 'user', content: message }, { role: 'assistant', content: reply }])
      },
      update: {
        messages: JSON.stringify([...(history || []), { role: 'user', content: message }, { role: 'assistant', content: reply }])
      }
    });

    res.json({ reply });
  } catch (error: any) {
    res.status(500).json({ message: 'Chat failed', error: error.message });
  }
};

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const reviews = await prisma.codeReview.findMany({
      where: { userId },
      select: { score: true, language: true, issuesList: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalReviews = reviews.length;
    const avgScore = totalReviews > 0
      ? Math.round(reviews.reduce((s, r) => s + r.score, 0) / totalReviews)
      : 0;

    // Issue severity distribution
    const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    reviews.forEach(r => {
      try {
        const issues = JSON.parse(r.issuesList);
        issues.forEach((issue: any) => {
          if (issue.severity in severityCounts) {
            severityCounts[issue.severity as keyof typeof severityCounts]++;
          }
        });
      } catch {}
    });

    // Language distribution
    const langDist: Record<string, number> = {};
    reviews.forEach(r => { langDist[r.language] = (langDist[r.language] || 0) + 1; });

    // Score over time (last 30)
    const scoreHistory = reviews.slice(-30).map(r => ({
      date: r.createdAt.toISOString().split('T')[0],
      score: r.score,
    }));

    res.json({
      totalReviews,
      avgScore,
      severityDistribution: severityCounts,
      languageDistribution: langDist,
      scoreHistory,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
};

async function updateAnalytics(userId: string, score: number, issueCount: number) {
  try {
    const existing = await prisma.analytics.findFirst({ where: { userId } });
    if (existing) {
      await prisma.analytics.update({
        where: { id: existing.id },
        data: {
          totalReviews: existing.totalReviews + 1,
          avgScore: (existing.avgScore * existing.totalReviews + score) / (existing.totalReviews + 1),
          issuesFound: existing.issuesFound + issueCount,
        }
      });
    } else {
      await prisma.analytics.create({
        data: { userId, totalReviews: 1, avgScore: score, issuesFound: issueCount }
      });
    }
  } catch (e) {
    console.error('Analytics update failed:', e);
  }
}

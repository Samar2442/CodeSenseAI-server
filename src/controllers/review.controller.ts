import { Response } from 'express';
import prisma from '../lib/prisma';
import { analyzeCode } from '../services/ai.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const { code, language } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!code) {
      return res.status(400).json({ message: 'Code to review is required' });
    }

    // AI Analysis
    const analysis = await analyzeCode(code, language || 'javascript');

    // Auto get or create default project for this user
    let project = await prisma.project.findFirst({
      where: { userId, name: 'Default Project' }
    });

    if (!project) {
      project = await prisma.project.create({
        data: { name: 'Default Project', userId }
      });
    }
    
    // We save the original code inside the content JSON block to recall it for history
    const payloadToSave = {
      code,
      ...analysis
    };

    const review = await prisma.review.create({
      data: {
        projectId: project.id,
        language: language || 'javascript',
        content: JSON.stringify(payloadToSave),
        score: analysis.score || 0
      }
    });

    res.status(201).json(review);
  } catch (error: any) {
    res.status(500).json({ message: 'Analysis failed', error: error.message });
  }
};

export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // find all projects owned by the user
    const projects = await prisma.project.findMany({
      where: { userId },
      select: { id: true }
    });
    
    const projectIds = projects.map(p => p.id);

    // Get all reviews belonging to these projects
    const reviews = await prisma.review.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json(reviews);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch history', error: error.message });
  }
};


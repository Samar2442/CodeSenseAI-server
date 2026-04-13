"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistory = exports.createReview = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const ai_service_1 = require("../services/ai.service");
const createReview = async (req, res) => {
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
        const analysis = await (0, ai_service_1.analyzeCode)(code, language || 'javascript');
        // Auto get or create default project for this user
        let project = await prisma_1.default.project.findFirst({
            where: { userId, name: 'Default Project' }
        });
        if (!project) {
            project = await prisma_1.default.project.create({
                data: { name: 'Default Project', userId }
            });
        }
        // We save the original code inside the content JSON block to recall it for history
        const payloadToSave = {
            code,
            ...analysis
        };
        const review = await prisma_1.default.review.create({
            data: {
                projectId: project.id,
                language: language || 'javascript',
                content: JSON.stringify(payloadToSave),
                score: analysis.score || 0
            }
        });
        res.status(201).json(review);
    }
    catch (error) {
        res.status(500).json({ message: 'Analysis failed', error: error.message });
    }
};
exports.createReview = createReview;
const getHistory = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        // find all projects owned by the user
        const projects = await prisma_1.default.project.findMany({
            where: { userId },
            select: { id: true }
        });
        const projectIds = projects.map(p => p.id);
        // Get all reviews belonging to these projects
        const reviews = await prisma_1.default.review.findMany({
            where: { projectId: { in: projectIds } },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(reviews);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch history', error: error.message });
    }
};
exports.getHistory = getHistory;

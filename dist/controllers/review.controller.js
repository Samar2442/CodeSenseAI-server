"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalytics = exports.chatWithCode = exports.getReviewById = exports.getHistory = exports.createReview = void 0;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const ai_service_1 = require("../services/ai.service");
const reviewSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Code is required'),
    language: zod_1.z.string().optional(),
});
const createReview = async (req, res) => {
    try {
        const parsed = reviewSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0].message });
        }
        const { code, language } = parsed.data;
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        // Auto-detect language if not provided
        const detectedLanguage = language || (await (0, ai_service_1.detectLanguage)(code));
        // Run AI analysis
        const analysis = await (0, ai_service_1.analyzeCode)(code, detectedLanguage);
        // Save to DB
        const review = await prisma_1.default.codeReview.create({
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
    }
    catch (error) {
        console.error('Review error:', error.message);
        res.status(500).json({ message: 'Analysis failed. Please try again.', error: error.message });
    }
};
exports.createReview = createReview;
const getHistory = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const reviews = await prisma_1.default.codeReview.findMany({
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
            issues: (() => { try {
                return JSON.parse(r.issuesList);
            }
            catch {
                return [];
            } })(),
            issuesList: undefined,
        }));
        res.json(formatted);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch history', error: error.message });
    }
};
exports.getHistory = getHistory;
const getReviewById = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const id = req.params.id;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const review = await prisma_1.default.codeReview.findFirst({
            where: { id, userId }
        });
        if (!review)
            return res.status(404).json({ message: 'Review not found' });
        res.json({
            ...review,
            issues: (() => { try {
                return JSON.parse(review.issuesList);
            }
            catch {
                return [];
            } })(),
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch review', error: error.message });
    }
};
exports.getReviewById = getReviewById;
const chatWithCode = async (req, res) => {
    try {
        const { message, code, language, history } = req.body;
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        if (!message)
            return res.status(400).json({ message: 'Message is required' });
        const reply = await (0, ai_service_1.chatWithAI)(message, code, language, history || []);
        // Save chat history
        await prisma_1.default.chatHistory.upsert({
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
    }
    catch (error) {
        res.status(500).json({ message: 'Chat failed', error: error.message });
    }
};
exports.chatWithCode = chatWithCode;
const getAnalytics = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const reviews = await prisma_1.default.codeReview.findMany({
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
                issues.forEach((issue) => {
                    if (issue.severity in severityCounts) {
                        severityCounts[issue.severity]++;
                    }
                });
            }
            catch { }
        });
        // Language distribution
        const langDist = {};
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
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
    }
};
exports.getAnalytics = getAnalytics;
async function updateAnalytics(userId, score, issueCount) {
    try {
        const existing = await prisma_1.default.analytics.findFirst({ where: { userId } });
        if (existing) {
            await prisma_1.default.analytics.update({
                where: { id: existing.id },
                data: {
                    totalReviews: existing.totalReviews + 1,
                    avgScore: (existing.avgScore * existing.totalReviews + score) / (existing.totalReviews + 1),
                    issuesFound: existing.issuesFound + issueCount,
                }
            });
        }
        else {
            await prisma_1.default.analytics.create({
                data: { userId, totalReviews: 1, avgScore: score, issuesFound: issueCount }
            });
        }
    }
    catch (e) {
        console.error('Analytics update failed:', e);
    }
}

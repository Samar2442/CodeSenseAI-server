"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const passport_1 = __importDefault(require("./config/passport"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
// Security and utility middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));
app.use(express_1.default.json({ limit: '2mb' }));
app.use(passport_1.default.initialize());
// Logging middleware
app.use((req, res, next) => {
    logger_1.logger.info(`[${req.method}] ${req.url}`);
    next();
});
// Rate limiting configurations
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { message: 'Too many requests, please try again later.' }
});
const aiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { message: 'AI rate limit exceeded. Please wait a moment.' }
});
// API Routes
app.use('/api', generalLimiter);
app.use('/api/auth', auth_routes_1.default);
app.use('/api', review_routes_1.default);
// Apply stricter rate limit to AI endpoints
app.use('/api/code-review', aiLimiter);
app.use('/api/chat', aiLimiter);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});
// Error handling
app.use(error_middleware_1.notFoundHandler);
app.use(error_middleware_1.errorHandler);
exports.default = app;

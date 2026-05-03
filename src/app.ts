import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passportConfig from './config/passport';
import authRoutes from './routes/auth.routes';
import reviewRoutes from './routes/review.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(passportConfig.initialize());


// Logging middleware
app.use((req, res, next) => {
  logger.info(`[${req.method}] ${req.url}`);
  next();
});

// Rate limiting configurations
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { message: 'Too many requests, please try again later.' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { message: 'AI rate limit exceeded. Please wait a moment.' }
});

// API Routes
app.use('/api', generalLimiter);
app.use('/api/auth', authRoutes);
app.use('/api', reviewRoutes);

// Apply stricter rate limit to AI endpoints
app.use('/api/code-review', aiLimiter);
app.use('/api/chat', aiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

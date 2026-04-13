import { Router, RequestHandler } from 'express';
import * as ReviewController from '../controllers/review.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware as RequestHandler);

router.post('/code-review', ReviewController.createReview as RequestHandler);
router.get('/history', ReviewController.getHistory as RequestHandler);

export default router;

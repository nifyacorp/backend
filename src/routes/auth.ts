import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';

const router = Router();

// Health check endpoint for auth routes
router.get('/health', (_req, res) => {
  res.status(StatusCodes.OK).json({
    status: 'healthy',
    message: 'Auth routes are configured to use external auth service'
  });
});

export default router;
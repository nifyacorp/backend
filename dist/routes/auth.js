import { Router } from 'express';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { AuthService } from '../services/auth.js';
import { validate } from '../middleware/validate.js';
const router = Router();
const authService = new AuthService();
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});
const refreshSchema = z.object({
    refreshToken: z.string(),
});
router.post('/login', validate(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const response = await authService.login(email, password);
        res.status(StatusCodes.OK).json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const response = await authService.refreshToken(refreshToken);
        res.status(StatusCodes.OK).json(response);
    }
    catch (error) {
        next(error);
    }
});
export default router;

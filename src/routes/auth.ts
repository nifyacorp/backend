import { Router } from 'express';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { authenticate } from '../middleware/auth.js';
import { AuthService } from '../services/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const authService = new AuthService();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const passwordResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

router.post('/signup', validate(signupSchema), async (req, res, next) => {
  try {
    const response = await authService.signup(req.body);
    res.status(StatusCodes.CREATED).json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const response = await authService.login(email, password);
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = req.headers.authorization!.split(' ')[1];
    await authService.logout(token);
    res.status(StatusCodes.OK).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const response = await authService.refreshToken(refreshToken);
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const token = req.headers.authorization!.split(' ')[1];
    const profile = await authService.getProfile(token);
    res.status(StatusCodes.OK).json(profile);
  } catch (error) {
    next(error);
  }
});

router.post('/revoke-all-sessions', authenticate, async (req, res, next) => {
  try {
    const token = req.headers.authorization!.split(' ')[1];
    await authService.revokeAllSessions(token);
    res.status(StatusCodes.OK).json({ message: 'All sessions revoked successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);
    res.status(StatusCodes.OK).json({ message: 'Password reset instructions sent' });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', validate(passwordResetSchema), async (req, res, next) => {
  try {
    await authService.resetPassword(req.body);
    res.status(StatusCodes.OK).json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', authenticate, validate(passwordChangeSchema), async (req, res, next) => {
  try {
    const token = req.headers.authorization!.split(' ')[1];
    await authService.changePassword(token, req.body);
    res.status(StatusCodes.OK).json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;
    await authService.verifyEmail(token);
    res.status(StatusCodes.OK).json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/google/login', async (_req, res, next) => {
  try {
    const response = await authService.initiateGoogleLogin();
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
});

router.get('/google/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query as { code: string; state: string };
    const response = await authService.handleGoogleCallback({ code, state });
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
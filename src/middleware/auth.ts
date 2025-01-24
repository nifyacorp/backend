import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { User } from '../types/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Authentication will be handled by Cloud Run's built-in authentication
    // For now, we'll pass through all requests
    next();
  } catch (error) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      error: 'Invalid token',
    });
  }
};
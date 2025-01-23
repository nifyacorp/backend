import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { jwtVerify } from 'jose';
import { getConfig } from '../config/index.js';
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
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.split(' ')[1];
    const config = await getConfig();
    const encoder = new TextEncoder();
    
    const { payload } = await jwtVerify(
      token,
      encoder.encode(config.JWT_SECRET)
    );

    // Validate payload structure
    const user: User = {
      id: payload.sub as string,
      email: payload.email as string,
      roles: (payload.roles as string[]) || []
    };

    req.user = user;
    next();
  } catch (error) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      error: 'Invalid token',
    });
  }
};
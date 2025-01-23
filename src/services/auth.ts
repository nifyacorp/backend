import { StatusCodes } from 'http-status-codes';
import config from '../config/index.js';
import { AuthResponse } from '../types/auth.js';
import { createError } from '../utils/error.js';

export class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.AUTH_SERVICE_URL;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw createError(
        'Authentication failed',
        response.status === StatusCodes.UNAUTHORIZED
          ? StatusCodes.UNAUTHORIZED
          : StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    return response.json();
  }

  async refreshToken(token: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: token }),
    });

    if (!response.ok) {
      throw createError(
        'Token refresh failed',
        response.status === StatusCodes.UNAUTHORIZED
          ? StatusCodes.UNAUTHORIZED
          : StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    return response.json();
  }
}
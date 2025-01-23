import { StatusCodes } from 'http-status-codes';
import { getConfig } from '../config/index.js';
import { AuthResponse, SignupData, PasswordResetData, PasswordChangeData, GoogleAuthResponse, GoogleCallbackParams, User } from '../types/auth.js';
import { createError } from '../utils/error.js';

export class AuthService {
  private config: Awaited<ReturnType<typeof getConfig>>;

  constructor() {
    this.config = null as any;
  }

  private async initConfig(): Promise<void> {
    if (!this.config) {
      this.config = await getConfig();
    }
  }

  private async makeRequest<T>(endpoint: string, method: string, body?: unknown): Promise<T> {
    await this.initConfig();
    const response = await fetch(`${this.config.AUTH_SERVICE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw createError(
        'Authentication request failed',
        response.status === StatusCodes.UNAUTHORIZED
          ? StatusCodes.UNAUTHORIZED
          : StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    return response.json();
  }

  private async makeAuthenticatedRequest<T>(endpoint: string, method: string, token: string, body?: unknown): Promise<T> {
    await this.initConfig();
    const response = await fetch(`${this.config.AUTH_SERVICE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw createError(
        'Authentication request failed',
        response.status === StatusCodes.UNAUTHORIZED
          ? StatusCodes.UNAUTHORIZED
          : StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    return response.json();
  }

  async signup(data: SignupData): Promise<AuthResponse> {
    return this.makeRequest<AuthResponse>('/api/auth/signup', 'POST', data);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.makeRequest<AuthResponse>('/api/auth/login', 'POST', { email, password });
  }

  async logout(token: string): Promise<void> {
    return this.makeAuthenticatedRequest<void>('/api/auth/logout', 'POST', token);
  }

  async getProfile(token: string): Promise<User> {
    return this.makeAuthenticatedRequest<User>('/api/auth/me', 'GET', token);
  }

  async refreshToken(token: string): Promise<AuthResponse> {
    return this.makeRequest<AuthResponse>('/api/auth/refresh', 'POST', { refreshToken: token });
  }

  async revokeAllSessions(token: string): Promise<void> {
    return this.makeAuthenticatedRequest<void>('/api/auth/revoke-all-sessions', 'POST', token);
  }

  async forgotPassword(email: string): Promise<void> {
    return this.makeRequest<void>('/api/auth/forgot-password', 'POST', { email });
  }

  async resetPassword(data: PasswordResetData): Promise<void> {
    return this.makeRequest<void>('/api/auth/reset-password', 'POST', data);
  }

  async changePassword(token: string, data: PasswordChangeData): Promise<void> {
    return this.makeAuthenticatedRequest<void>('/api/auth/change-password', 'POST', token, data);
  }

  async verifyEmail(token: string): Promise<void> {
    return this.makeRequest<void>('/api/auth/verify-email', 'POST', { token });
  }

  async initiateGoogleLogin(): Promise<GoogleAuthResponse> {
    return this.makeRequest<GoogleAuthResponse>('/api/auth/google/login', 'POST');
  }

  async handleGoogleCallback(params: GoogleCallbackParams): Promise<AuthResponse> {
    return this.makeRequest<AuthResponse>('/api/auth/google/callback', 'GET');
  }
}
import { StatusCodes } from 'http-status-codes';
import { AuthResponse, SignupData, PasswordResetData, PasswordChangeData, GoogleAuthResponse, GoogleCallbackParams, User } from '../types/auth.js';
import { createError } from '../utils/error.js';

export class AuthService {
  async signup(data: SignupData): Promise<AuthResponse> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async logout(token: string): Promise<void> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async getProfile(token: string): Promise<User> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async refreshToken(token: string): Promise<AuthResponse> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async revokeAllSessions(token: string): Promise<void> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async forgotPassword(email: string): Promise<void> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async resetPassword(data: PasswordResetData): Promise<void> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async changePassword(token: string, data: PasswordChangeData): Promise<void> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async verifyEmail(token: string): Promise<void> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async initiateGoogleLogin(): Promise<GoogleAuthResponse> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }

  async handleGoogleCallback(params: GoogleCallbackParams): Promise<AuthResponse> {
    throw createError('Not implemented', StatusCodes.NOT_IMPLEMENTED);
  }
}
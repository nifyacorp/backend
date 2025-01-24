import { StatusCodes } from 'http-status-codes';
import { createError } from '../utils/error.js';

export class AuthService {
  constructor() {
    throw createError(
      'Auth service is not available - use external auth service instead',
      StatusCodes.NOT_IMPLEMENTED
    );
  }
}
import { StatusCodes } from 'http-status-codes';
import { getConfig } from '../config/index.js';
import { createError } from '../utils/error.js';
export class AuthService {
    config;
    constructor() {
        this.config = null;
    }
    async initConfig() {
        if (!this.config) {
            this.config = await getConfig();
        }
    }
    async login(email, password) {
        await this.initConfig();
        const response = await fetch(`${this.config.AUTH_SERVICE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
            throw createError('Authentication failed', response.status === StatusCodes.UNAUTHORIZED
                ? StatusCodes.UNAUTHORIZED
                : StatusCodes.INTERNAL_SERVER_ERROR);
        }
        return response.json();
    }
    async refreshToken(token) {
        await this.initConfig();
        const response = await fetch(`${this.config.AUTH_SERVICE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: token }),
        });
        if (!response.ok) {
            throw createError('Token refresh failed', response.status === StatusCodes.UNAUTHORIZED
                ? StatusCodes.UNAUTHORIZED
                : StatusCodes.INTERNAL_SERVER_ERROR);
        }
        return response.json();
    }
}

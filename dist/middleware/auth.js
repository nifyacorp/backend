import { StatusCodes } from 'http-status-codes';
import { jwtVerify } from 'jose';
import { getConfig } from '../config/index.js';
export const authenticate = async (req, res, next) => {
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
        const { payload } = await jwtVerify(token, encoder.encode(config.JWT_SECRET));
        // Validate payload structure
        const user = {
            id: payload.sub,
            email: payload.email,
            roles: payload.roles || []
        };
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
            error: 'Invalid token',
        });
    }
};

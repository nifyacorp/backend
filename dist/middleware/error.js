import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import logger from '../utils/logger.js';
export const errorHandler = (err, req, res, _next) => {
    logger.error(err);
    if (err instanceof ZodError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Validation Error',
            details: err.errors,
        });
    }
    if (err.status) {
        return res.status(err.status).json({
            error: err.message,
        });
    }
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Internal Server Error',
    });
};

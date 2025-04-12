import { z } from 'zod';

/**
 * Common base schemas for use across the application
 * These are the most frequently used schema primitives
 */

/**
 * UUID schema with custom error message
 */
export const uuidSchema = z.string().uuid({
  message: 'Invalid UUID format'
});

/**
 * Email schema with custom error message
 */
export const emailSchema = z.string().email({
  message: 'Invalid email address format'
});

/**
 * Basic pagination schema for query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10)
});

/**
 * ID parameter schema for route parameters
 */
export const idParamSchema = z.object({
  id: uuidSchema
});

/**
 * Timestamp schema for ISO date strings
 */
export const timestampSchema = z.string().datetime({
  message: 'Invalid ISO datetime format'
});

/**
 * Boolean with string coercion for query parameters
 * Handles 'true'/'false' strings from URL parameters
 */
export const booleanStringSchema = z.union([
  z.literal('true').transform(() => true),
  z.literal('false').transform(() => false),
  z.boolean()
]);

/**
 * Time string schema for HH:MM format
 * Used for scheduling preferences
 */
export const timeStringSchema = z.string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid time format, expected HH:MM (24-hour format)'
  }); 
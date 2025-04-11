import { z } from 'zod';
import { uuidSchema, emailSchema } from '../common/base.schema.js';

/**
 * User theme enumeration
 */
export const userThemeSchema = z.enum(['light', 'dark', 'system']);

/**
 * User language enumeration
 */
export const userLanguageSchema = z.enum(['es', 'en', 'ca']);

/**
 * Email frequency enumeration
 */
export const emailFrequencySchema = z.enum(['daily', 'immediate']);

/**
 * User ID parameter schema
 */
export const userIdParamSchema = z.object({
  userId: uuidSchema
});

/**
 * Basic user fields schema
 * Common fields used in various user schemas
 */
export const basicUserSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  name: z.string().min(2).max(100),
  avatar: z.string().url().nullable().optional(),
  emailVerified: z.boolean().default(true)
}); 
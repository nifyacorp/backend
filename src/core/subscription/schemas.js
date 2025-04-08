import { z } from 'zod';

// Import the standardized schemas using ES Module syntax
import SubscriptionSchemas from '../../../schemas/subscription/index.js';

const {
  BaseSubscriptionSchema,
  SubscriptionType,
  SubscriptionFrequency,
  PromptsSchema,
  CreateSubscriptionSchema,
  UpdateSubscriptionSchema
} = SubscriptionSchemas;

// Re-export our standardized schemas while maintaining compatibility
export const subscriptionFrequencySchema = SubscriptionFrequency;
export const subscriptionTypeSchema = SubscriptionType;

// Maintain the old export names but use our new standardized schemas
export const createSubscriptionSchema = CreateSubscriptionSchema;
export const updateSubscriptionSchema = UpdateSubscriptionSchema;

// These schemas are not part of our standardization but are still needed
export const toggleSubscriptionSchema = z.object({
  active: z.boolean({
    required_error: 'Active status is required',
    invalid_type_error: 'Active status must be a boolean'
  })
});

// Parameter schemas
export const idParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid subscription ID format' })
});

// Query parameter schemas
export const subscriptionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  type: subscriptionTypeSchema.optional()
});
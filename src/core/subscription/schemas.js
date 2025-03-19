import { z } from 'zod';

// Base schemas for reusable validation
const subscriptionFrequencySchema = z.enum(['immediate', 'daily'], {
  errorMap: () => ({ message: 'Frequency must be either "immediate" or "daily"' })
});

const subscriptionTypeSchema = z.enum(['boe', 'real-estate', 'custom'], {
  errorMap: () => ({ message: 'Type must be one of: boe, real-estate, custom' })
});

// Subscription schemas
export const createSubscriptionSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters long' }).max(100),
  description: z.string().max(500).optional(),
  type: subscriptionTypeSchema,
  typeId: z.string().optional(),
  prompts: z.array(z.string()).min(1, { message: 'At least one prompt is required' }).max(3, { message: 'Maximum 3 prompts allowed' }),
  logo: z.string().url({ message: 'Logo must be a valid URL' }).optional(),
  frequency: subscriptionFrequencySchema
});

export const updateSubscriptionSchema = createSubscriptionSchema.partial();

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
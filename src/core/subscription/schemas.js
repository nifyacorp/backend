import { z } from 'zod';

// Base schemas for reusable validation with more flexibility
const subscriptionFrequencySchema = z.union([
  z.enum(['immediate', 'daily', 'weekly', 'monthly']),
  z.string().transform(val => {
    // Normalize common values
    const normalized = val.toLowerCase();
    if (normalized === 'instant') return 'immediate';
    if (['daily', 'immediate', 'weekly', 'monthly'].includes(normalized)) {
      return normalized;
    }
    return 'daily'; // Default to daily for any other value
  })
]);

// More flexible type schema that accepts various forms
const subscriptionTypeSchema = z.union([
  z.enum(['boe', 'real-estate', 'custom', 'doga']),
  z.string().transform(val => {
    // Normalize type values
    const normalized = val.toLowerCase();
    if (normalized === 'boe') return 'boe';
    if (['real-estate', 'real estate', 'inmobiliaria', 'property'].includes(normalized)) {
      return 'real-estate';
    }
    if (normalized === 'doga') return 'doga';
    return 'custom'; // Default to custom for any other value
  })
]);

// Base subscription schema that can be used for both create and update
const baseSubscriptionSchema = {
  // Accept any string, empty will be caught but with a better error message
  name: z.string().min(1, { message: 'Name is required' }).max(100),
  
  // Description is optional
  description: z.string().max(500).optional().or(z.literal('')),
  
  // Type with flexible normalization
  type: subscriptionTypeSchema,
  
  // Optional typeId (for template-based subscriptions)
  typeId: z.string().optional().or(z.null()),
  
  // Prompts can be an array of strings, a single string, or null/undefined
  prompts: z
    .union([
      z.array(z.string()).min(1).max(3),
      z.string().transform(val => [val]),
      z.null().transform(() => []),
      z.undefined().transform(() => [])
    ])
    .optional()
    .default([])
    .transform(val => {
      // Ensure we always have a valid array, even if the input is unusual
      if (!val) return [];
      if (typeof val === 'string') return [val];
      if (Array.isArray(val)) return val;
      return [];
    }),
  
  // Logo can be any string, validation is looser
  logo: z.string().optional().or(z.null()),
  
  // Frequency with normalization
  frequency: subscriptionFrequencySchema.optional().default('daily')
};

// Subscription schemas with more flexible validation
export const createSubscriptionSchema = z.object(baseSubscriptionSchema)
  // Special output processing to ensure consistent output format
  .transform(data => ({
    ...data,
    // Ensure prompts is always an array
    prompts: Array.isArray(data.prompts) ? data.prompts : [data.prompts].filter(Boolean)
  }));

// Create a standard partial schema for updates
export const updateSubscriptionSchema = z.object({
  ...Object.entries(baseSubscriptionSchema).reduce((acc, [key, schema]) => {
    acc[key] = schema.optional();
    return acc;
  }, {})
});

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
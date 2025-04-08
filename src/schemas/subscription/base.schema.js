const { z } = require('zod');

// Common enums for subscriptions
const SubscriptionFrequency = z.enum(['immediate', 'daily']);

const SubscriptionType = z.enum(['boe', 'real-estate', 'custom']);

// Base subscription schema (fields common to all operations)
const BaseSubscriptionSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters long').max(100, 'Name cannot exceed 100 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  type: SubscriptionType,
  frequency: SubscriptionFrequency,
});

// Prompts validation (array with 1-3 strings)
const PromptsSchema = z.array(z.string())
  .min(1, 'At least one prompt is required')
  .max(3, 'Maximum 3 prompts allowed');

module.exports = {
  SubscriptionFrequency,
  SubscriptionType,
  BaseSubscriptionSchema,
  PromptsSchema
}; 
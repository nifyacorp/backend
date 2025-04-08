const { z } = require('zod');
const { BaseSubscriptionSchema, PromptsSchema } = require('./base.schema');

// Schema for subscription data in responses
const SubscriptionResponseSchema = BaseSubscriptionSchema.extend({
  id: z.string().uuid('Invalid subscription ID format'),
  prompts: PromptsSchema,
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  userId: z.string().uuid('Invalid user ID format'),
});

// List response
const SubscriptionListResponseSchema = z.object({
  status: z.literal('success'),
  data: z.object({
    subscriptions: z.array(SubscriptionResponseSchema),
    pagination: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    }).optional(),
  }),
});

// Get single subscription response
const SubscriptionGetResponseSchema = z.object({
  status: z.literal('success'),
  data: z.object({
    subscription: SubscriptionResponseSchema,
  }),
});

// Create/Update subscription response
const SubscriptionCreateUpdateResponseSchema = SubscriptionGetResponseSchema;

// Delete subscription response
const SubscriptionDeleteResponseSchema = z.object({
  status: z.literal('success'),
  message: z.string(),
  details: z.object({
    id: z.string().uuid(),
    alreadyRemoved: z.boolean().optional(),
  }),
});

module.exports = {
  SubscriptionResponseSchema,
  SubscriptionListResponseSchema,
  SubscriptionGetResponseSchema,
  SubscriptionCreateUpdateResponseSchema,
  SubscriptionDeleteResponseSchema
}; 
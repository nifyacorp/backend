const { z } = require('zod');
const { BaseSubscriptionSchema, PromptsSchema } = require('./base.schema');

// Schema for updating a subscription
const UpdateSubscriptionSchema = BaseSubscriptionSchema
  .partial() // All fields are optional for updates
  .extend({
    prompts: PromptsSchema.optional(),
    active: z.boolean().optional(),
    metadata: z.record(z.any()).optional(),
  });

// Request schema
const UpdateSubscriptionRequestSchema = UpdateSubscriptionSchema;

module.exports = {
  UpdateSubscriptionSchema,
  UpdateSubscriptionRequestSchema
}; 
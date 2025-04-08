const { z } = require('zod');
const { BaseSubscriptionSchema, PromptsSchema } = require('./base.schema');

// Schema for creating a subscription
const CreateSubscriptionSchema = BaseSubscriptionSchema.extend({
  prompts: PromptsSchema,
  metadata: z.record(z.any()).optional(),
});

// Request schema
const CreateSubscriptionRequestSchema = CreateSubscriptionSchema;

module.exports = {
  CreateSubscriptionSchema,
  CreateSubscriptionRequestSchema
}; 
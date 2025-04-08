import { z } from 'zod';
import { BaseSubscriptionSchema, PromptsSchema } from './base.schema.js';

// Schema for creating a subscription
export const CreateSubscriptionSchema = BaseSubscriptionSchema.extend({
  prompts: PromptsSchema,
  metadata: z.record(z.any()).optional(),
});

// Request schema
export const CreateSubscriptionRequestSchema = CreateSubscriptionSchema; 
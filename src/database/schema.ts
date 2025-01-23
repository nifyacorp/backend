import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  password_hash: z.string(),
  name: z.string().nullable(),
  settings: z.record(z.unknown()).default({}),
  created_at: z.date(),
  updated_at: z.date(),
});

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.enum(['boe', 'real-estate', 'custom']),
  name: z.string(),
  description: z.string().nullable(),
  prompts: z.array(z.string()),
  frequency: z.enum(['immediate', 'daily']),
  active: z.boolean().default(true),
  settings: z.record(z.unknown()).default({}),
  created_at: z.date(),
  updated_at: z.date(),
});

export const notificationSchema = z.object({
  id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  read: z.boolean().default(false),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.date(),
});
import type { QueryResultRow } from 'pg';

export interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionRow extends QueryResultRow {
  id: string;
  user_id: string;
  type: 'boe' | 'real-estate' | 'custom';
  name: string;
  description: string | null;
  prompts: string[];
  frequency: 'immediate' | 'daily';
  active: boolean;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationRow extends QueryResultRow {
  id: string;
  subscription_id: string;
  user_id: string;
  title: string;
  content: string;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
}
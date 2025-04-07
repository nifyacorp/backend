import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppError, ErrorCode } from '../../core/shared/errors/AppError';

let client: SupabaseClient | null = null;

/**
 * Initialize the Supabase client
 */
export function initializeClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new AppError(
      'Missing Supabase configuration',
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      500,
      { missingConfig: !supabaseUrl ? 'SUPABASE_URL' : 'SUPABASE_SERVICE_KEY' }
    );
  }
  
  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    }
  });
  
  return client;
}

/**
 * Get the Supabase client instance
 */
export function getClient(): SupabaseClient {
  if (!client) {
    return initializeClient();
  }
  return client;
}

/**
 * Set the Row Level Security context for a user
 */
export async function setRLSContext(userId: string): Promise<void> {
  const db = getClient();
  
  try {
    await db.rpc('set_claim', {
      uid: userId,
      claim: 'user_id',
      value: userId
    });
  } catch (error) {
    throw new AppError(
      'Failed to set RLS context',
      ErrorCode.DATABASE_ERROR,
      500,
      { originalError: error }
    );
  }
}

/**
 * Clear the Row Level Security context
 */
export async function clearRLSContext(): Promise<void> {
  const db = getClient();
  
  try {
    await db.rpc('clear_claims');
  } catch (error) {
    throw new AppError(
      'Failed to clear RLS context',
      ErrorCode.DATABASE_ERROR,
      500,
      { originalError: error }
    );
  }
}
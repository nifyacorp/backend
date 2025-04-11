/**
 * Messaging Index
 * 
 * This file re-exports all messaging utilities (PubSub, etc.) for easier imports
 * throughout the codebase.
 */

// Export PubSub utility
export { publishMessage } from './pubsub.js';

// For backward compatibility
export const pubsub = {
  publishMessage
};

// Note: Full implementations will be completed in Phase 2 
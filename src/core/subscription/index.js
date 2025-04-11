/**
 * Subscription Module Entry Point
 * 
 * This file exports the subscription module's public API.
 * The unified subscription service is the single source of truth for subscription functionality.
 */

import * as subscriptionService from './services/unified-subscription-service.js';
import { typeService } from './services/type.service.js';
import { templateService } from './services/template.service.js';

// Export the services
export { 
  subscriptionService,
  typeService,
  templateService 
};
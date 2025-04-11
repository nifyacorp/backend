/**
 * Notification Module Entry Point
 * 
 * This file exports the notification module's public API.
 * The unified notification service is the single source of truth for notification functionality.
 */

import * as notificationService from './services/unified-notification-service.js';
import userEmailPreferencesRepository from './data/user-email-preferences.repository.js';

// Export the unified service and supporting repositories
export default notificationService;
export { userEmailPreferencesRepository }; 
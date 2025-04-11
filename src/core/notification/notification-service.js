/**
 * Notification Service (Legacy Adapter)
 * 
 * This is an adapter file to maintain backward compatibility
 * with existing imports. It imports from the unified service
 * and re-exports the functions for backward compatibility.
 * 
 * New code should import directly from the unified notification service.
 */

import * as unifiedService from './services/unified-notification-service.js';

const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationStats,
  getActivityStats,
  createNotification,
  processNotification,
  getNotificationById,
  updateNotification
} = unifiedService;

// Export all methods from the unified service
export default {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationStats,
  getActivityStats,
  createNotification,
  processNotification,
  getNotificationById,
  updateNotification
}; 
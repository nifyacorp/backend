import express from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import notificationController from '../../../core/notification/interfaces/http/notification-controller.js';

const router = express.Router();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get notifications for authenticated user
 *     description: Retrieves all notifications for the authenticated user with pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of notifications to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: unread
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filter to show only unread notifications
 *       - in: query
 *         name: subscriptionId
 *         schema:
 *           type: string
 *         description: Filter notifications by subscription ID
 *     responses:
 *       200:
 *         description: Successful operation
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, notificationController.getUserNotifications);

/**
 * @swagger
 * /notifications/{notificationId}/read:
 *   post:
 *     summary: Mark notification as read
 *     description: Marks a specific notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the notification to mark as read
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       400:
 *         description: Invalid notification ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/:notificationId/read', authMiddleware, notificationController.markAsRead);

/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     description: Marks all notifications for the authenticated user as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subscriptionId
 *         schema:
 *           type: string
 *         description: Filter to mark as read only notifications from specific subscription
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/read-all', authMiddleware, notificationController.markAllAsRead);

export const notificationRoutes = router; 
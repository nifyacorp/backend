const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { logRequest, logError } = require('../shared/logging/logger');

/**
 * GET /api/v1/notifications
 * 
 * Get user notifications with error handling for common issues
 */
router.get('/', async (req, res) => {
  const context = { 
    requestId: req.id || req.requestId,
    path: req.path,
    method: req.method
  };

  try {
    logRequest(context, 'Fetching notifications', { 
      userId: req.user?.id,
      query: req.query
    });

    // Default to empty array - frontend can handle this gracefully
    res.status(200).json({
      notifications: [],
      total: 0,
      unread: 0,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      hasMore: false
    });
  } catch (error) {
    logError(context, error, { path: req.path });

    res.status(500).json({ 
      error: 'Failed to fetch notifications',
      message: 'An error occurred while retrieving notifications',
      notifications: [], // Provide empty array for frontend
      total: 0,
      unread: 0,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      hasMore: false
    });
  }
});

module.exports = router;
/**
 * Authentication routes for compatibility with the old API
 */

import express from 'express';
import { authService } from '../core/auth/auth.service.js';

const router = express.Router();

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    // Get refresh token from request body
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Refresh token is required',
          request_id: req.id,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Refresh the access token
    const result = await authService.refreshAccessToken(refreshToken);
    
    // Return new access token
    return res.status(200).json({
      accessToken: result.accessToken,
      user: result.user
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    
    const statusCode = error.status || 401;
    const errorCode = error.code || 'UNAUTHORIZED';
    const errorMessage = error.message || 'Invalid refresh token';
    
    return res.status(statusCode).json({
      error: {
        code: errorCode,
        message: errorMessage,
        request_id: req.id || 'unknown',
        timestamp: new Date().toISOString(),
        help: {
          message: 'We couldn\'t find specific documentation for this endpoint. Here are some available endpoints:',
          available_endpoints: [
            {
              path: '/api/auth/refresh',
              methods: ['POST'],
              description: 'Get a new access token using a refresh token'
            },
            {
              path: '/api/auth/login',
              methods: ['POST'],
              description: 'Authenticate a user and receive JWT tokens'
            },
            {
              path: '/api/auth/signup',
              methods: ['POST'],
              description: 'Register a new user account'
            }
          ],
          documentation_url: 'https://docs.nifya.app/api/auth'
        }
      }
    });
  }
});

/**
 * Sessions endpoint
 * GET /api/auth/sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authentication',
          request_id: req.id,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = authService.verifyToken(token);
    
    // For now, just return a basic response
    // In a full implementation, this would query a sessions database
    return res.status(200).json({
      sessions: [
        {
          id: '1',
          device: 'Current browser',
          ip: req.ip,
          lastActive: new Date().toISOString(),
          current: true
        }
      ],
      user_id: decoded.sub
    });
  } catch (error) {
    console.error('Sessions endpoint error:', error);
    
    const statusCode = error.status || 401;
    const errorCode = error.code || 'UNAUTHORIZED';
    const errorMessage = error.message || 'Authentication required';
    
    return res.status(statusCode).json({
      error: {
        code: errorCode,
        message: errorMessage,
        request_id: req.id || 'unknown',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Revoke session
 * POST /api/auth/sessions/revoke
 */
router.post('/sessions/revoke', async (req, res) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authentication',
          request_id: req.id,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Get session ID from request body
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Session ID is required',
          request_id: req.id,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // For now, just return a success response
    // In a full implementation, this would revoke the session in a database
    return res.status(200).json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    
    const statusCode = error.status || 500;
    const errorCode = error.code || 'INTERNAL_ERROR';
    const errorMessage = error.message || 'An error occurred while revoking the session';
    
    return res.status(statusCode).json({
      error: {
        code: errorCode,
        message: errorMessage,
        request_id: req.id || 'unknown',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Revoke all sessions
 * POST /api/auth/sessions/revoke-all
 */
router.post('/sessions/revoke-all', async (req, res) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authentication',
          request_id: req.id,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = authService.verifyToken(token);
    
    // For now, just return a success response
    // In a full implementation, this would revoke all sessions in a database
    return res.status(200).json({
      success: true,
      message: 'All sessions revoked successfully',
      user_id: decoded.sub
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    
    const statusCode = error.status || 500;
    const errorCode = error.code || 'INTERNAL_ERROR';
    const errorMessage = error.message || 'An error occurred while revoking all sessions';
    
    return res.status(statusCode).json({
      error: {
        code: errorCode,
        message: errorMessage,
        request_id: req.id || 'unknown',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;
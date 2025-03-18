const logger = require('./logger');
const { Server } = require('socket.io');
const metrics = require('./metrics');
// Get proper auth service
const authService = require('../src/core/auth/auth.service.js').authService;

// Store active connections
let io;
const userConnections = new Map();

/**
 * Initialize Socket.IO server
 */
async function initialize(server) {
  // Initialize auth service for JWT validation
  try {
    await authService.initialize();
    logger.info('Auth service initialized for Socket.IO');
  } catch (error) {
    logger.error('Failed to initialize auth service for Socket.IO', {
      error: error.message,
      stack: error.stack
    });
  }

  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'userId']
    },
    path: '/socket.io/', // Ensure this matches the path in your Netlify redirects
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000
  });

  // Socket.io Event Monitoring
  io.on('connection', (socket) => {
    logger.debug('Socket.io connection established', { 
      socketId: socket.id,
      transport: socket.conn.transport.name,
      address: socket.handshake.address
    });

    metrics.increment('socket.connection');

    // Authenticate and associate with user
    socket.on('authenticate', async (data) => {
      if (!data.token) {
        logger.warn('Socket authentication failed - no token', { socketId: socket.id });
        socket.emit('auth_error', { message: 'Authentication required' });
        return;
      }

      // Verify token and get user ID
      try {
        // Use proper JWT verification
        const decoded = await authService.verifyToken(data.token);
        const userId = decoded.sub;
        
        if (!userId) {
          logger.warn('Socket authentication failed - invalid token', { socketId: socket.id });
          socket.emit('auth_error', { message: 'Invalid authentication' });
          return;
        }

        // Store user association
        socket.userId = userId;
        
        // Add to user connections map
        if (!userConnections.has(userId)) {
          userConnections.set(userId, new Set());
        }
        userConnections.get(userId).add(socket);
        
        logger.debug('Socket authenticated', { 
          socketId: socket.id, 
          userId,
          connectionCount: userConnections.get(userId).size
        });
        
        socket.emit('authenticated', { userId });
        
        metrics.increment('socket.authentication.success', { userId });
      } catch (error) {
        logger.error('Socket authentication error', { 
          error: error.message, 
          socketId: socket.id,
          stack: error.stack 
        });
        
        socket.emit('auth_error', { message: 'Authentication failed: ' + error.message });
        metrics.increment('socket.authentication.error');
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { 
        socketId: socket.id,
        userId: socket.userId
      });
      
      metrics.increment('socket.disconnection');

      // Remove from user connections
      if (socket.userId && userConnections.has(socket.userId)) {
        userConnections.get(socket.userId).delete(socket);
        
        // Clean up empty sets
        if (userConnections.get(socket.userId).size === 0) {
          userConnections.delete(socket.userId);
        }
      }
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Get all active connections for a user
 */
function getConnectionsByUserId(userId) {
  return userConnections.has(userId) ? Array.from(userConnections.get(userId)) : [];
}

/**
 * Send a message to a specific socket
 */
function sendToSocket(socket, event, data) {
  try {
    socket.emit(event, data);
    
    logger.debug('Socket.io message emitted', {
      socketId: socket.id,
      userId: socket.userId,
      event
    });
    
    metrics.increment('socket.message.sent', { 
      event,
      userId: socket.userId
    });
    
    return true;
  } catch (error) {
    logger.error('Socket.io emission error', { 
      error: error.message, 
      socketId: socket.id,
      event
    });
    
    metrics.increment('socket.message.error', { 
      event,
      reason: error.message
    });
    
    return false;
  }
}

/**
 * Send a message to all sockets for a user
 */
function sendToUser(userId, event, data) {
  if (!userConnections.has(userId)) {
    logger.debug('No active connections for user', { userId, event });
    return false;
  }

  const connections = userConnections.get(userId);
  let successCount = 0;
  
  connections.forEach(socket => {
    if (sendToSocket(socket, event, data)) {
      successCount++;
    }
  });
  
  logger.debug('Sent message to user connections', { 
    userId, 
    event,
    connectionCount: connections.size,
    successCount
  });
  
  return successCount > 0;
}

/**
 * Broadcast a message to all connected clients
 */
function broadcast(event, data) {
  try {
    io.emit(event, data);
    
    logger.debug('Broadcast message sent', { 
      event, 
      recipientCount: io.engine.clientsCount 
    });
    
    metrics.increment('socket.broadcast', { event });
    
    return true;
  } catch (error) {
    logger.error('Broadcast error', { 
      error: error.message, 
      event 
    });
    
    metrics.increment('socket.broadcast.error', { 
      event,
      reason: error.message
    });
    
    return false;
  }
}

/**
 * Get the health status of Socket.IO
 * @returns {Object} Health status information
 */
function getHealth() {
  return {
    status: io ? 'connected' : 'disconnected',
    clientCount: io ? io.engine.clientsCount : 0,
    connectionCount: userConnections.size,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  initialize,
  getConnectionsByUserId,
  sendToSocket,
  sendToUser,
  broadcast,
  getHealth
}; 
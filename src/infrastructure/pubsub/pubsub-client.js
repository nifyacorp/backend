/**
 * Google Cloud Pub/Sub Client
 * 
 * Provides unified interface for publishing and subscribing to Pub/Sub topics.
 */

import { PubSub } from '@google-cloud/pubsub';
import { logger, logPubSub } from '../../shared/logging/logger.js';

class PubSubClient {
  constructor() {
    this.initialized = false;
    this.client = null;
    this.subscriptions = new Map();
    this.publishClientsByTopic = new Map();
    
    // Support both production and development environments
    this.enabled = process.env.PUBSUB_ENABLED === 'true';
    this.developmentMode = process.env.NODE_ENV !== 'production';
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID;
    
    // Log initialization status
    logger.info('PubSub client configuration loaded', {
      enabled: this.enabled,
      developmentMode: this.developmentMode,
      hasProjectId: !!this.projectId
    });
  }
  
  /**
   * Initialize the Pub/Sub client
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    // Skip initialization if disabled
    if (!this.enabled) {
      logger.info('PubSub client disabled, skipping initialization');
      return false;
    }
    
    try {
      // Create PubSub client
      this.client = new PubSub({
        projectId: this.projectId
      });
      
      this.initialized = true;
      logger.info('PubSub client initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize PubSub client', { 
        error: error.message,
        stack: error.stack
      });
      
      this.initialized = false;
      return false;
    }
  }
  
  /**
   * Publish a message to a topic
   * @param {string} topicName - Name of the topic
   * @param {object} data - Message data
   * @param {object} attributes - Message attributes
   * @returns {Promise<string>} Message ID
   */
  async publishMessage(topicName, data, attributes = {}) {
    // Verify initialization
    if (!this.initialized && !await this.initialize()) {
      // In development, allow mocked publishing
      if (this.developmentMode) {
        const mockMessageId = `dev-mock-${Date.now()}`;
        logPubSub({}, `[MOCK] Published message to ${topicName}`, {
          topicName,
          dataPreview: JSON.stringify(data).substring(0, 100),
          mockMessageId,
          attributes
        });
        return mockMessageId;
      }
      
      throw new Error('PubSub client not initialized');
    }
    
    try {
      // Get topic client or create a new one
      let topicClient = this.publishClientsByTopic.get(topicName);
      if (!topicClient) {
        topicClient = this.client.topic(topicName);
        this.publishClientsByTopic.set(topicName, topicClient);
      }
      
      // Convert data to buffer
      const dataBuffer = Buffer.from(JSON.stringify(data));
      
      // Publish message
      const messageId = await topicClient.publish(dataBuffer, attributes);
      
      logPubSub({}, `Published message to ${topicName}`, {
        topicName,
        messageId,
        dataSize: dataBuffer.length,
        attributeKeys: Object.keys(attributes)
      });
      
      return messageId;
    } catch (error) {
      logger.error(`Failed to publish message to ${topicName}`, {
        error: error.message,
        topicName,
        dataPreview: JSON.stringify(data).substring(0, 100),
        attributes
      });
      throw error;
    }
  }
  
  /**
   * Subscribe to a topic
   * @param {string} topicName - Name of the topic
   * @param {string} subscriptionName - Name of the subscription
   * @param {Function} messageHandler - Message handler function
   * @returns {Promise<void>}
   */
  async subscribe(topicName, subscriptionName, messageHandler) {
    // Verify initialization
    if (!this.initialized && !await this.initialize()) {
      if (this.developmentMode) {
        logger.info(`[MOCK] Subscription to ${topicName} with subscription ${subscriptionName} would be created`);
        return;
      }
      throw new Error('PubSub client not initialized');
    }
    
    try {
      // Check if we already have this subscription
      const subscriptionKey = `${topicName}:${subscriptionName}`;
      if (this.subscriptions.has(subscriptionKey)) {
        logger.warn(`Subscription ${subscriptionKey} already exists, skipping`);
        return;
      }
      
      // Get or create subscription
      const subscription = this.client
        .topic(topicName)
        .subscription(subscriptionName);
      
      // Handle incoming messages
      const messageCallback = async (message) => {
        try {
          // Parse message data
          const data = JSON.parse(message.data.toString());
          
          logPubSub({}, `Received message from ${topicName}`, {
            topicName,
            subscriptionName,
            messageId: message.id,
            publishTime: message.publishTime,
            attributes: message.attributes
          });
          
          // Process message with handler
          await messageHandler(data, message.attributes, message);
          
          // Acknowledge message
          message.ack();
        } catch (error) {
          logger.error(`Error processing message from ${topicName}`, {
            error: error.message,
            stack: error.stack,
            topicName,
            subscriptionName,
            messageId: message.id
          });
          
          // Nack message to retry
          message.nack();
        }
      };
      
      // Setup message listener
      subscription.on('message', messageCallback);
      
      // Store subscription reference
      this.subscriptions.set(subscriptionKey, subscription);
      
      logger.info(`Subscribed to ${topicName} with subscription ${subscriptionName}`);
    } catch (error) {
      logger.error(`Failed to subscribe to ${topicName}`, {
        error: error.message,
        stack: error.stack,
        topicName,
        subscriptionName
      });
      throw error;
    }
  }
  
  /**
   * Close all subscriptions and clean up resources
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.initialized) return;
    
    try {
      // Close all subscriptions
      for (const [key, subscription] of this.subscriptions.entries()) {
        try {
          subscription.removeAllListeners();
          logger.info(`Closed subscription ${key}`);
        } catch (error) {
          logger.warn(`Error closing subscription ${key}`, {
            error: error.message
          });
        }
      }
      
      this.subscriptions.clear();
      this.publishClientsByTopic.clear();
      
      this.initialized = false;
      logger.info('PubSub client closed successfully');
    } catch (error) {
      logger.error('Error closing PubSub client', {
        error: error.message,
        stack: error.stack
      });
    }
  }
}

// Create and export singleton instance
const pubsubClient = new PubSubClient();
export default pubsubClient; 
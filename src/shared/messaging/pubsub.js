/**
 * Google Cloud Pub/Sub Client
 * 
 * This file provides utilities for working with Google Cloud Pub/Sub.
 */

import { PubSub } from '@google-cloud/pubsub';
import { logger } from '../logging/logger.js';

// Initialize PubSub client
let pubsub;

try {
  pubsub = new PubSub({
    projectId: process.env.GOOGLE_CLOUD_PROJECT
  });
  logger.logRequest({}, 'PubSub client initialized', {
    projectId: process.env.GOOGLE_CLOUD_PROJECT
  });
} catch (err) {
  logger.logError({}, err, {
    context: 'PubSub client initialization'
  });
}

// Map of topics to their fully-qualified names
const topics = {
  notifications: `projects/${process.env.GOOGLE_CLOUD_PROJECT || 'project-id'}/topics/notifications`,
  'email-notifications-immediate': `projects/${process.env.GOOGLE_CLOUD_PROJECT || 'project-id'}/topics/email-notifications-immediate`,
  'email-notifications-daily': `projects/${process.env.GOOGLE_CLOUD_PROJECT || 'project-id'}/topics/email-notifications-daily`
};

/**
 * Publish a message to a PubSub topic
 * @param {string} topicName - Name of the topic (from the topics object)
 * @param {Object} data - Message data to publish
 * @returns {Promise<string>} Message ID
 */
export async function publishMessage(topicName, data) {
  const context = { requestId: `pubsub-${Date.now()}`, path: '/pubsub' };
  
  if (!pubsub) {
    logger.logPubSub(context, 'PubSub client not initialized, skipping publish', {
      topicName,
      data: JSON.stringify(data).substring(0, 200)
    });
    return null;
  }

  const topicPath = topics[topicName];
  if (!topicPath) {
    const error = new Error(`Invalid topic name: ${topicName}`);
    logger.logError(context, error, { topicName });
    throw error;
  }

  try {
    // Convert data to Buffer
    const dataBuffer = Buffer.from(JSON.stringify(data));

    // Publish message
    const messageId = await pubsub.topic(topicPath).publish(dataBuffer);

    logger.logPubSub(context, 'Message published to PubSub', {
      topicName,
      messageId,
      dataSize: dataBuffer.length
    });

    return messageId;
  } catch (err) {
    logger.logError(context, err, {
      context: 'PubSub message publishing',
      topicName,
      dataPreview: JSON.stringify(data).substring(0, 200)
    });
    throw err;
  }
} 
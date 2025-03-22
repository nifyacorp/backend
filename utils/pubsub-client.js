/**
 * PubSub Client for sending messages to Google Cloud Pub/Sub
 */

const { PubSub } = require('@google-cloud/pubsub');
const logger = require('./logger');

// Initialize PubSub client
let pubsub;

try {
  pubsub = new PubSub({
    projectId: process.env.GOOGLE_CLOUD_PROJECT
  });
  logger.info('PubSub client initialized', {
    projectId: process.env.GOOGLE_CLOUD_PROJECT
  });
} catch (err) {
  logger.error('Failed to initialize PubSub client', {
    error: err.message,
    stack: err.stack
  });
}

// Map of topics to their fully-qualified names
const topics = {
  notifications: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/notifications`,
  'email-notifications-immediate': `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/email-notifications-immediate`,
  'email-notifications-daily': `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/email-notifications-daily`
};

/**
 * Publish a message to a PubSub topic
 * @param {string} topicName - Name of the topic (from the topics object)
 * @param {Object} data - Message data to publish
 * @returns {Promise<string>} Message ID
 */
async function publishMessage(topicName, data) {
  if (!pubsub) {
    logger.warn('PubSub client not initialized, skipping publish', {
      topicName,
      data: JSON.stringify(data).substring(0, 200)
    });
    return null;
  }

  const topicPath = topics[topicName];
  if (!topicPath) {
    logger.error('Invalid topic name', { topicName });
    throw new Error(`Invalid topic name: ${topicName}`);
  }

  try {
    // Convert data to Buffer
    const dataBuffer = Buffer.from(JSON.stringify(data));

    // Publish message
    const messageId = await pubsub.topic(topicPath).publish(dataBuffer);

    logger.info('Message published to PubSub', {
      topicName,
      messageId,
      dataSize: dataBuffer.length
    });

    return messageId;
  } catch (err) {
    logger.error('Failed to publish message to PubSub', {
      error: err.message,
      stack: err.stack,
      topicName,
      data: JSON.stringify(data).substring(0, 200)
    });
    throw err;
  }
}

module.exports = {
  publishMessage
};
import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub();

/**
 * Publishes an event to the specified topic
 * @param {string} topicName - The name of the topic to publish to
 * @param {object} data - The event data to publish
 * @returns {Promise<string>} The message ID
 */
export async function publishEvent(topicName, data) {
  try {
    const dataBuffer = Buffer.from(JSON.stringify(data));
    const messageId = await pubsub.topic(topicName).publish(dataBuffer);
    
    console.log('Event published successfully:', {
      topic: topicName,
      messageId,
      eventType: data.type,
      timestamp: new Date().toISOString()
    });

    return messageId;
  } catch (error) {
    console.error('Failed to publish event:', {
      topic: topicName,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}
import { PubSub } from '@google-cloud/pubsub';
import { handleNewUser } from '../services/users.js';

const pubsub = new PubSub();
const subscriptionName = 'user-profile-creation';
const topicName = 'user-events';

let subscription;

export const initializePubSub = async () => {
  try {
    console.log('🔌 Initializing Pub/Sub connection...', {
      subscriptionName,
      topicName,
      timestamp: new Date().toISOString()
    });
    
    // Get or create subscription
    subscription = pubsub.subscription(subscriptionName);
    const [exists] = await subscription.exists();
    
    if (!exists) {
      console.log('📝 Creating new subscription...', {
        subscriptionName,
        topicName,
        timestamp: new Date().toISOString()
      });
      const topic = pubsub.topic(topicName);
      [subscription] = await topic.createSubscription(subscriptionName);
      console.log('✅ Created subscription:', {
        name: subscriptionName,
        timestamp: new Date().toISOString()
      });
    }

    // Message handler
    subscription.on('message', async (message) => {
      try {
        console.log('📨 Received message:', {
          id: message.id,
          eventType: message.attributes.eventType,
          timestamp: new Date().toISOString()
        });

        if (message.attributes.eventType === 'user.created') {
          const userData = JSON.parse(message.data.toString());
          await handleNewUser(userData);
          console.log('✅ Processed user creation:', {
            messageId: message.id,
            userId: userData.id,
            timestamp: new Date().toISOString()
          });
          message.ack();
        } else {
          console.log('⚠️ Unknown event type:', {
            messageId: message.id,
            eventType: message.attributes.eventType,
            timestamp: new Date().toISOString()
          });
          message.ack();
        }
      } catch (error) {
        console.error('❌ Message processing error:', {
          error: error.message,
          stack: error.stack,
          messageId: message.id,
          timestamp: new Date().toISOString()
        });
        message.nack();
      }
    });

    subscription.on('error', (error) => {
      console.error('❌ Subscription error:', {
        error: error.message,
        stack: error.stack,
        subscriptionName,
        timestamp: new Date().toISOString()
      });
    });

    console.log('✅ Pub/Sub initialization complete', {
      subscriptionName,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to initialize Pub/Sub:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};
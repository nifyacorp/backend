import { PubSub } from '@google-cloud/pubsub';
import { handleNewUser } from '../services/users.js';

const pubsub = new PubSub();
const subscriptionName = 'user-profile-creation';
const topicName = 'user-events';

let subscription;

export const initializePubSub = async () => {
  try {
    console.log('🔌 Initializing Pub/Sub subscription...');
    
    // Get or create subscription
    subscription = pubsub.subscription(subscriptionName);
    const [exists] = await subscription.exists();
    
    if (!exists) {
      console.log('Creating new subscription...');
      const topic = pubsub.topic(topicName);
      [subscription] = await topic.createSubscription(subscriptionName);
      console.log(`✅ Created subscription: ${subscriptionName}`);
    }

    // Message handler
    subscription.on('message', async (message) => {
      try {
        console.log('📨 Received message:', {
          id: message.id,
          attributes: message.attributes,
          timestamp: new Date().toISOString()
        });

        if (message.attributes.eventType === 'user.created') {
          const userData = JSON.parse(message.data.toString());
          await handleNewUser(userData);
          console.log('✅ Successfully processed user creation message');
          message.ack();
        } else {
          console.log('⚠️ Ignoring message with unknown event type:', message.attributes.eventType);
          message.ack();
        }
      } catch (error) {
        console.error('❌ Error processing message:', {
          error: error.message,
          messageId: message.id,
          timestamp: new Date().toISOString()
        });
        message.nack();
      }
    });

    subscription.on('error', (error) => {
      console.error('❌ Subscription error:', error);
    });

    console.log('✅ Pub/Sub subscription initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Pub/Sub:', error);
    throw error;
  }
};
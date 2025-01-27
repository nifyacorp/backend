# Nifya Subscription Processors

A collection of Cloud Run job services that process subscriptions and create notifications based on user prompts.

## 🚀 Core Features

- Content source processing:
  - DOGA (Diario Oficial de Galicia)
  - BOE (Boletín Oficial del Estado)
- Daily content analysis
- User prompt matching
- Notification generation
- Real-time alerts via Pub/Sub

## 🛠 Tech Stack

- **Runtime**: Node.js 20
- **Database**: PostgreSQL
- **Cloud Services**:
  - Cloud Run Jobs
  - Cloud Scheduler (daily triggers)
  - Cloud Pub/Sub (notifications)
  - Cloud SQL

## 🔧 Configuration

```bash
# Database
DB_NAME=nifya
DB_USER=nifya
DB_PASSWORD=your-password-here

# Service URLs
DOGA_PARSER_URL=https://doga-parser-415554190254.us-central1.run.app
BOE_PARSER_URL=https://boe-parser.example.com

# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
INSTANCE_CONNECTION_NAME=your-instance-connection
PUBSUB_TOPIC=notifications
```

## 🏗 Project Structure

```
.
├── src/
│   ├── database/
│   │   └── client.js       # Database connection
│   ├── services/
│   │   ├── doga.js         # DOGA parser client
│   │   ├── boe.js          # BOE parser client
│   │   └── pubsub.js       # Pub/Sub client
│   ├── processors/
│   │   ├── doga.js         # DOGA processor
│   │   └── boe.js          # BOE processor
│   └── index.js            # Job entry point
└── package.json
```

## 🔄 Processing Flow

1. **Get Active Subscriptions**
   ```javascript
   // Group subscriptions by type to process content once
   const subscriptionsByType = await db.getActiveSubscriptionsGroupedByType();
   ```

2. **Process Each Subscription**
   ```javascript
   // Process each content type once
   for (const [type, subscriptions] of Object.entries(subscriptionsByType)) {
     // Get content once per type
     const content = await parsers[type].getLatestContent();
   
     // Group prompts by subscription type for efficiency
     const promptsByUser = subscriptions.reduce((acc, sub) => {
       if (!acc[sub.userId]) {
         acc[sub.userId] = {
           prompts: new Set(),
           subscriptionIds: new Set()
         };
       }
       sub.prompts.forEach(prompt => acc[sub.userId].prompts.add(prompt));
       acc[sub.userId].subscriptionIds.add(sub.id);
       return acc;
     }, {});
   
     // Process each user's prompts
     for (const [userId, data] of Object.entries(promptsByUser)) {
       const uniquePrompts = Array.from(data.prompts);
       for (const prompt of uniquePrompts) {
         const matches = await parsers[type].analyze(content, prompt);
         if (matches.length > 0) {
           await createNotifications(userId, Array.from(data.subscriptionIds), matches);
         }
       }
     }
   }
   ```

3. **Create Notifications**
   ```javascript
   async function createNotifications(userId, subscriptionIds, matches) {
     // Save to database
     const notifications = await Promise.all(subscriptionIds.map(subId => 
       db.createNotification({
         userId,
         subscriptionId: subId,
         content: matches,
         type: 'doga'
       })
     ));
     
     // Send real-time alert
     await pubsub.publish('notifications', notifications);
   }
   ```

## 🚀 Deployment

```bash
# Build
gcloud builds submit --tag gcr.io/PROJECT_ID/doga-processor

# Deploy job
gcloud run jobs create doga-processor \
  --image gcr.io/PROJECT_ID/doga-processor \
  --region us-central1 \
  --schedule="0 0 * * *"
```

## 📊 Monitoring

Key metrics to watch:
- Active subscriptions count
- Successful matches
- Processing duration
- Error rate

## 🐛 Common Issues

1. Parser API Down
   - Check service status
   - Implement retry with backoff

2. Database Connection
   - Verify connection string
   - Check pool settings

## 📝 Example Implementation

```javascript
class ContentProcessor {
  constructor(parser, type) {
    this.parser = parser;
    this.type = type;
  }

  async process() {
    // Get all subscriptions for this type
    const subs = await this.getSubscriptionsGroupedByUser();
    const content = await this.parser.getLatest();
    
    // Process each user's subscriptions
    for (const [userId, userSubs] of Object.entries(subs)) {
      await this.processUserSubscriptions(userId, userSubs, content);
    }
  }

  async processUserSubscriptions(userId, subscriptions, content) {
    // Get unique prompts for this user
    const uniquePrompts = new Set(
      subscriptions.flatMap(sub => sub.prompts)
    );
    
    // Process each unique prompt once
    for (const prompt of uniquePrompts) {
      const matches = await this.parser.analyze(content, prompt);
      if (matches.length > 0) {
        // Create notifications for all matching subscriptions
        const matchingSubIds = subscriptions
          .filter(sub => sub.prompts.includes(prompt))
          .map(sub => sub.id);
          
        await this.notify(userId, matchingSubIds, matches);
      }
    }
  }
}
```

## 📄 License

Private and confidential. All rights reserved.
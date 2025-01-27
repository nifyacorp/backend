# DOGA Subscription Processor

A Cloud Run job service that processes DOGA subscriptions and creates notifications based on user prompts.

## 🚀 Features

- Daily DOGA content analysis
- User prompt matching
- Notification generation
- Real-time alerts via Pub/Sub
- Error handling and retry logic
- Structured logging
- Scalable processing

## 🛠 Tech Stack

- **Runtime**: Node.js 20
- **Framework**: None (standalone job)
- **Database**: PostgreSQL (shared with main service)
- **Cloud Services**:
  - Cloud Run Jobs (execution environment)
  - Cloud Scheduler (job triggering)
  - Cloud Pub/Sub (real-time notifications)
  - Cloud SQL (PostgreSQL hosting)

## 📋 Prerequisites

- Google Cloud project with:
  - Cloud Run Jobs enabled
  - Cloud Scheduler enabled
  - Cloud Pub/Sub enabled
  - Cloud SQL configured
- Environment variables configured

## 🔧 Configuration

Required environment variables:
```bash
# Database Configuration
DB_NAME=nifya
DB_USER=nifya
DB_PASSWORD=your-password-here

# DOGA Parser Configuration
DOGA_PARSER_URL=https://doga-parser-415554190254.us-central1.run.app

# Google Cloud Configuration
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
│   │   └── pubsub.js       # Pub/Sub client
│   ├── utils/
│   │   ├── logger.js       # Logging utilities
│   │   └── errors.js       # Error handling
│   └── index.js            # Job entry point
├── Dockerfile
└── package.json
```

## 🔄 Job Flow

1. **Subscription Retrieval**
   - Fetch active DOGA subscriptions
   - Group by frequency (immediate/daily)

2. **DOGA Analysis**
   - Call DOGA parser API for each prompt
   - Process responses and identify matches

3. **Notification Creation**
   - Create database records for matches
   - Publish to Pub/Sub for real-time updates

4. **Status Updates**
   - Update subscription last check timestamps
   - Log processing statistics

## 🚦 Error Handling

- Retry logic for API calls
- Partial success handling
- Structured error logging
- Alert notifications for critical failures

## 📊 Monitoring

Job execution metrics:
- Subscriptions processed
- Successful matches
- API call statistics
- Error rates
- Processing duration

## 🔒 Security

- Service account authentication
- Secure secret management
- Network security policies
- Database connection encryption

## 🏃‍♂️ Local Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Run tests
npm test
```

## 🚀 Deployment

```bash
# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/doga-processor

# Deploy job
gcloud run jobs create doga-processor \
  --image gcr.io/PROJECT_ID/doga-processor \
  --region us-central1 \
  --service-account doga-processor@PROJECT_ID.iam.gserviceaccount.com

# Set up scheduler
gcloud scheduler jobs create http process-doga \
  --schedule="0 0 * * *" \
  --uri="https://REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/doga-processor:run" \
  --http-method=POST \
  --oauth-service-account-email=scheduler@PROJECT_ID.iam.gserviceaccount.com
```

## 📝 Example Job Execution

```javascript
// Process subscriptions
async function processDogaSubscriptions() {
  const subscriptions = await getActiveSubscriptions();
  
  for (const sub of subscriptions) {
    for (const prompt of sub.prompts) {
      const matches = await analyzeDoga(prompt);
      
      if (matches.length > 0) {
        await createNotifications(sub.userId, matches);
        await publishAlerts(sub.userId, matches);
      }
    }
    
    await updateLastCheck(sub.id);
  }
}
```

## 🔍 Monitoring & Logging

Example log output:
```json
{
  "severity": "INFO",
  "message": "Processing DOGA subscription",
  "subscription": {
    "id": "123",
    "userId": "456",
    "promptCount": 2
  },
  "timestamp": "2024-01-27T00:00:00.000Z"
}
```

## 🐛 Troubleshooting

Common issues and solutions:
1. API Connection Failures
   - Check network connectivity
   - Verify service URLs
   - Review retry configuration

2. Database Timeouts
   - Check connection pool settings
   - Monitor query performance
   - Review transaction isolation

3. Processing Errors
   - Check log details
   - Verify prompt format
   - Review API responses

## 📄 License

This project is private and confidential. All rights reserved.
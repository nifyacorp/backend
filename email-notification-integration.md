# Email Notification Integration

This document provides instructions for completing the integration of email notifications in the NIFYA application.

## Overview

We've now implemented the core components for enabling email notifications in the application:

1. **Database Schema Updates**
   - Added `email_notifications`, `notification_email`, and `digest_time` columns to the users table
   - Added `email_sent` and `email_sent_at` columns to the notifications table

2. **Backend API Endpoints**
   - Added endpoints to manage email notification preferences
   - Added endpoint to send test emails
   - Enhanced notification service to publish to email notification topics

3. **Frontend Components**
   - Created EmailNotificationSettings component for user preferences
   - Created useEmailPreferences hook for API integration
   - Added UI for managing email preferences

## Remaining Integration Steps

1. **Deploy Email Notification Service**
   ```bash
   # Navigate to the email-notification directory
   cd email-notification
   
   # Build and deploy to Cloud Run
   gcloud builds submit --tag gcr.io/[PROJECT_ID]/email-notification-service
   gcloud run deploy email-notification-service \
     --image gcr.io/[PROJECT_ID]/email-notification-service \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

2. **Create PubSub Topics and Subscriptions**
   ```bash
   # Create topics
   gcloud pubsub topics create email-notifications-immediate
   gcloud pubsub topics create email-notifications-daily
   
   # Create subscriptions (replace SERVICE_URL with your Cloud Run service URL)
   gcloud pubsub subscriptions create email-notifications-immediate-sub \
     --topic=email-notifications-immediate \
     --push-endpoint=SERVICE_URL \
     --ack-deadline=60
   
   gcloud pubsub subscriptions create email-notifications-daily-sub \
     --topic=email-notifications-daily \
     --push-endpoint=SERVICE_URL/process-daily \
     --ack-deadline=120
   ```

3. **Create Scheduler for Daily Digest**
   ```bash
   # Create scheduler job (adjust time as needed)
   gcloud scheduler jobs create http email-daily-digest \
     --schedule="0 8 * * *" \
     --uri="SERVICE_URL/process-daily" \
     --http-method=POST \
     --time-zone="Europe/Madrid"
   ```

4. **Update Environment Variables**
   Make sure the following environment variables are set in both the backend and email-notification services:

   ```
   # Email Service Configuration
   EMAIL_SERVICE_URL=https://email-notification-service-url
   PUBSUB_EMAIL_TOPIC=email-notifications-daily
   
   # PubSub Configuration
   GOOGLE_CLOUD_PROJECT=your-project-id
   
   # Gmail Configuration
   GMAIL_USER=your-gmail-address
   ```

5. **Secret Management**
   Configure the following secrets in Secret Manager:
   
   ```
   GMAIL_CLIENT_ID
   GMAIL_CLIENT_SECRET
   GMAIL_REFRESH_TOKEN
   ```

## Integration in Settings Page

Add the EmailNotificationSettings component to your Settings page:

```tsx
import { EmailNotificationSettings } from '@/components/settings/EmailNotificationSettings';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="grid gap-8">
        {/* Existing settings components */}
        <ProfileSettings />
        <NotificationSettings />
        
        {/* Email notification settings */}
        <EmailNotificationSettings />
      </div>
    </div>
  );
}
```

## Testing the Integration

1. **Test User Preferences**
   - Open the settings page and enable email notifications
   - Set your notification email and preferred digest time
   - Save and verify the preferences are persisted

2. **Test Email Delivery**
   - Click "Send Test Email" to verify email delivery
   - Create a new notification to test the integration
   - Check that the email is delivered correctly

3. **Test Daily Digest**
   - Manually trigger the daily digest process
   - Verify that a digest email is sent with accumulated notifications

## Monitoring and Troubleshooting

1. **Check Email Service Logs**
   - Monitor Cloud Run logs for the email-notification-service
   - Look for delivery failures or errors

2. **Check PubSub Message Flow**
   - Verify that messages are being published to topics
   - Monitor subscription ack/nack rates

3. **Monitor Email Delivery**
   - Track email delivery success rates
   - Check for bounce backs or spam reports

## Future Enhancements

1. **Notification Type Preferences**: Allow users to choose which notification types they receive via email
2. **Rich Email Templates**: Enhance email templates with more formatting and branding
3. **Subscription-Specific Preferences**: Let users specify different notification preferences per subscription
4. **Weekly Digest Option**: Add weekly digest in addition to daily digest option
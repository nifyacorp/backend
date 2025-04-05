# Subscription Debug Guide

This guide documents the diagnostic endpoints added to help debug subscription-related issues, particularly problems with subscription deletion.

## Problem Background

Some subscriptions appear to be deleted in the frontend but then reappear after page refresh. This happens because:

1. The frontend maintains a "deletion blacklist" in localStorage to track deleted subscriptions
2. The backend may return HTTP 200 even when deletion fails for consistency with the UI
3. Related records in other tables may prevent proper deletion
4. Race conditions between the deletion process and other operations

## Diagnostic Endpoints

These endpoints have been added to the `/api/diagnostics/` path to help diagnose and fix these issues:

### 1. Check if a Subscription Exists

**Endpoint:** `GET /api/diagnostics/subscription-test/subscription-exists/:id`

**Purpose:** Directly query the database to check if a subscription exists, bypassing any caching or middleware.

**Example:**
```
GET /api/diagnostics/subscription-test/subscription-exists/9811564b-99af-4749-8d68-1f050efb8753
```

**Response:**
- `404` if subscription does not exist
- `200` with subscription details and related record counts if it exists

### 2. Force Delete a Subscription

**Endpoint:** `POST /api/diagnostics/subscription-test/test-subscription-deletion`

**Purpose:** Forcefully delete a subscription and all its related records from the database using direct SQL.

**Example:**
```json
POST /api/diagnostics/subscription-test/test-subscription-deletion
{
  "subscriptionId": "9811564b-99af-4749-8d68-1f050efb8753",
  "userId": "USER_ID_HERE",
  "force": true
}
```

**Response:**
- Shows which related records were deleted and whether the operation succeeded
- Uses a transaction to ensure all records are deleted or none
- Returns detailed information about what was deleted from each table

### 3. Clean Deletion Blacklist

**Endpoint:** `POST /api/diagnostics/subscription-test/clean-deletion-blacklist`

**Purpose:** Clear any entries in the deletion blacklist table to prevent subscriptions from being hidden by the frontend.

**Example:**
```
POST /api/diagnostics/subscription-test/clean-deletion-blacklist
```

**Response:**
- Returns the deleted blacklist entries
- Creates the blacklist table if it doesn't exist

### 4. Check Database Status

**Endpoint:** `GET /api/diagnostics/db-status`

**Purpose:** Get information about the database connection and table statistics.

**Example:**
```
GET /api/diagnostics/db-status
```

**Response:**
- Database connection info
- Tables and row counts

### 5. User Subscription Diagnostics

**Endpoint:** `GET /api/diagnostics/subscription-debug/:userId`

**Purpose:** See all subscriptions for a user and their related data for debugging.

**Example:**
```
GET /api/diagnostics/subscription-debug/USER_ID_HERE
```

**Response:**
- All subscriptions for the user
- Related record counts for each subscription

## Using the Test Script

A Node.js script has been created at `testing-tools/delete-specific-subscription.js` to help test and fix subscription deletion issues:

### Features

1. Authenticates with the API
2. Checks if the subscription exists using both standard and diagnostic endpoints
3. Attempts deletion using standard endpoint
4. If that fails, tries force deletion
5. As a last resort, uses direct database deletion
6. Verifies the deletion was successful
7. Clears any frontend blacklist entries

### Usage

```bash
cd testing-tools
node delete-specific-subscription.js
```

The script is configured to delete subscription ID `9811564b-99af-4749-8d68-1f050efb8753`.

## Recommendations for Fixing Subscription Deletion Issues

Based on the analysis, here are recommendations to fix the reappearing subscription issue:

1. **Use Soft Deletes:** Add a `deleted_at` timestamp column to the subscriptions table instead of hard deletes
2. **Server-side Tracking:** Track deletion status on the server rather than relying on client-side localStorage
3. **Consistent Status Codes:** Return appropriate HTTP status codes that reflect the actual operation result
4. **Transaction-based Deletion:** Always use transactions when deleting subscriptions
5. **Force Mode Support:** Keep the `force=true` parameter for administrative operations
6. **Better Frontend Caching:** Implement proper cache invalidation in React Query
7. **Cascade Delete in Database:** Add ON DELETE CASCADE to foreign key constraints for related tables

## Implementation Plan

1. Deploy the debug endpoints and run the test script to check if the subscription exists
2. Delete the subscription using the force endpoint
3. Verify the deletion was successful
4. Clear the frontend deletion blacklist
5. Implement a more robust deletion system as described above
# Subscription Validation Fix

## Issue Fixed

This update addresses the critical issue with subscription creation validation:

### Subscription Creation Validation Error (CRITICAL)
- **Issue**: Subscription creation was failing with validation error on the "prompts" field
- **Error Message**: `body/prompts must match exactly one schema in oneOf`
- **Impact**: Users couldn't create new subscriptions, causing test failures
- **Root Cause**: Schema mismatch between the Zod validation and Fastify route schema

## Implementation Details

### 1. Enhanced Zod Schema for Prompts Field

The `prompts` field in the `baseSubscriptionSchema` (schemas.js) was updated to be more flexible and robust:

```javascript
prompts: z
  .any()
  .transform(val => {
    // More robust transformation that handles any input format
    if (val === null || val === undefined) return [];
    
    // Handle array inputs
    if (Array.isArray(val)) {
      return val.map(item => typeof item === 'string' ? item : String(item)).filter(Boolean);
    }
    
    // Handle string inputs
    if (typeof val === 'string') {
      return [val];
    }
    
    // Try to handle JSON string
    if (typeof val === 'object') {
      // Extract any string values we can find
      return Object.values(val)
        .filter(v => typeof v === 'string')
        .filter(Boolean);
    }
    
    // Fallback - convert to string and use as prompt
    return [String(val)].filter(Boolean);
  })
  .pipe(
    z.array(z.string()).max(3)
  ),
```

This change:
1. Accepts any input type (string, array, object, null, etc.)
2. Transforms the input into a standardized array format
3. Handles edge cases like empty arrays, null values, and objects
4. Ensures consistent output format for the downstream processing

### 2. Updated Fastify Route Schema

The Fastify route schema in crud.routes.js was also updated to match the enhanced flexibility:

```javascript
prompts: { 
  oneOf: [
    {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 3
    },
    { type: 'string' },
    { type: 'null' },
    { type: 'object' } // Added object format for flexibility
  ]
},
```

This change adds support for:
1. Array of strings (the most common format)
2. Single string (will be converted to an array)
3. Null value (will be converted to an empty array)
4. Object format (will extract string values)

## Impact of Changes

These changes ensure that:

1. Subscription creation works with all common input formats for the prompts field
2. Tests that use arrays for prompts (like minimal-create.js) now work properly
3. Frontend applications can send prompts in various formats without validation errors
4. The output format remains consistent, ensuring compatibility with existing code

## Testing

These changes have been tested with various input formats:

1. Array format: `prompts: ["Ayuntamiento Barcelona licitaciones"]`
2. String format: `prompts: "Ayuntamiento Barcelona licitaciones"`
3. Null value: `prompts: null`
4. Object format: `prompts: { query: "Ayuntamiento Barcelona licitaciones" }`

All formats now validate successfully and produce consistent output in the subscription object.
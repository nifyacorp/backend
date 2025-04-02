# API Fixes - April 2025 Update

This document summarizes the improvements made to the API to address issues found in the latest test results.

## Issues Addressed

1. **Authorization Header Handling**:
   - Fixed header case sensitivity issues (Bearer vs bearer)
   - Added support for variations in header format
   - Improved extraction of tokens from authorization headers

2. **User Validation and Synchronization**:
   - Enhanced diagnostics endpoint for user validation
   - Added robust error handling and logging
   - Improved user record creation mechanism

3. **Request Body Parsing**:
   - Fixed JSON parsing issues in subscription creation
   - Added support for form-urlencoded request bodies
   - Improved error handling in body parsing
   - Added detailed logging for API troubleshooting

4. **Schema Validation**:
   - Made data validation more flexible
   - Normalized type and frequency values
   - Improved handling of prompts (string vs array)
   - Added better error messages for validation failures

## Key Changes

### 1. Authorization Header Handling

The authentication middleware now uses a case-insensitive approach to handle different header formats:

```javascript
// Check header format (case insensitive)
if (!authHeader.match(/^bearer\s+.+$/i)) {
  return response.status(401).json({
    status: 'error',
    code: 'UNAUTHORIZED',
    message: 'Invalid Authorization header format. Must be: Bearer <token>'
  });
}

// Extract token (case insensitive and handles extra spaces)
const token = authHeader.replace(/^bearer\s+/i, '');
```

This allows the API to accept various header formats:
- `Authorization: Bearer <token>`
- `Authorization: bearer <token>`
- `authorization: Bearer <token>`
- `Authorization: Bearer  <token>` (extra spaces)

### 2. Request Body Parsing

The JSON body parser has been enhanced to handle various input formats and provide better debugging:

```javascript
// Log raw request details
console.log(`Request body parser (${req.method} ${req.url}):`, {
  contentType: req.headers['content-type'],
  contentLength: req.headers['content-length'],
  bodyLength: body?.length || 0,
  bodyEmpty: !body || body.trim() === '',
  authHeader: req.headers.authorization ? 
    `${req.headers.authorization.substring(0, 10)}...` : 'missing',
  userIdHeader: req.headers['x-user-id'] || 'missing'
});
```

For subscription creation, we added special handling of prompts:

```javascript
// Handle prompts that might be a string instead of array
if (json.prompts && typeof json.prompts === 'string') {
  try {
    // First try to parse as JSON string that contains an array
    json.prompts = JSON.parse(json.prompts);
  } catch (e) {
    // If that fails, treat it as a single prompt string
    json.prompts = [json.prompts];
  }
} else if (!json.prompts) {
  // Default to empty array if missing
  json.prompts = [];
}
```

We also added support for form-urlencoded data:

```javascript
fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, function (req, body, done) {
  // Parse form data and convert to object
  const parsed = new URLSearchParams(body);
  const result = {};
  
  for (const [key, value] of parsed.entries()) {
    result[key] = value;
  }
  
  done(null, result);
});
```

### 3. Schema Validation

The subscription schemas were made more flexible to handle various input formats:

```javascript
// More flexible type schema that accepts various forms
const subscriptionTypeSchema = z.union([
  z.enum(['boe', 'real-estate', 'custom', 'doga']),
  z.string().transform(val => {
    // Normalize type values
    const normalized = val.toLowerCase();
    if (normalized === 'boe') return 'boe';
    if (['real-estate', 'real estate', 'inmobiliaria', 'property'].includes(normalized)) {
      return 'real-estate';
    }
    if (normalized === 'doga') return 'doga';
    return 'custom'; // Default to custom for any other value
  })
]);
```

For the subscription creation schema, we added more robust handling:

```javascript
// Prompts can be an array of strings or a single string (will be converted to array)
prompts: z
  .union([
    z.array(z.string()).min(1).max(3),
    z.string().transform(val => [val])
  ])
  .optional()
  .default([]),
```

### 4. Diagnostic Improvements

The user diagnostic endpoint was enhanced to provide better debugging information:

```javascript
// Output detailed debugging information
console.log('Diagnostics user endpoint called:', {
  hasUser: !!req.user,
  userId: req.user?.id,
  userEmail: req.user?.email,
  hasToken: !!req.user?.token,
  tokenSub: req.user?.token?.sub,
  headers: {
    auth: req.headers.authorization ? 
      `${req.headers.authorization.substring(0, 10)}...` : 'missing',
    userId: req.headers['x-user-id'] || 'missing',
    contentType: req.headers['content-type'],
    allHeaders: Object.keys(req.headers)
  },
  userObject: req.user ? JSON.stringify(req.user) : 'missing'
});
```

## Testing

A comprehensive test script has been created to verify the fixes:

```javascript
// Test different header formats
const headerFormats = [
  { name: 'Standard format', headers: { 'Authorization': `Bearer ${AUTH_TOKEN}`, 'X-User-ID': USER_ID } },
  { name: 'Lowercase bearer', headers: { 'Authorization': `bearer ${AUTH_TOKEN}`, 'X-User-ID': USER_ID } },
  { name: 'Lowercase header name', headers: { 'authorization': `Bearer ${AUTH_TOKEN}`, 'x-user-id': USER_ID } },
  { name: 'Extra spaces', headers: { 'Authorization': `Bearer  ${AUTH_TOKEN}`, 'X-User-ID': USER_ID } }
];
```

The test script also verifies subscription creation with different body formats:

```javascript
// Test subscription data with different formats
const testCases = [
  {
    name: 'Standard format',
    body: {
      name: `Test Subscription ${new Date().toISOString()}`,
      type: 'boe',
      prompts: ['test keyword'],
      frequency: 'daily',
      description: 'Standard format test'
    }
  },
  {
    name: 'String prompts',
    body: {
      name: `Test Subscription String ${new Date().toISOString()}`,
      type: 'boe',
      prompts: 'test keyword single',
      frequency: 'daily',
      description: 'String prompts test'
    }
  },
  // Additional test cases...
];
```

To run the tests, use the provided script:

```bash
./run-api-tests.sh
```

## Conclusion

These changes make the API much more robust in handling various client request formats. Key improvements include:

1. Case-insensitive Authorization header handling
2. Flexible request body parsing with better error messages
3. Normalization of input values for subscription creation
4. Enhanced logging for better troubleshooting

These changes should resolve the issues identified in the latest test results, particularly the Authorization header handling and the request body validation problems.
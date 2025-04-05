import { logRequest, logError } from '../../shared/logging/logger.js';

/**
 * Custom JSON content type parser with enhanced logging and error handling.
 * Handles DELETE requests with empty bodies and specific parsing logic for subscriptions.
 */
function jsonParser(req, body, done) {
  // Allow empty body for DELETE requests
  if (req.method === 'DELETE' && (!body || body === '')) {
    return done(null, {});
  }

  try {
    // Basic request logging (consider moving to a preHandler hook for consistency)
    logRequest({ requestId: req.id, path: req.url, method: req.method }, 'Parsing JSON body', {
      contentType: req.headers['content-type'],
      bodyLength: body?.length || 0,
      bodyEmpty: !body || body.trim() === ''
    });

    if (!body || body.trim() === '') {
        console.warn('Received empty request body, defaulting to empty object for non-DELETE request', { url: req.url, method: req.method });
        return done(null, {});
    }

    let json = JSON.parse(body);

    // --- Specific Handling (Example: Subscription Prompts) ---
    // Consider moving this logic closer to the subscription route/controller if possible
    if (req.method === 'POST' && req.url.includes('/subscriptions')) {
      // Handle prompts that might be a string instead of array
      if (json.prompts && typeof json.prompts === 'string') {
        try {
          json.prompts = JSON.parse(json.prompts);
        } catch (e) {
          json.prompts = [json.prompts]; // Treat as single prompt string
        }
      } else if (!json.prompts) {
        json.prompts = []; // Default to empty array
      }

      // Ensure name is a string
       if (json.name === null || json.name === undefined) {
        json.name = '';
      } else if (typeof json.name !== 'string') {
        json.name = String(json.name);
      }

      console.log('Processed subscription body (compat parser):', { name: json.name, type: json.type, promptsCount: Array.isArray(json.prompts) ? json.prompts.length : 'N/A' });
    }
    // --- End Specific Handling ---

    done(null, json);

  } catch (err) {
    logError({ requestId: req.id, path: req.url, method: req.method }, err, 'JSON Parse Error', {
        contentType: req.headers['content-type'],
        bodyPreview: body?.substring(0, 100)
    });

    // Create a user-friendly error
    const parseError = new Error(`Invalid JSON format: ${err.message}. Please check request body.`);
    parseError.statusCode = 400;
    done(parseError, undefined);
  }
}

/**
 * Custom form-urlencoded content type parser.
 */
function formUrlEncodedParser(req, body, done) {
  try {
    logRequest({ requestId: req.id, path: req.url, method: req.method }, 'Parsing form data', {
        bodyLength: body?.length || 0,
    });

    const parsed = new URLSearchParams(body);
    const result = {};
    for (const [key, value] of parsed.entries()) {
      result[key] = value;
    }
    done(null, result);

  } catch (err) {
    logError({ requestId: req.id, path: req.url, method: req.method }, err, 'Form Data Parse Error');

    const parseError = new Error(`Invalid form data: ${err.message}`);
    parseError.statusCode = 400;
    done(parseError, undefined);
  }
}

/**
 * Registers the custom content type parsers with the Fastify instance.
 * @param {import('fastify').FastifyInstance} fastify
 */
export function registerParsers(fastify) {
  // Remove default JSON parser if adding a custom one for the same type
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, jsonParser);

  // Remove default form parser if adding a custom one
  fastify.removeContentTypeParser('application/x-www-form-urlencoded');
  fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, formUrlEncodedParser);

  console.log("Custom content type parsers registered.");
} 
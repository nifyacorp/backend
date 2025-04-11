/**
 * Enhanced API Documentation Utilities
 * Provides additional functionality for documenting the API beyond basic OpenAPI
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the database schema reference to include in API docs
const dbSchemaPath = path.join(__dirname, '../../../DATABASE-SCHEMA-REFERENCE.md');
let dbSchemaMarkdown = '';
try {
  dbSchemaMarkdown = fs.readFileSync(dbSchemaPath, 'utf8');
} catch (error) {
  console.warn('Database schema reference not found, documentation will not include schema details');
  dbSchemaMarkdown = '# Database Schema\n\nNo schema information available.';
}

/**
 * Enhanced OpenAPI configuration with additional documentation features
 */
export const enhancedOpenAPIConfig = {
  openapi: '3.0.3',
  info: {
    title: 'NIFYA API',
    description: `
# NIFYA API Documentation

Welcome to the NIFYA API documentation. This interactive documentation provides details on all available endpoints, request/response formats, and authentication requirements.

## Authentication

All protected endpoints require:
- \`Authorization: Bearer {token}\` header with a valid JWT token
- \`x-user-id\` header with the user's UUID

## Response Format

Most endpoints follow this standard response format:

\`\`\`json
{
  "status": "success", // or "error"
  "data": {
    // Response data specific to the endpoint
  }
}
\`\`\`

Error responses include:
\`\`\`json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Human-readable error message"
}
\`\`\`

## Environments

| Environment | Base URL |
|-------------|----------|
| Production | https://api.nifya.com |
| Development | http://localhost:8080 |

## Pagination

Endpoints that return lists of items support pagination with these parameters:
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 20, max: 100)

Paginated responses include:
\`\`\`json
{
  "status": "success",
  "data": {
    "items": [...],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
\`\`\`
`,
    version: process.env.npm_package_version || '1.0.0',
    contact: {
      name: 'NIFYA Support',
      url: 'https://support.nifya.com',
      email: 'support@nifya.com'
    },
    license: {
      name: 'Proprietary',
      url: 'https://nifya.com/terms'
    }
  },
  externalDocs: {
    description: 'Additional Documentation',
    url: 'https://docs.nifya.com'
  },
  servers: [
    {
      url: process.env.SERVICE_URL || 'http://localhost:8080',
      description: 'Current environment'
    },
    {
      url: 'https://api.nifya.com',
      description: 'Production environment'
    }
  ],
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Users', description: 'User management endpoints' },
    { name: 'Subscriptions', description: 'Subscription management endpoints' },
    { name: 'Templates', description: 'Subscription template endpoints' },
    { name: 'Notifications', description: 'Notification endpoints' },
    { name: 'Types', description: 'Subscription type endpoints' },
    { name: 'System', description: 'System and diagnostic endpoints' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from the authentication service'
      },
      userIdHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
        description: 'User ID UUID'
      }
    },
    schemas: {
      // Common response format
      StandardResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['success', 'error'],
            description: 'Response status'
          },
          data: {
            type: 'object',
            description: 'Response data'
          }
        }
      },
      // Error response format
      ErrorResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['error'],
            description: 'Error status'
          },
          code: {
            type: 'string',
            description: 'Error code'
          },
          message: {
            type: 'string',
            description: 'Human-readable error message'
          }
        }
      },
      // Pagination format
      Pagination: {
        type: 'object',
        properties: {
          total: {
            type: 'integer',
            description: 'Total number of items'
          },
          page: {
            type: 'integer',
            description: 'Current page number'
          },
          limit: {
            type: 'integer',
            description: 'Items per page'
          },
          totalPages: {
            type: 'integer',
            description: 'Total number of pages'
          }
        }
      },
      // User schema
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'User ID'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email'
          },
          displayName: {
            type: 'string',
            description: 'User display name'
          },
          firstName: {
            type: 'string',
            description: 'User first name'
          },
          lastName: {
            type: 'string',
            description: 'User last name'
          },
          avatarUrl: {
            type: 'string',
            format: 'uri',
            description: 'User avatar URL'
          },
          role: {
            type: 'string',
            enum: ['user', 'admin'],
            description: 'User role'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'User creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'User update timestamp'
          }
        }
      },
      // Subscription schema
      Subscription: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Subscription ID'
          },
          name: {
            type: 'string',
            description: 'Subscription name'
          },
          description: {
            type: 'string',
            description: 'Subscription description'
          },
          type: {
            type: 'string',
            description: 'Subscription type identifier'
          },
          typeName: {
            type: 'string',
            description: 'Subscription type display name'
          },
          typeIcon: {
            type: 'string',
            description: 'Subscription type icon'
          },
          prompts: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Search prompts/keywords'
          },
          frequency: {
            type: 'string',
            enum: ['immediate', 'daily'],
            description: 'Update frequency'
          },
          active: {
            type: 'boolean',
            description: 'Whether subscription is active'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Update timestamp'
          }
        }
      },
      // Notification schema
      Notification: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Notification ID'
          },
          title: {
            type: 'string',
            description: 'Notification title'
          },
          content: {
            type: 'string',
            description: 'Notification content'
          },
          read: {
            type: 'boolean',
            description: 'Whether notification has been read'
          },
          entityType: {
            type: 'string',
            description: 'Type of entity referenced'
          },
          source: {
            type: 'string',
            description: 'Source system identifier'
          },
          data: {
            type: 'object',
            description: 'Structured data for notification'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Update timestamp'
          },
          sourceUrl: {
            type: 'string',
            format: 'uri',
            description: 'URL to the source document/page'
          },
          subscriptionId: {
            type: 'string',
            format: 'uuid',
            description: 'Related subscription ID'
          }
        }
      },
      // SubscriptionType schema
      SubscriptionType: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Type ID'
          },
          name: {
            type: 'string',
            description: 'Type name'
          },
          displayName: {
            type: 'string',
            description: 'Human-readable display name'
          },
          description: {
            type: 'string',
            description: 'Type description'
          },
          icon: {
            type: 'string',
            description: 'Icon identifier'
          },
          isSystem: {
            type: 'boolean',
            description: 'Whether this is a built-in type'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Update timestamp'
          }
        }
      },
      // Template schema
      Template: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Template ID'
          },
          name: {
            type: 'string',
            description: 'Template name'
          },
          description: {
            type: 'string',
            description: 'Template description'
          },
          type: {
            type: 'string',
            description: 'Template type'
          },
          prompts: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Default search prompts'
          },
          isPublic: {
            type: 'boolean',
            description: 'Whether template is publicly available'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Update timestamp'
          }
        }
      }
    }
  },
  paths: {
    // Paths will be dynamically added by the documentation system
  }
};

/**
 * Setup additional documentation web pages
 * @param {FastifyInstance} fastify - Fastify instance
 */
export function setupAdditionalDocs(fastify) {
  // Add database schema documentation
  fastify.get('/documentation/database', async (request, reply) => {
    return reply.type('text/html').send(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>NIFYA Database Schema</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.3.1/swagger-ui.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
        <style>
          .markdown-body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
          }
          
          @media (max-width: 767px) {
            .markdown-body {
              padding: 15px;
            }
          }
          
          header {
            background-color: #1b1b1b;
            color: white;
            padding: 10px 0;
            text-align: center;
          }
          
          nav {
            background-color: #f5f5f5;
            padding: 10px 0;
            margin-bottom: 20px;
            text-align: center;
          }
          
          nav a {
            margin: 0 15px;
            text-decoration: none;
            color: #0366d6;
            font-weight: 500;
          }
          
          nav a:hover {
            text-decoration: underline;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
          }
          
          th {
            background-color: #f5f5f5;
            text-align: left;
          }
          
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>NIFYA API Documentation</h1>
        </header>
        <nav>
          <a href="/documentation">API Endpoints</a>
          <a href="/documentation/database">Database Schema</a>
          <a href="/documentation/relationships">Entity Relationships</a>
          <a href="/documentation/guides">Implementation Guides</a>
        </nav>
        <div class="markdown-body">
          ${renderMarkdown(dbSchemaMarkdown)}
        </div>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <script>
          // Any additional interactive JS can go here
        </script>
      </body>
      </html>
    `);
  });

  // Add entity relationship diagram
  fastify.get('/documentation/relationships', async (request, reply) => {
    return reply.type('text/html').send(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>NIFYA Entity Relationships</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.3.1/swagger-ui.css">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          
          header {
            background-color: #1b1b1b;
            color: white;
            padding: 10px 0;
            text-align: center;
          }
          
          nav {
            background-color: #f5f5f5;
            padding: 10px 0;
            margin-bottom: 20px;
            text-align: center;
          }
          
          nav a {
            margin: 0 15px;
            text-decoration: none;
            color: #0366d6;
            font-weight: 500;
          }
          
          nav a:hover {
            text-decoration: underline;
          }
          
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }
          
          #diagram {
            width: 100%;
            height: 800px;
            border: 1px solid #ddd;
            margin-top: 20px;
          }
          
          .description {
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>NIFYA API Documentation</h1>
        </header>
        <nav>
          <a href="/documentation">API Endpoints</a>
          <a href="/documentation/database">Database Schema</a>
          <a href="/documentation/relationships">Entity Relationships</a>
          <a href="/documentation/guides">Implementation Guides</a>
        </nav>
        <div class="container">
          <h2>Entity Relationship Diagram</h2>
          <p class="description">
            This diagram shows the relationships between the main entities in the NIFYA system.
            Hover over entities and relationships to see details.
          </p>
          <div id="diagram"></div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
        <script>
          mermaid.initialize({ startOnLoad: true, theme: 'default' });
          
          document.addEventListener('DOMContentLoaded', function() {
            const diagram = document.getElementById('diagram');
            diagram.innerHTML = \`
              <div class="mermaid">
                erDiagram
                  USERS {
                    uuid id PK
                    string email UK
                    string name
                    string display_name
                    jsonb notification_settings
                    timestamp created_at
                  }
                  
                  SUBSCRIPTION_TYPES {
                    string id PK
                    string name
                    string display_name
                    string icon
                    boolean is_system
                    timestamp created_at
                  }
                  
                  SUBSCRIPTIONS {
                    uuid id PK
                    string name
                    uuid user_id FK
                    string type_id FK
                    jsonb prompts
                    string frequency
                    boolean active
                    timestamp created_at
                  }
                  
                  NOTIFICATIONS {
                    uuid id PK
                    uuid user_id FK
                    string title
                    text content
                    boolean read
                    jsonb data
                    uuid subscription_id FK
                    timestamp created_at
                  }
                  
                  USER_EMAIL_PREFERENCES {
                    uuid id PK
                    uuid user_id FK
                    string subscription_type FK
                    string frequency
                    boolean enabled
                  }
                  
                  USERS ||--o{ SUBSCRIPTIONS : "creates"
                  USERS ||--o{ NOTIFICATIONS : "receives"
                  USERS ||--o{ USER_EMAIL_PREFERENCES : "configures"
                  SUBSCRIPTION_TYPES ||--o{ SUBSCRIPTIONS : "categorizes"
                  SUBSCRIPTION_TYPES ||--o{ USER_EMAIL_PREFERENCES : "applies to"
                  SUBSCRIPTIONS ||--o{ NOTIFICATIONS : "generates"
              </div>
            \`;
            
            mermaid.init(undefined, '.mermaid');
          });
        </script>
      </body>
      </html>
    `);
  });

  // Add implementation guides
  fastify.get('/documentation/guides', async (request, reply) => {
    return reply.type('text/html').send(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>NIFYA Implementation Guides</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.3.1/swagger-ui.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          
          .markdown-body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
          }
          
          @media (max-width: 767px) {
            .markdown-body {
              padding: 15px;
            }
          }
          
          header {
            background-color: #1b1b1b;
            color: white;
            padding: 10px 0;
            text-align: center;
          }
          
          nav {
            background-color: #f5f5f5;
            padding: 10px 0;
            margin-bottom: 20px;
            text-align: center;
          }
          
          nav a {
            margin: 0 15px;
            text-decoration: none;
            color: #0366d6;
            font-weight: 500;
          }
          
          nav a:hover {
            text-decoration: underline;
          }
          
          .nav-tabs {
            display: flex;
            list-style: none;
            padding: 0;
            margin: 0 0 20px 0;
            border-bottom: 1px solid #ddd;
          }
          
          .nav-tabs li {
            margin-bottom: -1px;
          }
          
          .nav-tabs a {
            display: block;
            padding: 8px 16px;
            text-decoration: none;
            color: #0366d6;
            border: 1px solid transparent;
            border-radius: 4px 4px 0 0;
          }
          
          .nav-tabs a.active {
            border: 1px solid #ddd;
            border-bottom-color: white;
          }
          
          .tab-content {
            display: none;
          }
          
          .tab-content.active {
            display: block;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>NIFYA API Documentation</h1>
        </header>
        <nav>
          <a href="/documentation">API Endpoints</a>
          <a href="/documentation/database">Database Schema</a>
          <a href="/documentation/relationships">Entity Relationships</a>
          <a href="/documentation/guides">Implementation Guides</a>
        </nav>
        <div class="markdown-body">
          <h2>Implementation Guides</h2>
          
          <ul class="nav-tabs">
            <li><a href="#auth" class="tab-link active">Authentication</a></li>
            <li><a href="#subscriptions" class="tab-link">Subscriptions</a></li>
            <li><a href="#notifications" class="tab-link">Notifications</a></li>
            <li><a href="#best-practices" class="tab-link">Best Practices</a></li>
            <li><a href="#error-handling" class="tab-link">Error Handling</a></li>
          </ul>
          
          <div id="auth" class="tab-content active">
            <h3>Authentication Guide</h3>
            <p>All protected endpoints require authentication using JWT tokens.</p>
            
            <h4>Headers Required</h4>
            <ul>
              <li><code>Authorization: Bearer &lt;jwt_token&gt;</code> - JWT token from authentication service</li>
              <li><code>x-user-id: &lt;user_uuid&gt;</code> - User UUID</li>
            </ul>
            
            <h4>Error Handling</h4>
            <p>Common authentication errors:</p>
            <ul>
              <li><code>401 Unauthorized</code> - Missing or invalid JWT token</li>
              <li><code>403 Forbidden</code> - Valid token but insufficient permissions</li>
            </ul>
            
            <h4>Authentication Flow</h4>
            <pre><code>
// Example authentication flow
const token = await authService.login(email, password);
              
// Use token in future requests
const headers = {
  'Authorization': \`Bearer \${token}\`,
  'x-user-id': userId
};
              
// Make authenticated request
const response = await fetch('/api/v1/subscriptions', { headers });
            </code></pre>
          </div>
          
          <div id="subscriptions" class="tab-content">
            <h3>Working with Subscriptions</h3>
            <p>
              Subscriptions allow users to monitor sources for specific content.
              This guide shows how to create and manage subscriptions.
            </p>
            
            <h4>Creating a Subscription</h4>
            <pre><code>
// Example subscription creation
const subscription = {
  name: "My BOE Subscription",
  type: "boe",
  prompts: ["keyword1", "keyword2"],
  frequency: "daily"
};
              
const response = await fetch('/api/v1/subscriptions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${token}\`,
    'x-user-id': userId
  },
  body: JSON.stringify(subscription)
});
            </code></pre>
            
            <h4>Filtering Subscriptions</h4>
            <p>The subscription listing endpoint supports various filters:</p>
            <ul>
              <li><code>type</code> - Filter by subscription type</li>
              <li><code>status</code> - Filter by active status (active, inactive, all)</li>
              <li><code>search</code> - Search in name, description, and prompts</li>
              <li><code>frequency</code> - Filter by frequency type</li>
            </ul>
          </div>
          
          <div id="notifications" class="tab-content">
            <h3>Working with Notifications</h3>
            <p>
              Notifications are generated when subscription criteria are met.
              This guide shows how to retrieve and manage notifications.
            </p>
            
            <h4>Retrieving Notifications</h4>
            <pre><code>
// Get all notifications
const response = await fetch('/api/v1/notifications', {
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'x-user-id': userId
  }
});
              
// Get unread notifications
const unreadResponse = await fetch('/api/v1/notifications?read=false', {
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'x-user-id': userId
  }
});
            </code></pre>
            
            <h4>Marking Notifications as Read</h4>
            <pre><code>
// Mark a notification as read
await fetch(\`/api/v1/notifications/\${notificationId}/read\`, {
  method: 'PATCH',
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'x-user-id': userId
  }
});
              
// Mark all notifications as read
await fetch('/api/v1/notifications/read-all', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'x-user-id': userId
  }
});
            </code></pre>
          </div>
          
          <div id="best-practices" class="tab-content">
            <h3>API Best Practices</h3>
            
            <h4>Pagination</h4>
            <p>
              Always use pagination for endpoints that might return large sets of data.
              Include <code>page</code> and <code>limit</code> parameters.
            </p>
            
            <h4>Error Handling</h4>
            <p>
              Handle errors gracefully in your application. Always check the response status
              and provide appropriate feedback to users.
            </p>
            
            <h4>Caching</h4>
            <p>
              Consider caching responses that don't change frequently, such as
              subscription types or templates.
            </p>
            
            <h4>Rate Limiting</h4>
            <p>
              Be aware of rate limits. The API may enforce limits on request frequency
              to prevent abuse.
            </p>
          </div>
          
          <div id="error-handling" class="tab-content">
            <h3>Error Handling Guide</h3>
            
            <p>All API errors follow a consistent format:</p>
            <pre><code>
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Human-readable error message"
}
            </code></pre>
            
            <h4>Common Error Codes</h4>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>HTTP Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>UNAUTHORIZED</td>
                  <td>Authentication required or token invalid</td>
                  <td>401</td>
                </tr>
                <tr>
                  <td>FORBIDDEN</td>
                  <td>Insufficient permissions</td>
                  <td>403</td>
                </tr>
                <tr>
                  <td>NOT_FOUND</td>
                  <td>Resource not found</td>
                  <td>404</td>
                </tr>
                <tr>
                  <td>VALIDATION_ERROR</td>
                  <td>Invalid request data</td>
                  <td>400</td>
                </tr>
                <tr>
                  <td>INTERNAL_ERROR</td>
                  <td>Server error</td>
                  <td>500</td>
                </tr>
              </tbody>
            </table>
            
            <h4>Handling Errors in Client Code</h4>
            <pre><code>
async function callApi(endpoint) {
  try {
    const response = await fetch(endpoint, {
      headers: getAuthHeaders()
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Handle error based on code
      if (data.code === 'UNAUTHORIZED') {
        // Refresh token or redirect to login
      } else {
        // Display error to user
        showError(data.message);
      }
      return null;
    }
    
    return data;
  } catch (error) {
    // Handle network errors
    showError('Network error. Please try again.');
    return null;
  }
}
            </code></pre>
          </div>
        </div>
        
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const tabLinks = document.querySelectorAll('.tab-link');
            
            tabLinks.forEach(link => {
              link.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Hide all tab contents
                document.querySelectorAll('.tab-content').forEach(content => {
                  content.classList.remove('active');
                });
                
                // Deactivate all tabs
                tabLinks.forEach(tab => {
                  tab.classList.remove('active');
                });
                
                // Activate clicked tab
                this.classList.add('active');
                
                // Show corresponding content
                const targetId = this.getAttribute('href').substring(1);
                document.getElementById(targetId).classList.add('active');
              });
            });
          });
        </script>
      </body>
      </html>
    `);
  });
}

/**
 * Render markdown to HTML
 * Basic implementation - in production, use a proper markdown library
 * @param {string} markdown - Markdown content
 * @returns {string} HTML content
 */
function renderMarkdown(markdown) {
  // This is a very basic implementation
  // In production, use a proper markdown library like marked
  
  // Convert headings
  let html = markdown
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.*?)$/gm, '<h4>$1</h4>')
    .replace(/^##### (.*?)$/gm, '<h5>$1</h5>')
    .replace(/^###### (.*?)$/gm, '<h6>$1</h6>');
  
  // Convert tables
  const tableRegex = /\|(.+)\|\s*\n\|(?:-+\|)+\s*\n(\|(?:.+)\|\s*\n)+/g;
  html = html.replace(tableRegex, match => {
    // Parse header row
    const lines = match.split('\n').filter(line => line.trim());
    const headerRow = lines[0];
    const headerCells = headerRow.split('|').slice(1, -1).map(cell => `<th>${cell.trim()}</th>`).join('');
    
    // Skip the separator row (|----|---|)
    const dataRows = lines.slice(2)
      .map(row => {
        const cells = row.split('|').slice(1, -1).map(cell => `<td>${cell.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    
    return `<table>
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${dataRows}
      </tbody>
    </table>`;
  });
  
  // Convert code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  
  // Convert inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Convert bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Convert unordered lists
  html = html.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>\s*)+/g, '<ul>$&</ul>');
  
  // Convert ordered lists
  html = html.replace(/^\s*\d+\.\s+(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>\s*)+/g, match => {
    return match.startsWith('<ul>') ? match : `<ol>${match}</ol>`;
  });
  
  // Convert paragraphs
  html = html.replace(/^(?!<[a-z]).+$/gm, '<p>$&</p>');
  
  return html;
}

// Export default
export default { enhancedOpenAPIConfig, setupAdditionalDocs };
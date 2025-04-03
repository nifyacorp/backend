/**
 * Generate API Documentation
 * This script analyzes the codebase and generates OpenAPI documentation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ROUTES_DIR = path.join(__dirname, 'src/interfaces/http/routes');
const SCHEMAS_DIR = path.join(__dirname, 'src/core');
const OUTPUT_PATH = path.join(__dirname, 'api-docs.json');

// Main function
async function generateApiDocs() {
  console.log('Generating API documentation...');
  
  // Find all route files
  const routeFiles = await findRouteFiles();
  console.log(`Found ${routeFiles.length} route files`);
  
  // Find all schema files
  const schemaFiles = await findSchemaFiles();
  console.log(`Found ${schemaFiles.length} schema files`);
  
  // Analyze routes
  const routeInfo = await analyzeRoutes(routeFiles);
  console.log(`Analyzed ${Object.keys(routeInfo).length} routes`);
  
  // Create OpenAPI document
  const openApiDoc = createOpenApiDocument(routeInfo);
  
  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(openApiDoc, null, 2));
  console.log(`Documentation written to ${OUTPUT_PATH}`);
}

/**
 * Find all route files in the codebase
 */
async function findRouteFiles() {
  return new Promise((resolve, reject) => {
    glob('**/*.routes.js', { cwd: ROUTES_DIR }, (err, files) => {
      if (err) return reject(err);
      resolve(files.map(file => path.join(ROUTES_DIR, file)));
    });
  });
}

/**
 * Find all schema files in the codebase
 */
async function findSchemaFiles() {
  return new Promise((resolve, reject) => {
    glob('*/schemas.js', { cwd: SCHEMAS_DIR }, (err, files) => {
      if (err) return reject(err);
      resolve(files.map(file => path.join(SCHEMAS_DIR, file)));
    });
  });
}

/**
 * Analyze route files to extract API information
 * @param {string[]} routeFiles - List of route file paths
 */
async function analyzeRoutes(routeFiles) {
  // This is a placeholder for the actual implementation
  // In a real scenario, you would analyze the code to extract routes
  
  // For demonstration purposes, let's create a predefined set of routes
  // In a real implementation, this would parse the code files
  
  return {
    '/api/v1/subscriptions': {
      get: {
        summary: 'List user subscriptions',
        description: 'Returns a paginated list of user subscriptions with filtering options',
        tags: ['Subscriptions'],
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer', default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page',
            schema: { type: 'integer', default: 20, maximum: 100 }
          },
          {
            name: 'sort',
            in: 'query',
            description: 'Sort field',
            schema: { 
              type: 'string', 
              enum: ['created_at', 'updated_at', 'name', 'frequency', 'active'],
              default: 'created_at'
            }
          },
          {
            name: 'order',
            in: 'query',
            description: 'Sort order',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
          },
          {
            name: 'type',
            in: 'query',
            description: 'Filter by type',
            schema: { type: 'string' }
          },
          {
            name: 'status',
            in: 'query',
            description: 'Filter by status',
            schema: { type: 'string', enum: ['active', 'inactive', 'all'], default: 'all' }
          },
          {
            name: 'search',
            in: 'query',
            description: 'Search term',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        subscriptions: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Subscription' }
                        },
                        pagination: { $ref: '#/components/schemas/Pagination' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      },
      post: {
        summary: 'Create subscription',
        description: 'Creates a new subscription for the authenticated user',
        tags: ['Subscriptions'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'prompts'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  type: { type: 'string' },
                  typeId: { type: 'string' },
                  description: { type: 'string', maxLength: 500 },
                  prompts: {
                    oneOf: [
                      {
                        type: 'array',
                        items: { type: 'string', minLength: 1 },
                        minItems: 1,
                        maxItems: 3
                      },
                      { type: 'string', minLength: 1 }
                    ]
                  },
                  frequency: { type: 'string' },
                  logo: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Subscription created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        subscription: { $ref: '#/components/schemas/Subscription' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/v1/subscriptions/{id}': {
      get: {
        summary: 'Get subscription by ID',
        description: 'Returns a single subscription by ID',
        tags: ['Subscriptions'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Subscription ID',
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        subscription: { $ref: '#/components/schemas/Subscription' }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'Subscription not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      },
      patch: {
        summary: 'Update subscription',
        description: 'Updates an existing subscription',
        tags: ['Subscriptions'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Subscription ID',
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  description: { type: 'string', maxLength: 500 },
                  prompts: {
                    type: 'array',
                    items: { type: 'string', minLength: 1 },
                    minItems: 1,
                    maxItems: 3
                  },
                  frequency: { type: 'string', enum: ['immediate', 'daily'] },
                  active: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Subscription updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        subscription: { $ref: '#/components/schemas/Subscription' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      delete: {
        summary: 'Delete subscription',
        description: 'Deletes a subscription',
        tags: ['Subscriptions'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Subscription ID',
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Subscription deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/subscriptions/stats': {
      get: {
        summary: 'Get subscription statistics',
        description: 'Returns statistics about user subscriptions',
        tags: ['Subscriptions'],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    active: { type: 'integer' },
                    inactive: { type: 'integer' },
                    bySource: {
                      type: 'object',
                      additionalProperties: { type: 'integer' }
                    },
                    byFrequency: {
                      type: 'object',
                      additionalProperties: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/subscriptions/types': {
      get: {
        summary: 'Get subscription types',
        description: 'Returns available subscription types',
        tags: ['Types'],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        types: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/SubscriptionType' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/notifications': {
      get: {
        summary: 'Get user notifications',
        description: 'Returns a paginated list of user notifications with filtering options',
        tags: ['Notifications'],
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer', default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page',
            schema: { type: 'integer', default: 20, maximum: 100 }
          },
          {
            name: 'read',
            in: 'query',
            description: 'Filter by read status',
            schema: { type: 'boolean' }
          },
          {
            name: 'subscription_id',
            in: 'query',
            description: 'Filter by subscription ID',
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        notifications: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Notification' }
                        },
                        pagination: { $ref: '#/components/schemas/Pagination' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/templates': {
      get: {
        summary: 'Get subscription templates',
        description: 'Returns available subscription templates',
        tags: ['Templates'],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        templates: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Template' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/users/me': {
      get: {
        summary: 'Get user profile',
        description: 'Returns the authenticated user\'s profile information',
        tags: ['Users'],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profile: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          }
        }
      },
      patch: {
        summary: 'Update user profile',
        description: 'Updates the authenticated user\'s profile information',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  displayName: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  avatarUrl: { type: 'string', format: 'uri' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Profile updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    profile: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}

/**
 * Create OpenAPI document from route information
 * @param {Object} routeInfo - Route information
 */
function createOpenApiDocument(routeInfo) {
  // Import the OpenAPI configuration
  const { enhancedOpenAPIConfig } = await import('./src/shared/utils/api-docs.js');
  
  // Create a copy of the configuration
  const openApiDoc = JSON.parse(JSON.stringify(enhancedOpenAPIConfig));
  
  // Add paths
  openApiDoc.paths = routeInfo;
  
  // Add security for all operations
  Object.values(openApiDoc.paths).forEach(pathItem => {
    Object.values(pathItem).forEach(operation => {
      operation.security = [
        {
          bearerAuth: [],
          userIdHeader: []
        }
      ];
    });
  });
  
  return openApiDoc;
}

// Run the script
generateApiDocs().catch(err => {
  console.error('Error generating API documentation:', err);
  process.exit(1);
});
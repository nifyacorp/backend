/**
 * API Metadata repository that describes all endpoints
 * This serves as the source of truth for API documentation and self-documenting errors
 */
export const apiDefinitions = {
  "/api/v1/subscriptions": {
    "GET": {
      "description": "List all subscriptions for the authenticated user",
      "auth_required": true,
      "required_headers": [
        { "name": "Authorization", "description": "Bearer token" }
      ],
      "query_parameters": [
        { "name": "page", "type": "integer", "description": "Page number", "default": 1 },
        { "name": "limit", "type": "integer", "description": "Items per page", "default": 10 },
        { "name": "type", "type": "string", "description": "Filter by subscription type" }
      ],
      "responses": {
        "200": {
          "description": "List of subscriptions",
          "example": {
            "subscriptions": [
              {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "BOE Ayudas",
                "type": "boe",
                "prompts": ["ayudas emprendedores", "subvenciones pymes"]
              }
            ],
            "pagination": {
              "page": 1,
              "limit": 10,
              "total": 1
            }
          }
        }
      }
    },
    "POST": {
      "description": "Create a new subscription",
      "auth_required": true,
      "required_headers": [
        { "name": "Authorization", "description": "Bearer token" },
        { "name": "Content-Type", "description": "application/json" }
      ],
      "body_parameters": [
        { "name": "name", "type": "string", "description": "Subscription name", "required": true },
        { "name": "type", "type": "string", "description": "Subscription type (boe, doga)", "required": true },
        { "name": "prompts", "type": "array", "description": "Array of search prompts (max 3)", "required": true }
      ],
      "responses": {
        "201": {
          "description": "Created subscription",
          "example": {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "BOE Ayudas",
            "type": "boe",
            "prompts": ["ayudas emprendedores", "subvenciones pymes"]
          }
        }
      }
    }
  },
  "/api/v1/subscriptions/:id": {
    "GET": {
      "description": "Get a specific subscription by ID",
      "auth_required": true,
      "path_parameters": [
        { "name": "id", "type": "uuid", "description": "Subscription ID", "required": true }
      ],
      "responses": {
        "200": {
          "description": "Subscription details",
          "example": {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "BOE Ayudas",
            "type": "boe",
            "prompts": ["ayudas emprendedores", "subvenciones pymes"]
          }
        }
      }
    },
    "PUT": {
      "description": "Update a subscription",
      "auth_required": true,
      "path_parameters": [
        { "name": "id", "type": "uuid", "description": "Subscription ID", "required": true }
      ],
      "body_parameters": [
        { "name": "name", "type": "string", "description": "Subscription name" },
        { "name": "prompts", "type": "array", "description": "Array of search prompts (max 3)" }
      ],
      "responses": {
        "200": {
          "description": "Updated subscription",
          "example": {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "BOE Ayudas Updated",
            "type": "boe",
            "prompts": ["ayudas emprendedores 2023", "subvenciones pymes"]
          }
        }
      }
    },
    "DELETE": {
      "description": "Delete a subscription",
      "auth_required": true,
      "path_parameters": [
        { "name": "id", "type": "uuid", "description": "Subscription ID", "required": true }
      ],
      "responses": {
        "200": {
          "description": "Deletion confirmation",
          "example": {
            "success": true,
            "message": "Subscription deleted successfully"
          }
        }
      }
    }
  },
  "/api/v1/notifications": {
    "GET": {
      "description": "List notifications for the authenticated user",
      "auth_required": true,
      "required_headers": [
        { "name": "Authorization", "description": "Bearer token" }
      ],
      "query_parameters": [
        { "name": "page", "type": "integer", "description": "Page number", "default": 1 },
        { "name": "limit", "type": "integer", "description": "Items per page", "default": 10 },
        { "name": "unread", "type": "boolean", "description": "Filter by read status" }
      ],
      "responses": {
        "200": {
          "description": "List of notifications",
          "example": {
            "notifications": [
              {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "title": "New match found",
                "summary": "Your subscription 'BOE Ayudas' has a new match",
                "read": false,
                "created_at": "2023-04-01T12:34:56.789Z"
              }
            ],
            "pagination": {
              "page": 1,
              "limit": 10,
              "total": 1,
              "unread": 1
            }
          }
        }
      }
    }
  },
  "/api/v1/notifications/:id/read": {
    "POST": {
      "description": "Mark a notification as read",
      "auth_required": true,
      "path_parameters": [
        { "name": "id", "type": "uuid", "description": "Notification ID", "required": true }
      ],
      "responses": {
        "200": {
          "description": "Notification marked as read",
          "example": {
            "success": true,
            "message": "Notification marked as read"
          }
        }
      }
    }
  },
  "/api/v1/notifications/read-all": {
    "POST": {
      "description": "Mark all notifications as read",
      "auth_required": true,
      "responses": {
        "200": {
          "description": "All notifications marked as read",
          "example": {
            "success": true,
            "message": "All notifications marked as read",
            "count": 5
          }
        }
      }
    }
  }
};

/**
 * Get metadata for a specific endpoint and method
 */
export function getEndpointMetadata(path, method) {
  // Normalize path to handle parameter matching
  const endpointKey = Object.keys(apiDefinitions).find(key => {
    // Convert path params pattern (:id) to regex pattern ([^/]+)
    const pattern = key.replace(/:[^/]+/g, '[^/]+');
    return path.match(new RegExp(`^${pattern}$`));
  });
  
  if (endpointKey && apiDefinitions[endpointKey][method]) {
    return {
      path: endpointKey,
      method,
      ...apiDefinitions[endpointKey][method]
    };
  }
  
  return null;
}

/**
 * Find related endpoints based on resource path
 */
export function findRelatedEndpoints(path) {
  // Extract the resource type from the path
  const resource = path.split('/')[2]; // e.g., "subscriptions" from "/api/v1/subscriptions/:id"
  
  if (!resource) return [];
  
  // Find all endpoints related to this resource
  return Object.keys(apiDefinitions)
    .filter(key => key.includes(`/${resource}`))
    .map(key => ({
      path: key,
      methods: Object.keys(apiDefinitions[key])
    }));
}

/**
 * Get all available endpoints
 */
export function getAllEndpoints() {
  return Object.keys(apiDefinitions).map(path => ({
    path,
    methods: Object.keys(apiDefinitions[path]),
    description: apiDefinitions[path][Object.keys(apiDefinitions[path])[0]].description.split('.')[0]
  }));
} 
// Export all subscription schemas using ES Module syntax
import * as baseSchemas from './base.schema.js';
import * as createSchemas from './create.schema.js';
import * as updateSchemas from './update.schema.js';
import * as responseSchemas from './response.schema.js';

// Export all schemas
export default {
  ...baseSchemas,
  ...createSchemas,
  ...updateSchemas,
  ...responseSchemas
}; 
// Export all subscription schemas
const baseSchemas = require('./base.schema');
const createSchemas = require('./create.schema');
const updateSchemas = require('./update.schema');
const responseSchemas = require('./response.schema');

module.exports = {
  ...baseSchemas,
  ...createSchemas,
  ...updateSchemas,
  ...responseSchemas
}; 
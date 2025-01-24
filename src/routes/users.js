import { query } from '../config/database.js';

export async function userRoutes(fastify, options) {
  // Get user profile
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            preferences: { type: 'object' },
            notification_settings: { type: 'object' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }
    
    return result.rows[0];
  });

  // Update user preferences
  fastify.patch('/:id/preferences', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          preferences: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const { preferences } = request.body;
    
    const result = await query(
      'UPDATE users SET preferences = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [preferences, id]
    );
    
    if (result.rows.length === 0) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }
    
    return result.rows[0];
  });
}
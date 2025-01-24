export async function authPlugin(fastify, options) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader) {
        throw new Error('No authorization header');
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Here you would verify the token and get the user data
      // For now, we'll just extract the user ID from the token
      // In production, you should properly verify the JWT token
      const userId = token; // This should be replaced with proper token verification

      request.user = { id: userId };
    } catch (error) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}
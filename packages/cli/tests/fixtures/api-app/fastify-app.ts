import Fastify from 'fastify';

const fastify = Fastify();

fastify.get('/ping', async (request, reply) => {
  return 'pong\n';
});

fastify.post('/auth/login', async (request, reply) => {
  return { token: '123' };
});

fastify.route({
  method: 'PUT',
  url: '/auth/update',
  handler: async (request, reply) => {
    return { status: 'updated' };
  }
});

fastify.delete('/old', async (request, reply) => {
  return { deleted: true };
});

const plugin = async (fastRouter: any) => {
  fastRouter.get('/hello', async () => 'hello');
  fastRouter.post('/world', async () => 'world');
};

fastify.register(plugin, { prefix: '/fast-api' });

export default fastify;

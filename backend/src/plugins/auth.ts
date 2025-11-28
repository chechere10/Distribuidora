import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { config } from '../config';

export default fp(async (fastify) => {
  await fastify.register(jwt, { secret: config.jwtSecret });

  fastify.decorate(
    'authenticate',
    async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ message: 'Unauthorized' });
      }
    }
  );
});



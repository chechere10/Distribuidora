import 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate: any;
  }
  
  interface FastifyRequest {
    user?: {
      sub: string;      // userId
      username: string;
      role: string;
    };
  }
}



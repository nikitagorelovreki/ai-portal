import { FastifyInstance } from 'fastify';
import { DatabaseService } from './services/database';

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseService;
  }
}

import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import { healthRoutes } from './routes/health';
import { notionRoutes } from './routes/notion';
import { metricsRoutes } from './routes/metrics';
import { DatabaseService } from './services/database';
import { CronService } from './utils/cron';

dotenv.config();

const server = fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

// Plugins
server.register(cors, {
  origin: true
});
server.register(helmet);

// Routes
server.register(healthRoutes, { prefix: '/ingest/health' });
server.register(notionRoutes, { prefix: '/sync' });
server.register(metricsRoutes, { prefix: '/metrics' });
server.register(metricsRoutes, { prefix: '/advice' });

// Health check
server.get('/healthcheck', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    // Initialize database
    const db = new DatabaseService();
    await db.connect();
    
    // Add database to fastify instance
    server.decorate('db', db);
    
    // Initialize cron jobs
    const cron = new CronService(db);
    cron.start();
    
    await server.listen({ port: 3100, host: '0.0.0.0' });
    console.log('🚀 Server running on http://localhost:3100');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

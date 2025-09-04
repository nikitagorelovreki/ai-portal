import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';

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

// Health check
server.get('/healthcheck', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Test endpoint
server.get('/test', async () => {
  return { message: 'WLNX Health Aggregator API is running!' };
});

// Start server
const start = async () => {
  try {
    await server.listen({ port: 3100, host: '0.0.0.0' });
    console.log('🚀 Server running on http://localhost:3100');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

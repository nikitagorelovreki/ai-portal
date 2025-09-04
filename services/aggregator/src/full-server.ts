import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import { DatabaseService } from './services/database';
import { HealthService } from './services/healthService';
import { AdviceService } from './services/adviceService';

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

// Initialize services
let db: DatabaseService;
let healthService: HealthService;
let adviceService: AdviceService;

// Health check
server.get('/healthcheck', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Test endpoint
server.get('/test', async () => {
  return { message: 'WLNX Health Aggregator API is running!' };
});

// Health routes
server.post('/ingest/health/profile', async (request, reply) => {
  try {
    const { dob, apple_health_uid } = request.body as any;
    const userId = await healthService.updateUserProfile(dob, apple_health_uid);
    return { success: true, user_id: userId };
  } catch (error) {
    server.log.error('Error updating health profile:', error as any);
    return reply.status(500).send({ error: 'Failed to update profile' });
  }
});

server.post('/ingest/health/steps', async (request, reply) => {
  try {
    const { items } = request.body as any;
    await healthService.ingestStepsData(items);
    return { success: true, processed: items.length };
  } catch (error) {
    server.log.error('Error ingesting steps data:', error as any);
    return reply.status(500).send({ error: 'Failed to ingest steps data' });
  }
});

// Metrics routes
server.get('/metrics/daily', async (request, reply) => {
  try {
    const { date } = request.query as any;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const metrics = await adviceService.getDailyMetrics(targetDate);
    return { success: true, ...metrics };
  } catch (error) {
    server.log.error('Error getting daily metrics:', error as any);
    return reply.status(500).send({ error: 'Failed to get daily metrics' });
  }
});

server.get('/advice/today', async (request, reply) => {
  try {
    const advice = await adviceService.getTodayAdvice();
    return { success: true, ...advice };
  } catch (error) {
    server.log.error('Error getting today advice:', error as any);
    return reply.status(500).send({ error: 'Failed to get advice' });
  }
});

// Start server
const start = async () => {
  try {
    // Initialize database
    db = new DatabaseService();
    await db.connect();
    
    // Initialize services
    healthService = new HealthService(db);
    adviceService = new AdviceService(db);
    
    await server.listen({ port: 3100, host: '0.0.0.0' });
    console.log('🚀 Server running on http://localhost:3100');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

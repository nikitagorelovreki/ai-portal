import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AdviceService } from '../services/adviceService';

export async function metricsRoutes(fastify: FastifyInstance) {
  const adviceService = new AdviceService(fastify.db);

  // GET /metrics/daily?date=YYYY-MM-DD
  fastify.get('/daily', async (request: FastifyRequest<{ Querystring: { date?: string } }>, reply: FastifyReply) => {
    try {
      const date = request.query.date || new Date().toISOString().split('T')[0];
      const metrics = await adviceService.getDailyMetrics(date);
      
      return { success: true, ...metrics };
    } catch (error) {
      fastify.log.error('Error getting daily metrics:', error);
      return reply.status(500).send({ error: 'Failed to get daily metrics' });
    }
  });

  // GET /advice/today
  fastify.get('/advice/today', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const advice = await adviceService.getTodayAdvice();
      
      return { success: true, ...advice };
    } catch (error) {
      fastify.log.error('Error getting today advice:', error);
      return reply.status(500).send({ error: 'Failed to get advice' });
    }
  });

  // GET /advice/weekly
  fastify.get('/advice/weekly', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const weeklyPlan = await adviceService.getWeeklyPlan();
      
      return { success: true, ...weeklyPlan };
    } catch (error) {
      fastify.log.error('Error getting weekly plan:', error);
      return reply.status(500).send({ error: 'Failed to get weekly plan' });
    }
  });
}

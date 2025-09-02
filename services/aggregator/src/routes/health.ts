import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { HealthService } from '../services/healthService';

const healthProfileSchema = z.object({
  dob: z.string(),
  apple_health_uid: z.string().optional()
});

const stepsDataSchema = z.object({
  items: z.array(z.object({
    ts: z.string(),
    count_delta: z.number()
  }))
});

export async function healthRoutes(fastify: FastifyInstance) {
  const healthService = new HealthService(fastify.db);

  // POST /ingest/health/profile
  fastify.post('/profile', {
    schema: {
      body: healthProfileSchema
    }
  }, async (request: FastifyRequest<{ Body: z.infer<typeof healthProfileSchema> }>, reply: FastifyReply) => {
    try {
      const { dob, apple_health_uid } = request.body;
      const userId = await healthService.updateUserProfile(dob, apple_health_uid);
      
      return { success: true, user_id: userId };
    } catch (error) {
      fastify.log.error('Error updating health profile:', error);
      return reply.status(500).send({ error: 'Failed to update profile' });
    }
  });

  // POST /ingest/health/steps
  fastify.post('/steps', {
    schema: {
      body: stepsDataSchema
    }
  }, async (request: FastifyRequest<{ Body: z.infer<typeof stepsDataSchema> }>, reply: FastifyReply) => {
    try {
      const { items } = request.body;
      await healthService.ingestStepsData(items);
      
      return { success: true, processed: items.length };
    } catch (error) {
      fastify.log.error('Error ingesting steps data:', error);
      return reply.status(500).send({ error: 'Failed to ingest steps data' });
    }
  });
}

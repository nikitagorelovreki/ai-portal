import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotionService } from '../services/notionService';

export async function notionRoutes(fastify: FastifyInstance) {
  const notionService = new NotionService((fastify as any).db);

  // POST /sync/notion
  fastify.post('/notion', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await notionService.syncNotes();
      
      return { 
        success: true, 
        synced_pages: result.syncedPages,
        parsed_goals: result.parsedGoals.length
      };
    } catch (error) {
      fastify.log.error('Error syncing Notion:', error as any);
      return reply.status(500).send({ error: 'Failed to sync Notion' });
    }
  });

  // GET /sync/notion/status
  fastify.get('/notion/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await notionService.getSyncStatus();
      
      return { 
        success: true, 
        last_sync: status.lastSync,
        total_notes: status.totalNotes,
        active_goals: status.activeGoals
      };
    } catch (error) {
      fastify.log.error('Error getting sync status:', error as any);
      return reply.status(500).send({ error: 'Failed to get sync status' });
    }
  });
}

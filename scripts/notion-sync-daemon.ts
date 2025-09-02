import { SyncManager } from '../src/agents/sync-manager';
import { config } from 'dotenv';

config();

async function main() {
  const syncManager = new SyncManager();
  while (true) {
    try {
      console.log('🚀 Starting Notion to Qdrant sync...');
      await syncManager.syncAllDatabases();
      console.log('✅ Sync completed! Waiting for the next cycle...');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    }
    // Wait for 10 minutes before the next sync
    await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
  }
}

main().catch(console.error); 
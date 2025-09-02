import { SyncManager } from '../src/agents/sync-manager';
import { config } from 'dotenv';

config();

// Force reindex Qdrant collection
async function forceReindex() {
  const QDRANT_URL = process.env.QDRANT_URL;
  const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
  
  if (!QDRANT_URL || !QDRANT_API_KEY) {
    console.error('❌ Missing QDRANT_URL or QDRANT_API_KEY for reindexing');
    return;
  }

  try {
    console.log('🔄 Forcing Qdrant reindex...');
    
    // Use the correct endpoint for collection optimizer config
    const response = await fetch(`${QDRANT_URL}/collections/aiportal-data`, {
      method: 'PATCH',
      headers: {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        optimizer_config: {
          indexing_threshold: 0
        }
      })
    });

    if (response.ok) {
      console.log('✅ Qdrant reindex triggered successfully');
    } else {
      console.error('❌ Failed to trigger Qdrant reindex:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Error triggering Qdrant reindex:', error);
  }
}

async function main() {
  console.log('🚀 Starting Tasks Tracker sync...\n');

  // Check environment variables
  const requiredEnvVars = ['NOTION_API_KEY', 'QDRANT_URL'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      return;
    }
  }

  console.log('✅ Environment variables configured');

  try {
    const syncManager = new SyncManager();
    
    // Get current sync status
    const status = await syncManager.getSyncStatus();
    console.log('\n📊 Current sync status:');
    console.log(`   Last sync: ${status.lastSyncTime}`);
    console.log(`   Processed pages: ${status.processedPages}`);
    console.log(`   Total documents: ${status.totalDocuments}`);
    console.log(`   Total embeddings: ${status.totalEmbeddings}`);

    // Clear sync state to force fresh sync
    console.log('\n🗑️  Clearing sync state to force fresh sync...');
    await syncManager.clearSyncState();

    // Start sync
    console.log('\n🔄 Starting Job Tasks Tracker sync...');
    await syncManager.syncSpecificDatabase('Job Tasks Tracker');

    // Get updated status
    const newStatus = await syncManager.getSyncStatus();
    console.log('\n📊 Updated sync status:');
    console.log(`   Last sync: ${newStatus.lastSyncTime}`);
    console.log(`   Processed pages: ${newStatus.processedPages}`);
    console.log(`   Total documents: ${newStatus.totalDocuments}`);
    console.log(`   Total embeddings: ${newStatus.totalEmbeddings}`);

    // Force reindex Qdrant
    await forceReindex();

    console.log('\n✅ Tasks Tracker sync completed!');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

main(); 
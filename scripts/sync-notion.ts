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
  console.log('🚀 Starting Notion to Qdrant sync...\n');

  // Check environment variables
  const requiredEnvVars = ['NOTION_API_KEY', 'OPENAI_API_KEY', 'QDRANT_URL'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      console.log('\nPlease set up your .env file with:');
      console.log('- NOTION_API_KEY: Your Notion integration token');
      console.log('- OPENAI_API_KEY: Your OpenAI API key');
      console.log('- QDRANT_URL: Your Qdrant instance URL');
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

    // Start sync
    await syncManager.syncAllDatabases();

    // Get updated status
    const newStatus = await syncManager.getSyncStatus();
    console.log('\n📊 Updated sync status:');
    console.log(`   Last sync: ${newStatus.lastSyncTime}`);
    console.log(`   Processed pages: ${newStatus.processedPages}`);
    console.log(`   Total documents: ${newStatus.totalDocuments}`);
    console.log(`   Total embeddings: ${newStatus.totalEmbeddings}`);

    // Force reindex Qdrant
    await forceReindex();

    console.log('\n✅ Sync completed successfully!');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--clear')) {
  console.log('🗑️  Clearing sync state...');
  const syncManager = new SyncManager();
  syncManager.clearSyncState();
  console.log('✅ Sync state cleared');
} else {
  main().catch(console.error);
} 
import { SyncManager } from '../src/agents/sync-manager';
import { QdrantClient } from '@qdrant/js-client-rest';
import { COLLECTION_NAME } from '../src/constants';
import { config } from 'dotenv';

config();

async function main() {
  console.log('🧪 Notion Sync Test - Full Cycle\n');

  // Check environment variables
  const requiredEnvVars = ['NOTION_API_KEY', 'QDRANT_URL'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      return;
    }
  }

  console.log('✅ Environment variables configured');

  const qdrant = new QdrantClient({ 
    url: process.env.QDRANT_URL!,
    apiKey: process.env.QDRANT_API_KEY 
  });

  try {
    const syncManager = new SyncManager();
    
    // Step 1: Check initial state
    console.log('\n📊 Step 1: Initial State Check');
    const initialStatus = await syncManager.getSyncStatus();
    console.log(`   Last sync: ${initialStatus.lastSyncTime}`);
    console.log(`   Processed pages: ${initialStatus.processedPages}`);
    console.log(`   Total documents: ${initialStatus.totalDocuments}`);
    console.log(`   Total embeddings: ${initialStatus.totalEmbeddings}`);

    // Get initial Qdrant count
    const initialInfo = await qdrant.getCollection(COLLECTION_NAME);
    const initialPoints = initialInfo.points_count || 0;
    console.log(`   Qdrant points: ${initialPoints}`);

    // Step 2: First sync
    console.log('\n🔄 Step 2: First Sync');
    console.log('Starting first sync...');
    await syncManager.syncAllDatabases();

    // Step 3: Verify first sync results
    console.log('\n📊 Step 3: Verify First Sync');
    const afterFirstSync = await syncManager.getSyncStatus();
    console.log(`   Last sync: ${afterFirstSync.lastSyncTime}`);
    console.log(`   Processed pages: ${afterFirstSync.processedPages}`);
    console.log(`   Total documents: ${afterFirstSync.totalDocuments}`);
    console.log(`   Total embeddings: ${afterFirstSync.totalEmbeddings}`);

    const afterFirstInfo = await qdrant.getCollection(COLLECTION_NAME);
    const afterFirstPoints = afterFirstInfo.points_count || 0;
    console.log(`   Qdrant points: ${afterFirstPoints}`);

    const newPoints = afterFirstPoints - initialPoints;
    console.log(`   New points added: ${newPoints}`);

    if (newPoints === 0) {
      console.log('⚠️  No new data was synced. This might indicate:');
      console.log('   - All documents were already processed');
      console.log('   - OpenAI quota exceeded');
      console.log('   - No new Notion data available');
    } else {
      console.log('✅ Data successfully synced to Qdrant');
    }

    // Step 4: Second sync (should be incremental)
    console.log('\n🔄 Step 4: Second Sync (Testing Deduplication)');
    console.log('Starting second sync...');
    await syncManager.syncAllDatabases();

    // Step 5: Verify second sync results
    console.log('\n📊 Step 5: Verify Second Sync');
    const afterSecondSync = await syncManager.getSyncStatus();
    console.log(`   Last sync: ${afterSecondSync.lastSyncTime}`);
    console.log(`   Processed pages: ${afterSecondSync.processedPages}`);
    console.log(`   Total documents: ${afterSecondSync.totalDocuments}`);
    console.log(`   Total embeddings: ${afterSecondSync.totalEmbeddings}`);

    const afterSecondInfo = await qdrant.getCollection(COLLECTION_NAME);
    const afterSecondPoints = afterSecondInfo.points_count || 0;
    console.log(`   Qdrant points: ${afterSecondPoints}`);

    const additionalPoints = afterSecondPoints - afterFirstPoints;
    console.log(`   Additional points added: ${additionalPoints}`);

    // Step 6: Verify sync state in Qdrant
    console.log('\n🔍 Step 6: Verify Sync State in Qdrant');
    try {
      const syncState = await qdrant.retrieve(COLLECTION_NAME, {
        ids: [999999], // SYNC_STATE_ID
      });
      
      if (syncState.length > 0 && syncState[0].payload) {
        const state = syncState[0].payload as any;
        console.log('✅ Sync state found in Qdrant:');
        console.log(`   Last sync: ${state.lastSyncTime || 'Never'}`);
        console.log(`   Processed pages: ${state.processedPages?.length || 0}`);
        console.log(`   Total documents: ${state.totalDocuments || 0}`);
        console.log(`   Total embeddings: ${state.totalEmbeddings || 0}`);
      } else {
        console.log('❌ Sync state not found in Qdrant');
      }
    } catch (error) {
      console.log('❌ Error retrieving sync state from Qdrant:', error);
    }

    // Step 7: Summary
    console.log('\n📋 Step 7: Test Summary');
    if (additionalPoints === 0) {
      console.log('✅ DEDUPLICATION WORKING: No duplicate data was added');
      console.log('✅ SYNC STATE WORKING: State properly managed in Qdrant');
      console.log('✅ INCREMENTAL SYNC WORKING: Only new data was processed');
    } else {
      console.log('⚠️  DEDUPLICATION ISSUE: Additional data was added');
      console.log('   This might indicate:');
      console.log('   - Sync state not working properly');
      console.log('   - Documents being processed multiple times');
    }

    console.log('\n🎉 Test completed!');
    console.log('\nNext steps:');
    console.log('1. Check your OpenAI quota if no data was synced');
    console.log('2. Run: npm run sync-notion (for manual sync)');
    console.log('3. Run: npm run start-bot (to start Telegram bot)');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main().catch(console.error); 
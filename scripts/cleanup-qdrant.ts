import { QdrantClient } from '@qdrant/js-client-rest';
import { COLLECTION_NAME, SYNC_STATE_ID } from '../src/constants';
import { config } from 'dotenv';

config();

async function main() {
  console.log('🧹 Qdrant Cleanup Script\n');

  // Check environment variables
  if (!process.env.QDRANT_URL) {
    console.error('❌ Missing QDRANT_URL environment variable');
    return;
  }

  const qdrant = new QdrantClient({ 
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY 
  });

  // Parse command line arguments
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  const action = args[0]?.startsWith('--') ? args[0] : `--${args[0]}`;

  try {
    switch (action) {
      case '--status':
        await showStatus(qdrant);
        break;
      
      case '--clear-sync-state':
        await clearSyncState(qdrant);
        break;
      
      case '--delete-document':
        const docId = args[1];
        if (!docId) {
          console.error('❌ Please provide document ID: npm run cleanup-qdrant --delete-document <doc-id>');
          return;
        }
        await deleteDocument(qdrant, docId);
        break;
      
      case '--clear-all':
        await clearAllData(qdrant);
        break;
      
      case '--delete-collection':
        await deleteCollection(qdrant);
        break;
      
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

async function showStatus(qdrant: QdrantClient) {
  console.log('📊 Collection Status:\n');
  
  try {
    // Get collection info
    const collections = await qdrant.getCollections();
    const collection = collections.collections.find(c => c.name === COLLECTION_NAME);
    
    if (!collection) {
      console.log('❌ Collection does not exist');
      return;
    }

    console.log(`📦 Collection: ${COLLECTION_NAME}`);
    
    // Get detailed collection info
    const info = await qdrant.getCollection(COLLECTION_NAME);
    console.log(`📊 Points count: ${info.points_count || 0}`);
    console.log(`💾 Vectors count: ${info.vectors_count || 0}`);
    console.log(`📈 Vector size: ${info.config?.params?.vectors?.size || 'Unknown'}`);
    console.log(`📏 Distance: ${info.config?.params?.vectors?.distance || 'Unknown'}`);

    // Get sync state
    try {
      const syncState = await qdrant.retrieve(COLLECTION_NAME, {
        ids: [SYNC_STATE_ID],
      });
      
      if (syncState.length > 0 && syncState[0].payload) {
        const state = syncState[0].payload as any;
        console.log('\n🔄 Sync State:');
        console.log(`   Last sync: ${state.lastSyncTime || 'Never'}`);
        console.log(`   Processed pages: ${state.processedPages?.length || 0}`);
        console.log(`   Total documents: ${state.totalDocuments || 0}`);
        console.log(`   Total embeddings: ${state.totalEmbeddings || 0}`);
      } else {
        console.log('\n🔄 Sync State: Not found');
      }
    } catch (error) {
      console.log('\n🔄 Sync State: Error retrieving');
    }

  } catch (error) {
    console.error('❌ Error getting status:', error);
  }
}

async function clearSyncState(qdrant: QdrantClient) {
  console.log('🗑️  Clearing sync state...\n');
  
  try {
    // Check if sync state exists
    const syncState = await qdrant.retrieve(COLLECTION_NAME, {
      ids: [SYNC_STATE_ID],
    });
    
    if (syncState.length === 0) {
      console.log('📭 Sync state does not exist (already cleared)');
      return;
    }
    
    // Delete sync state document using the correct API format
    await qdrant.delete(COLLECTION_NAME, {
      points: [SYNC_STATE_ID],
    });
    
    console.log('✅ Sync state cleared');
    console.log('📝 Next sync will process all documents from scratch');
  } catch (error) {
    console.error('❌ Error clearing sync state:', error);
    console.log('💡 Trying alternative approach...');
    
    // Alternative: Try to upsert an empty sync state
    try {
      await qdrant.upsert(COLLECTION_NAME, {
        points: [{
          id: SYNC_STATE_ID,
          vector: new Array(1536).fill(0),
          payload: {
            lastSyncTime: new Date(0).toISOString(),
            processedPages: [],
            totalDocuments: 0,
            totalEmbeddings: 0,
          },
        }],
      });
      console.log('✅ Sync state reset to empty');
    } catch (upsertError) {
      console.error('❌ Failed to reset sync state:', upsertError);
    }
  }
}

async function deleteDocument(qdrant: QdrantClient, docId: string) {
  console.log(`🗑️  Deleting document: ${docId}...\n`);
  
  try {
    await qdrant.delete(COLLECTION_NAME, {
      points: [docId],
    });
    
    console.log('✅ Document deleted');
  } catch (error) {
    console.error('❌ Error deleting document:', error);
  }
}

async function clearAllData(qdrant: QdrantClient) {
  console.log('🗑️  Clearing all data from collection...\n');
  
  try {
    // Get all points
    const response = await qdrant.scroll(COLLECTION_NAME, {
      limit: 1000,
      with_payload: true,
      with_vector: false,
    });
    
    if (response.points.length === 0) {
      console.log('📭 Collection is already empty');
      return;
    }
    
    const pointIds = response.points.map(p => p.id);
    console.log(`🗑️  Deleting ${pointIds.length} documents...`);
    
    await qdrant.delete(COLLECTION_NAME, {
      points: pointIds,
    });
    
    console.log('✅ All data cleared');
    console.log('📝 Collection structure remains intact');
    console.log('🔄 Sync state will be recreated on next sync');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  }
}

async function deleteCollection(qdrant: QdrantClient) {
  console.log('🗑️  Deleting entire collection...\n');
  
  try {
    await qdrant.deleteCollection(COLLECTION_NAME);
    console.log('✅ Collection deleted');
    console.log('📝 Collection will be recreated on next sync');
  } catch (error) {
    console.error('❌ Error deleting collection:', error);
  }
}

function showHelp() {
  console.log('🧹 Qdrant Cleanup Script\n');
  console.log('Usage: npm run cleanup-qdrant <action> [options]\n');
  console.log('Actions:');
  console.log('  --status              Show collection status and sync state');
  console.log('  --clear-sync-state    Clear sync state (will re-process all documents)');
  console.log('  --delete-document <id> Delete specific document by ID');
  console.log('  --clear-all           Clear all data but keep collection structure');
  console.log('  --delete-collection   Delete entire collection');
  console.log('\nExamples:');
  console.log('  npm run cleanup-qdrant --status');
  console.log('  npm run cleanup-qdrant --clear-sync-state');
  console.log('  npm run cleanup-qdrant --delete-document abc123');
  console.log('  npm run cleanup-qdrant --clear-all');
  console.log('  npm run cleanup-qdrant --delete-collection');
}

main().catch(console.error); 
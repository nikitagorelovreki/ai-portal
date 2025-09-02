import { QdrantClient } from '@qdrant/js-client-rest';
import { COLLECTION_NAME } from '../src/constants';
import { config } from 'dotenv';

config();

async function clearQdrant() {
  console.log('🗑️  Clearing Qdrant collection...');

  const QDRANT_URL = process.env.QDRANT_URL;
  const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
  
  if (!QDRANT_URL || !QDRANT_API_KEY) {
    console.error('❌ Missing QDRANT_URL or QDRANT_API_KEY');
    return;
  }

  try {
    const qdrant = new QdrantClient({ 
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY 
    });

    // Check if collection exists
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      console.log('❌ Collection does not exist');
      return;
    }

    // Delete the entire collection
    console.log('🗑️  Deleting entire collection...');
    await qdrant.deleteCollection(COLLECTION_NAME);

    console.log('✅ Successfully deleted Qdrant collection');

  } catch (error) {
    console.error('❌ Error clearing Qdrant:', error);
  }
}

clearQdrant(); 
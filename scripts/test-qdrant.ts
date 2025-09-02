import * as dotenv from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';

// Load environment variables
dotenv.config();

console.log('🧪 Testing Qdrant Integration...');

async function testQdrantConnection() {
  // Check environment variables
  console.log('🔍 Checking environment variables...');
  console.log(`QDRANT_URL: ${process.env.QDRANT_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`QDRANT_API_KEY: ${process.env.QDRANT_API_KEY ? '✅ Set' : '❌ Not set'}`);
  
  if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
    console.error('❌ Missing required environment variables');
    return;
  }

  try {
    // Initialize Qdrant client
    console.log('\n🔌 Initializing Qdrant client...');
    const qdrant = new QdrantClient({ 
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY 
    });

    // Test connection by getting collections
    console.log('📡 Testing connection...');
    const collections = await qdrant.getCollections();
    console.log('✅ Successfully connected to Qdrant!');
    console.log(`📊 Found ${collections.collections.length} collections:`);
    
    for (const collection of collections.collections) {
      console.log(`  - ${collection.name}`);
    }

    // Test collection operations
    const testCollectionName = 'test-collection';
    console.log(`\n🧪 Testing collection operations with '${testCollectionName}'...`);
    
    // Check if test collection exists
    const collectionExists = collections.collections.some(c => c.name === testCollectionName);
    
    if (collectionExists) {
      console.log('🗑️  Removing existing test collection...');
      await qdrant.deleteCollection(testCollectionName);
    }

    // Create test collection
    console.log('➕ Creating test collection...');
    await qdrant.createCollection(testCollectionName, {
      vectors: {
        size: 1536,
        distance: 'Cosine',
      },
    });
    console.log('✅ Test collection created successfully');

    // Insert test data
    console.log('📝 Inserting test data...');
    const testPoint = {
      id: 1, // Use integer ID instead of string
      vector: new Array(1536).fill(0.1), // Simple test vector
      payload: { test: 'data', timestamp: new Date().toISOString() }
    };
    
    await qdrant.upsert(testCollectionName, { points: [testPoint] });
    console.log('✅ Test data inserted successfully');

    // Search test data
    console.log('🔍 Testing search functionality...');
    const searchResult = await qdrant.search(testCollectionName, {
      vector: new Array(1536).fill(0.1),
      limit: 1,
    });
    console.log('✅ Search functionality working');
    console.log(`📊 Found ${searchResult.length} results`);

    // Clean up
    console.log('🧹 Cleaning up test collection...');
    await qdrant.deleteCollection(testCollectionName);
    console.log('✅ Test collection deleted');

    console.log('\n🎉 All Qdrant integration tests passed!');
    
  } catch (error) {
    console.error('❌ Qdrant integration test failed:', error);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('1. Check your QDRANT_URL is correct');
    console.error('2. Verify your QDRANT_API_KEY is valid');
    console.error('3. Ensure your Qdrant instance is accessible');
    console.error('4. Check if your API key has the necessary permissions');
  }
}

testQdrantConnection().catch(err => {
  console.error('❌ Unexpected error:', err);
}); 
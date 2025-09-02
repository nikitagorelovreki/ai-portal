import { config } from 'dotenv';
import { searchQdrant } from '../src/agents/notion-agent';
import { OllamaClient } from '../src/llm/ollama-client';

config();

async function testTelegramPipeline() {
  console.log('🧪 Testing Telegram Bot Pipeline...\n');

  // Check environment variables
  const requiredEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_ALLOWED_CHAT_ID',
    'QDRANT_URL'
  ];

  console.log('📋 Checking environment variables...');
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing: ${envVar}`);
      return;
    }
    console.log(`✅ ${envVar}: ${envVar.includes('KEY') ? '***' : process.env[envVar]}`);
  }

  // Ollama configuration
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3:mini';
  const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'phi3:mini';

  console.log(`✅ Ollama URL: ${OLLAMA_URL}`);
  console.log(`✅ Ollama Model: ${OLLAMA_MODEL}`);
  console.log(`✅ Ollama Embed Model: ${OLLAMA_EMBED_MODEL}`);

  // Test Ollama embedding
  console.log('\n🤖 Testing Ollama embedding...');
  try {
    const testQuery = 'What is artificial intelligence?';
    
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_EMBED_MODEL,
        prompt: testQuery,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Ollama embedding working');
    console.log(`   Vector length: ${data.embedding.length}`);
  } catch (error) {
    console.error('❌ Ollama embedding error:', error);
    return;
  }

  // Test Qdrant connection
  console.log('\n🔍 Testing Qdrant connection...');
  try {
    // Use the actual embedding from Ollama to test Qdrant
    const testQuery = 'test query';
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_EMBED_MODEL,
        prompt: testQuery,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const testVector = data.embedding;
    
    const results = await searchQdrant(testVector, 3);
    console.log('✅ Qdrant search working');
    console.log(`   Found ${results.length} results`);
  } catch (error) {
    console.error('❌ Qdrant error:', error);
    return;
  }

  // Test Ollama response generation
  console.log('\n💬 Testing Ollama response generation...');
  try {
    const ollama = new OllamaClient(OLLAMA_URL, OLLAMA_MODEL);
    const response = await ollama.generateResponse('Hello', 'Test context');
    
    console.log('✅ Ollama response working');
    console.log(`   Response: ${response.substring(0, 100)}...`);
  } catch (error) {
    console.error('❌ Ollama response error:', error);
    return;
  }

  console.log('\n🎉 All tests passed! Your Telegram bot should work correctly.');
  console.log('\nTo start the bot, run: npm run start-bot');
}

testTelegramPipeline().catch(console.error); 
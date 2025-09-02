import { OllamaClient } from '../src/llm/ollama-client';
import { config } from 'dotenv';

config();

async function main() {
  console.log('🔧 Ollama Setup and Test\n');

  const ollama = new OllamaClient();

  // Test connection
  console.log('🔍 Testing Ollama connection...');
  const isConnected = await ollama.testConnection();
  
  if (!isConnected) {
    console.log('❌ Ollama is not running or not accessible');
    console.log('\n📋 Setup Instructions:');
    console.log('1. Install Ollama: https://ollama.ai/download');
    console.log('2. Start Ollama: ollama serve');
    console.log('3. Pull a model: ollama pull llama2');
    console.log('4. Run this test again');
    return;
  }

  console.log('✅ Ollama is running');

  // Get available models
  console.log('\n📚 Checking available models...');
  const models = await ollama.getAvailableModels();
  
  if (models.length === 0) {
    console.log('❌ No models found');
    console.log('\n📋 To install a model, run:');
    console.log('   ollama pull llama2');
    console.log('   ollama pull mistral');
    console.log('   ollama pull codellama');
    return;
  }

  console.log('✅ Available models:');
  models.forEach(model => console.log(`   - ${model}`));

  // Test text generation
  console.log('\n🧪 Testing text generation...');
  try {
    const response = await ollama.generateResponse(
      'What is artificial intelligence?',
      'AI is a field of computer science that focuses on creating intelligent machines.'
    );
    console.log('✅ Text generation working');
    console.log(`   Sample response: ${response.substring(0, 100)}...`);
  } catch (error) {
    console.error('❌ Text generation failed:', error);
  }

  // Test embedding
  console.log('\n🔢 Testing embedding generation...');
  try {
    const response = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama2',
        prompt: 'Test embedding',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Embedding generation working');
      console.log(`   Vector size: ${data.embedding.length}`);
    } else {
      console.log('❌ Embedding generation failed');
    }
  } catch (error) {
    console.error('❌ Embedding test failed:', error);
  }

  console.log('\n🎉 Ollama setup complete!');
  console.log('\nNext steps:');
  console.log('1. Run: npm run sync-notion-test (to test full sync)');
  console.log('2. Run: npm run start-bot (to start Telegram bot)');
}

main().catch(console.error); 
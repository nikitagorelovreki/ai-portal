import { config } from 'dotenv';
import { searchQdrant } from '../src/agents/notion-agent';

config();

async function testBasicPipeline() {
  console.log('🧪 Testing Basic Telegram Bot Pipeline...\n');

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

  // Test Qdrant connection
  console.log('\n🔍 Testing Qdrant connection...');
  try {
    const testVector = new Array(1536).fill(0.1);
    const results = await searchQdrant(testVector, 3);
    console.log('✅ Qdrant search working');
    console.log(`   Found ${results.length} results`);
    
    if (results.length > 0) {
      const content = results[0].payload?.content;
      if (typeof content === 'string') {
        console.log('   Sample result:', content.substring(0, 100) + '...');
      }
    }
  } catch (error) {
    console.error('❌ Qdrant error:', error);
    return;
  }

  // Test Telegram bot token format
  console.log('\n🤖 Testing Telegram bot token format...');
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  if (token.includes(':') && token.length > 20) {
    console.log('✅ Telegram bot token format looks correct');
  } else {
    console.error('❌ Telegram bot token format seems incorrect');
    return;
  }

  // Test chat ID format
  console.log('\n💬 Testing chat ID format...');
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID!;
  if (chatId.startsWith('-')) {
    console.log('✅ Chat ID format looks correct (channel/group)');
  } else {
    console.log('✅ Chat ID format looks correct (private chat)');
  }

  console.log('\n🎉 Basic tests passed! Your bot should work with proper OpenAI credits.');
  console.log('\nTo start the bot, run: npm run start-bot');
  console.log('\nNote: You need OpenAI credits to generate responses.');
}

testBasicPipeline().catch(console.error); 
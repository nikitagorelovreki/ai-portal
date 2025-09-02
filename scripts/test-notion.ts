import * as dotenv from 'dotenv';
import { Client } from '@notionhq/client';

// Load environment variables
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function testNotionAPI() {
  console.log('🔍 Testing Notion API connection...');
      console.log('🔑 Token format:', (process.env.NOTION_API_KEY || '').substring(0, 10) + '...');
  
  try {
    // Try a simple user info request first
    console.log('👤 Testing user info...');
    const user = await notion.users.me({});
    console.log('✅ User info retrieved:', user.name);
    
    // Try to list databases
    console.log('📚 Testing database search...');
    const response = await notion.search({
      filter: { property: 'object', value: 'database' },
      page_size: 10,
    });
    
    console.log('✅ Found databases:', response.results.length);
    for (const db of response.results) {
      if ('title' in db && db.title?.[0]?.plain_text) {
        console.log(`  - ${db.title[0].plain_text} (${db.id})`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ API Error:', error.message);
    console.error('   Status:', error.status);
    console.error('   Code:', error.code);
    
    if (error.code === 'unauthorized') {
      console.log('\n💡 Suggestions:');
      console.log('1. Make sure the integration is added to your workspace');
      console.log('2. Check if this is a Personal workspace integration');
      console.log('3. Try creating a new integration for a different workspace');
    }
  }
}

testNotionAPI().catch(console.error); 
import { searchQdrant } from '../src/agents/notion-agent';
import { config } from 'dotenv';

config();

async function debugSearch() {
  console.log('🔍 Debugging search...\n');

  // Test environment variables
  console.log('Environment variables:');
  console.log('QDRANT_URL:', process.env.QDRANT_URL ? 'SET' : 'NOT SET');
  console.log('QDRANT_API_KEY:', process.env.QDRANT_API_KEY ? 'SET' : 'NOT SET');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
  console.log('');

  const query = 'how much tasks are in job tasks tracker';
  console.log(`Testing query: "${query}"`);

  try {
    const results = await searchQdrant(query, 100);
    console.log(`Total results: ${results.length}`);
    
    const taskResults = results.filter(r => r.id !== 999999);
    console.log(`Task results (excluding sync state): ${taskResults.length}`);
    
    console.log('\nFirst 5 task titles:');
    taskResults.slice(0, 5).forEach((r, i) => {
      const payload = r.payload as any;
      const title = payload?.title || payload?.['Task name']?.title?.[0]?.plain_text || 'No title';
      console.log(`${i + 1}. ${title} (score: ${r.score.toFixed(3)})`);
    });

    if (taskResults.length < 25) {
      console.log(`\n⚠️  Only found ${taskResults.length} tasks, expected 25`);
    } else {
      console.log(`\n✅ Found ${taskResults.length} tasks`);
    }

  } catch (error) {
    console.error('Error during search:', error);
  }
}

debugSearch(); 
import { searchQdrant } from '../src/agents/notion-agent';
import { config } from 'dotenv';

config();

async function testSearchCount() {
  console.log('🔍 Testing search count...\n');

  const queries = [
    'how much tasks are in job tasks tracker',
    'job tasks tracker',
    'tasks',
    'job',
    'tracker',
    ''
  ];

  for (const query of queries) {
    try {
      console.log(`Query: "${query}"`);
      const results = await searchQdrant(query, 100);
      const taskResults = results.filter(r => r.id !== 999999);
      console.log(`Found ${taskResults.length} tasks\n`);
    } catch (error) {
      console.error(`Error with query "${query}":`, error);
    }
  }
}

testSearchCount(); 
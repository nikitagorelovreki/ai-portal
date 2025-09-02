import { searchQdrant } from '../src/agents/notion-agent';
import { config } from 'dotenv';

config();

async function testSearch() {
  console.log('🔍 Testing Qdrant search...\n');

  // Test 1: Search for "task" (generic term)
  console.log('Test 1: Searching for "task"');
  const results1 = await searchQdrant('task', 50);
  console.log(`Found ${results1.length} results for "task"\n`);

  // Test 2: Search for "job" (generic term)
  console.log('Test 2: Searching for "job"');
  const results2 = await searchQdrant('job', 50);
  console.log(`Found ${results2.length} results for "job"\n`);

  // Test 3: Search for "how much tasks" (the actual query)
  console.log('Test 3: Searching for "how much tasks"');
  const results3 = await searchQdrant('how much tasks', 50);
  console.log(`Found ${results3.length} results for "how much tasks"\n`);

  // Test 4: Search for empty string (should return all)
  console.log('Test 4: Searching for empty string (all documents)');
  const results4 = await searchQdrant('', 50);
  console.log(`Found ${results4.length} results for empty string\n`);

  // Show first few results from each test
  console.log('=== Sample Results ===');
  
  console.log('\nResults for "task":');
  results1.slice(0, 3).forEach((r, i) => {
    console.log(`${i + 1}. Score: ${r.score.toFixed(3)}, ID: ${r.id}`);
    const payload = r.payload as any;
    console.log(`   Payload keys: ${Object.keys(payload).join(', ')}`);
    
    // Try different ways to extract title
    const title1 = payload?.title?.title?.[0]?.plain_text;
    const title2 = payload?.name;
    const title3 = payload?.Task?.title?.[0]?.plain_text;
    const title4 = payload?.['Task name']?.title?.[0]?.plain_text;
    
    console.log(`   Title (method 1): ${title1 || 'null'}`);
    console.log(`   Title (method 2): ${title2 || 'null'}`);
    console.log(`   Title (method 3): ${title3 || 'null'}`);
    console.log(`   Title (method 4): ${title4 || 'null'}`);
    
    // Show first few payload entries
    const entries = Object.entries(payload).slice(0, 3);
    entries.forEach(([key, value]) => {
      console.log(`   ${key}: ${JSON.stringify(value).substring(0, 100)}`);
    });
    console.log('');
  });

  console.log('\nResults for "job":');
  results2.slice(0, 3).forEach((r, i) => {
    console.log(`${i + 1}. Score: ${r.score.toFixed(3)}, ID: ${r.id}`);
    const payload = r.payload as any;
    console.log(`   Payload keys: ${Object.keys(payload).join(', ')}`);
    
    // Try different ways to extract title
    const title1 = payload?.title?.title?.[0]?.plain_text;
    const title2 = payload?.name;
    const title3 = payload?.Task?.title?.[0]?.plain_text;
    const title4 = payload?.['Task name']?.title?.[0]?.plain_text;
    
    console.log(`   Title (method 1): ${title1 || 'null'}`);
    console.log(`   Title (method 2): ${title2 || 'null'}`);
    console.log(`   Title (method 3): ${title3 || 'null'}`);
    console.log(`   Title (method 4): ${title4 || 'null'}`);
    
    // Show first few payload entries
    const entries = Object.entries(payload).slice(0, 3);
    entries.forEach(([key, value]) => {
      console.log(`   ${key}: ${JSON.stringify(value).substring(0, 100)}`);
    });
    console.log('');
  });

  console.log('\nResults for "how much tasks":');
  results3.slice(0, 3).forEach((r, i) => {
    console.log(`${i + 1}. Score: ${r.score.toFixed(3)}, ID: ${r.id}`);
    const payload = r.payload as any;
    console.log(`   Payload keys: ${Object.keys(payload).join(', ')}`);
    
    // Try different ways to extract title
    const title1 = payload?.title?.title?.[0]?.plain_text;
    const title2 = payload?.name;
    const title3 = payload?.Task?.title?.[0]?.plain_text;
    const title4 = payload?.['Task name']?.title?.[0]?.plain_text;
    
    console.log(`   Title (method 1): ${title1 || 'null'}`);
    console.log(`   Title (method 2): ${title2 || 'null'}`);
    console.log(`   Title (method 3): ${title3 || 'null'}`);
    console.log(`   Title (method 4): ${title4 || 'null'}`);
    
    // Show first few payload entries
    const entries = Object.entries(payload).slice(0, 3);
    entries.forEach(([key, value]) => {
      console.log(`   ${key}: ${JSON.stringify(value).substring(0, 100)}`);
    });
    console.log('');
  });

  console.log('\nResults for empty string:');
  results4.slice(0, 3).forEach((r, i) => {
    console.log(`${i + 1}. Score: ${r.score.toFixed(3)}, ID: ${r.id}`);
    const payload = r.payload as any;
    console.log(`   Payload keys: ${Object.keys(payload).join(', ')}`);
    
    // Try different ways to extract title
    const title1 = payload?.title?.title?.[0]?.plain_text;
    const title2 = payload?.name;
    const title3 = payload?.Task?.title?.[0]?.plain_text;
    const title4 = payload?.['Task name']?.title?.[0]?.plain_text;
    
    console.log(`   Title (method 1): ${title1 || 'null'}`);
    console.log(`   Title (method 2): ${title2 || 'null'}`);
    console.log(`   Title (method 3): ${title3 || 'null'}`);
    console.log(`   Title (method 4): ${title4 || 'null'}`);
    
    // Show first few payload entries
    const entries = Object.entries(payload).slice(0, 3);
    entries.forEach(([key, value]) => {
      console.log(`   ${key}: ${JSON.stringify(value).substring(0, 100)}`);
    });
    console.log('');
  });
}

testSearch().catch(console.error); 
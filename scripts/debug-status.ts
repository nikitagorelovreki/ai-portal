import { searchQdrant } from '../src/agents/notion-agent';
import { config } from 'dotenv';

config();

async function debugStatus() {
  console.log('🔍 Debugging status values in database...\n');

  try {
    // Search for all tasks
    const results = await searchQdrant("", 100);
    
    console.log(`Total results: ${results.length}`);
    
    // Extract all status values
    const statusValues = new Set<string>();
    const tasks = results.filter(r => r.id !== 999999);
    
    console.log(`\n📋 Found ${tasks.length} tasks:`);
    
    for (const task of tasks) {
      const payload = task.payload as any;
      let status = 'Unknown';
      let title = 'Unknown';
      
      // Extract title
      if (payload.title) {
        title = payload.title;
      } else if (payload['Task name']?.title?.[0]?.plain_text) {
        title = payload['Task name'].title[0].plain_text;
      }
      
      // Extract status
      if (payload.Status?.status?.name) {
        status = payload.Status.status.name;
      } else if (payload.status?.status?.name) {
        status = payload.status.status.name;
      } else if (payload.Status) {
        status = JSON.stringify(payload.Status);
      }
      
      statusValues.add(status);
      console.log(`- "${title}" → Status: "${status}"`);
    }
    
    console.log(`\n📊 Unique status values found:`);
    statusValues.forEach(status => {
      console.log(`- "${status}"`);
    });
    
    // Check for "in progress" variations
    const inProgressTasks = tasks.filter(task => {
      const payload = task.payload as any;
      const status = payload.Status?.status?.name || payload.status?.status?.name || '';
      return status.toLowerCase().includes('progress') || 
             status.toLowerCase().includes('в процессе') ||
             status.toLowerCase().includes('in progress');
    });
    
    console.log(`\n🔄 Tasks that might be "in progress": ${inProgressTasks.length}`);
    inProgressTasks.forEach(task => {
      const payload = task.payload as any;
      const title = payload.title || payload['Task name']?.title?.[0]?.plain_text || 'Unknown';
      const status = payload.Status?.status?.name || payload.status?.status?.name || 'Unknown';
      console.log(`- "${title}" → Status: "${status}"`);
    });

  } catch (error) {
    console.error('Error during debug:', error);
  }
}

debugStatus(); 
import * as dotenv from 'dotenv';
import { Client } from '@notionhq/client';

// Load environment variables
dotenv.config();

console.log('🚀 Script starting...');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function main() {
  console.log('🔍 Starting to fetch databases...');
  console.log('🔑 Checking if NOTION_API_KEY is set...');
  
  if (!process.env.NOTION_API_KEY) {
    console.error('❌ NOTION_API_KEY is not set in environment variables');
    return;
  }
  
  console.log('✅ NOTION_API_KEY is set');
  
  try {
    console.log('🔍 Searching for databases...');
    const response = await notion.search({
      filter: { property: 'object', value: 'database' },
      page_size: 100,
    });
    
    const databases = response.results;
    console.log(`🔍 Found databases: ${databases.length}\n`);
    
    for (const db of databases) {
      if ('id' in db && db.object === 'database') {
        const database = db as any;
        const titleProperty = database.title?.[0]?.plain_text || '(no title)';
        console.log(`📘 Database: ${titleProperty} (${db.id})`);
        
        // Fetch pages from this database
        try {
          const pages = await notion.databases.query({ 
            database_id: db.id,
            page_size: 100 
          });
          console.log(`→ Retrieved pages: ${pages.results.length}\n`);
          
          for (const page of pages.results) {
            if ('id' in page && page.object === 'page') {
              const pageData = page as any;
              // Extract title from various possible property names
              let title = '(no title)';
              const titleProperties = ['Name', 'Title', 'Page', 'Page Name'];
              
              for (const propName of titleProperties) {
                const property = pageData.properties[propName];
                if (property) {
                  if (property.type === 'title' && property.title?.[0]?.plain_text) {
                    title = property.title[0].plain_text;
                    break;
                  }
                  if (property.type === 'rich_text' && property.rich_text?.[0]?.plain_text) {
                    title = property.rich_text[0].plain_text;
                    break;
                  }
                }
              }
              
              console.log(`- ${title} (${page.id})`);
            }
          }
          console.log('\n---\n');
        } catch (error) {
          console.error(`❌ Error fetching pages from database ${db.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in main function:', error);
    return;
  }
}

main().catch(err => {
  console.error('❌ Error during execution:', err);
});
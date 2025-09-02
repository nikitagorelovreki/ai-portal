import { Client } from '@notionhq/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Document } from '../types';
import { embedDocuments, EmbeddedDocument } from '../embed/openai-embedder';
import { SyncStateManager } from './sync-state';
import { COLLECTION_NAME, VECTOR_SIZE, VECTOR_DISTANCE } from '../constants';
import { config } from 'dotenv';

config();

// Initialize clients
const notion = new Client({ auth: process.env.NOTION_API_KEY || '' });
const qdrant = new QdrantClient({ 
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY 
});

interface NotionDatabase {
  id: string;
  title: string;
}

interface NotionPage {
  id: string;
  properties: Record<string, any>;
  created_time: string;
  last_edited_time: string;
}

export class SyncManager {
  private stateManager: SyncStateManager;

  constructor() {
    this.stateManager = new SyncStateManager(qdrant, COLLECTION_NAME);
  }

  private async ensureQdrantCollection() {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some((c: any) => c.name === COLLECTION_NAME);

    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: VECTOR_DISTANCE,
        },
      });
    }
  }

  async syncAllDatabases() {
    console.log('🚀 Starting full sync...');
    
    await this.ensureQdrantCollection();
    
    const databases = await this.fetchAllDatabases();
    console.log(`📚 Found ${databases.length} databases`);

    let totalNewDocuments = 0;
    let totalNewEmbeddings = 0;

    for (const database of databases) {
      console.log(`\n📖 Processing database: ${database.title}`);
      const { newDocs, newEmbeddings } = await this.syncDatabase(database.id);
      totalNewDocuments += newDocs;
      totalNewEmbeddings += newEmbeddings;
    }

    await this.stateManager.updateState({
      lastSyncTime: new Date().toISOString(),
      totalDocuments: totalNewDocuments,
      totalEmbeddings: totalNewEmbeddings,
    });

    console.log(`\n🎉 Sync completed!`);
    console.log(`📊 Total documents processed: ${totalNewDocuments}`);
    console.log(`🔢 Total embeddings created: ${totalNewEmbeddings}`);
    const state = await this.stateManager.getState();
    console.log(`⏰ Last sync: ${state.lastSyncTime}`);
  }

  async syncSpecificDatabase(databaseName: string) {
    console.log(`🚀 Starting sync for database: ${databaseName}`);
    
    await this.ensureQdrantCollection();
    
    const databases = await this.fetchAllDatabases();
    const targetDatabase = databases.find(db => db.title === databaseName);
    
    if (!targetDatabase) {
      console.error(`❌ Database "${databaseName}" not found`);
      console.log('Available databases:');
      databases.forEach(db => console.log(`  - ${db.title}`));
      return;
    }

    console.log(`📖 Processing database: ${targetDatabase.title}`);
    const { newDocs, newEmbeddings } = await this.syncDatabase(targetDatabase.id);

    await this.stateManager.updateState({
      lastSyncTime: new Date().toISOString(),
      totalDocuments: newDocs,
      totalEmbeddings: newEmbeddings,
    });

    console.log(`\n🎉 Sync completed!`);
    console.log(`📊 Total documents processed: ${newDocs}`);
    console.log(`🔢 Total embeddings created: ${newEmbeddings}`);
    const state = await this.stateManager.getState();
    console.log(`⏰ Last sync: ${state.lastSyncTime}`);
  }

  private async fetchAllDatabases(): Promise<NotionDatabase[]> {
    const results: NotionDatabase[] = [];

    try {
      const response = await notion.search({
        filter: { property: 'object', value: 'database' },
        page_size: 100,
      });

      for (const result of response.results) {
        if ('id' in result && result.object === 'database') {
          const database = result as any;
          const titleProperty = database.title?.[0]?.plain_text || '(no title)';
          results.push({
            id: result.id,
            title: titleProperty,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching databases:', error);
      throw new Error(`Failed to fetch Notion databases: ${error}`);
    }

    return results;
  }

  private async syncDatabase(databaseId: string): Promise<{ newDocs: number; newEmbeddings: number }> {
    const docs: Document[] = [];
    let newDocs = 0;
    let newEmbeddings = 0;

    try {
      const pages = await notion.databases.query({ 
        database_id: databaseId,
        page_size: 100 
      });

      for (const result of pages.results) {
        if ('id' in result && result.object === 'page') {
          const page = result as NotionPage;
          
          // Skip if already processed and not modified
          if (await this.stateManager.isPageProcessed(page.id)) {
            console.log(`⏭️  Skipping already processed page: ${page.id}`);
            continue;
          }

          // Extract title and content
          const title = this.extractTitleFromPage(page);
          const content = await this.extractContentFromPage(page.id);
          
          const doc: Document = {
            id: page.id,
            source: 'notion',
            timestamp: new Date(page.last_edited_time).toISOString(),
            content: content || title,
            metadata: {
              ...page.properties,
              title,
              databaseId,
              lastEdited: page.last_edited_time,
            },
          };

          docs.push(doc);
          newDocs++;
        }
      }

      if (docs.length > 0) {
        console.log(`📝 Processing ${docs.length} new documents...`);
        
        // Embed documents
        const embeddedDocs = await embedDocuments(docs);
        newEmbeddings = embeddedDocs.length;

        // Insert into Qdrant with deduplication
        await this.insertIntoQdrantWithDeduplication(embeddedDocs);

        // Mark as processed
        for (const doc of docs) {
          await this.stateManager.markPageProcessed(doc.id);
        }
      }

    } catch (error) {
      console.error('Error syncing database:', databaseId, error);
      throw new Error(`Failed to sync database ${databaseId}: ${error}`);
    }

    return { newDocs, newEmbeddings };
  }

  private async insertIntoQdrantWithDeduplication(docs: EmbeddedDocument[]) {
    try {
      // Use upsert to handle duplicates (Qdrant will update existing records)
      const points = docs.map(doc => ({
        id: doc.id,
        vector: doc.vector,
        payload: {
          // Store parsed title prominently
          title: doc.metadata.title,
          // Store all Notion properties (they contain the actual data)
          ...doc.metadata,
          // Add our own fields
          source: doc.metadata.source,
          timestamp: doc.metadata.timestamp,
        },
      }));

      await qdrant.upsert(COLLECTION_NAME, { points });
      console.log(`✅ Inserted/updated ${points.length} documents in Qdrant`);
    } catch (error) {
      console.error('Error inserting into Qdrant:', error);
      throw error;
    }
  }

  private extractTitleFromPage(page: NotionPage): string {
    const titleProperties = ['Name', 'Title', 'Page', 'Page Name'];

    for (const propName of titleProperties) {
      const property = page.properties[propName];
      if (property) {
        if (property.type === 'title' && property.title?.[0]?.plain_text) {
          return property.title[0].plain_text;
        }
        if (property.type === 'rich_text' && property.rich_text?.[0]?.plain_text) {
          return property.rich_text[0].plain_text;
        }
      }
    }

    for (const [key, value] of Object.entries(page.properties)) {
      if (value?.type === 'title' && value.title?.[0]?.plain_text) {
        return value.title[0].plain_text;
      }
    }

    return '(no title)';
  }

  private async extractContentFromPage(pageId: string): Promise<string> {
    try {
      const blocks = await notion.blocks.children.list({ block_id: pageId });
      const contentParts: string[] = [];

      for (const block of blocks.results) {
        if ('type' in block) {
          const blockContent = this.extractBlockContent(block as any);
          if (blockContent) {
            contentParts.push(blockContent);
          }
        }
      }

      return contentParts.join('\n\n');
    } catch (error) {
      console.warn('Could not extract content from page blocks:', error);
      return '';
    }
  }

  private extractBlockContent(block: any): string {
    const blockType = block.type;
    const blockData = block[blockType];

    switch (blockType) {
      case 'paragraph':
        return blockData.rich_text?.[0]?.plain_text || '';
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        return blockData.rich_text?.[0]?.plain_text || '';
      case 'bulleted_list_item':
      case 'numbered_list_item':
        return `• ${blockData.rich_text?.[0]?.plain_text || ''}`;
      case 'quote':
        return `> ${blockData.rich_text?.[0]?.plain_text || ''}`;
      case 'code':
        return `\`\`\`\n${blockData.rich_text?.[0]?.plain_text || ''}\n\`\`\``;
      default:
        return blockData.rich_text?.[0]?.plain_text || '';
    }
  }

  async getSyncStatus() {
    return await this.stateManager.getSyncStatus();
  }

  async clearSyncState() {
    this.stateManager.clearState();
    console.log('🗑️  Sync state cleared');
  }
}
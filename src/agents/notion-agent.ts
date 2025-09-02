import { Client } from '@notionhq/client';
import { Document } from '../types';
import { QdrantClient } from '@qdrant/js-client-rest';
import { EmbeddedDocument } from '../embed/openai-embedder';
import { COLLECTION_NAME, VECTOR_SIZE, VECTOR_DISTANCE, OPENAI_EMBED_MODEL as DEFAULT_EMBED_MODEL } from '../constants';
import { config } from 'dotenv';
import OpenAI from 'openai';

config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure OpenAI embedding model
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || DEFAULT_EMBED_MODEL;

// Initialize the Notion client
const notion = new Client({ 
  auth: process.env.NOTION_API_KEY || '' 
});

const qdrant = new QdrantClient({ 
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY 
});

interface SearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
}

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

export async function fetchAllDatabases(): Promise<NotionDatabase[]> {
  const results: NotionDatabase[] = [];

  try {
    console.log('🔍 Searching for databases...');
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

export async function fetchNotionPages(databaseId: string): Promise<Document[]> {
  const docs: Document[] = [];

  try {
    const pages = await notion.databases.query({ 
      database_id: databaseId,
      page_size: 100 
    });

    for (const result of pages.results) {
      if ('id' in result && result.object === 'page') {
        const page = result as NotionPage;
        
        // Extract title from various possible property names
        const title = extractTitleFromPage(page);
        
        // Extract content from page blocks (if available)
        const content = await extractContentFromPage(page.id);
        
        docs.push({
          id: page.id,
          source: 'notion',
          timestamp: new Date(page.created_time).toISOString(),
          content: content || title, // Use content if available, otherwise use title
          metadata: page.properties,
        });
      }
    }
  } catch (error) {
    console.error('Error fetching pages from database:', databaseId, error);
    throw new Error(`Failed to fetch pages from database ${databaseId}: ${error}`);
  }

  return docs;
}

export async function ensureQdrantCollection() {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: VECTOR_DISTANCE,
      },
    });
  }
}

export async function insertIntoQdrant(docs: EmbeddedDocument[]) {
  await ensureQdrantCollection();
  const points = docs.map(doc => ({
    id: doc.id,
    vector: doc.vector,
    payload: doc.metadata,
  }));
  await qdrant.upsert(COLLECTION_NAME, { points });
}

export async function searchQdrant(query: string, limit: number = 5) {
  try {
    // Generate embedding for the query using OpenAI
    const response = await openai.embeddings.create({
      model: OPENAI_EMBED_MODEL,
      input: query,
    });

    const queryVector = response.data[0].embedding;

    // Search in Qdrant
    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryVector,
      limit,
      with_payload: true,
      score_threshold: 0.0, // Include all results regardless of similarity score
    });

    return searchResults;
  } catch (error) {
    console.error('Error searching Qdrant:', error);
    return [];
  }
}

function extractTitleFromPage(page: NotionPage): string {
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

async function extractContentFromPage(pageId: string): Promise<string> {
  try {
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    const contentParts: string[] = [];

    for (const block of blocks.results) {
      if ('type' in block) {
        const blockContent = extractBlockContent(block as any);
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

function extractBlockContent(block: any): string {
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
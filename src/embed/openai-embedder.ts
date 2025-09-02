import OpenAI from 'openai';
import { Document } from '../types';
import { VECTOR_SIZE } from '../constants';
import { config } from 'dotenv';

config();

export type EmbeddedDocument = {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
};

// Configure OpenAI embedding model via environment variable
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// OpenAI embedding function
async function getOpenAIEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: OPENAI_EMBED_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error getting OpenAI embedding:', error);
    // Fallback: return a simple hash-based vector
    return generateSimpleVector(text);
  }
}

// Fallback function that generates a simple vector based on text hash
function generateSimpleVector(text: string): number[] {
  const vector = new Array(VECTOR_SIZE).fill(0);
  let hash = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use hash to generate a simple vector
  for (let i = 0; i < VECTOR_SIZE; i++) {
    vector[i] = Math.sin(hash + i) * 0.1;
  }
  
  return vector;
}

export async function embedDocuments(docs: Document[]): Promise<EmbeddedDocument[]> {
  const result: EmbeddedDocument[] = [];

  console.log(`🔢 Embedding ${docs.length} documents with OpenAI...`);

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    console.log(`   Embedding document ${i + 1}/${docs.length}: ${doc.id}`);
    
    try {
      const vector = await getOpenAIEmbedding(doc.content);
      
      result.push({
        id: doc.id,
        vector,
        metadata: {
          source: doc.source,
          timestamp: doc.timestamp,
          ...doc.metadata,
        },
      });
    } catch (error) {
      console.error(`Error embedding document ${doc.id}:`, error);
      // Skip this document if embedding fails
    }
  }

  console.log(`✅ Successfully embedded ${result.length}/${docs.length} documents`);
  return result;
} 
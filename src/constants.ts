// Qdrant Configuration
export const COLLECTION_NAME = 'aiportal-data';
export const SYNC_STATE_ID = 999999; // Special numeric ID for sync state

// Vector Configuration - Centralized vector settings
export const VECTOR_SIZE = 3072; // OpenAI text-embedding-3-large dimension
export const VECTOR_DISTANCE = 'Cosine';

// OpenAI Configuration
export const OPENAI_EMBED_MODEL = 'text-embedding-3-large';
export const OPENAI_CHAT_MODEL = 'gpt-5'; 
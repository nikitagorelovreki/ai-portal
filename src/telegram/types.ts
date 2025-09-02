export interface TelegramConfig {
  botToken: string;
  allowedChatId: string;
  ollamaHost: string;
  qdrantUrl: string;
}

export interface QueryRequest {
  question: string;
  chatId: number;
  messageId: number;
  timestamp: Date;
}

export interface QueryResponse {
  answer: string;
  contextSources: string[];
  processingTime: number;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  source: string;
  metadata?: Record<string, any>;
} 
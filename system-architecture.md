# Telegram Bot System Architecture

## Data Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant TelegramBot
    participant OllamaEmbedding
    participant Qdrant
    participant OllamaGeneration
    participant Notion
    participant SyncManager

    Note over User, SyncManager: Data Ingestion Flow (Sync Process)
    SyncManager->>Notion: fetchAllDatabases()
    Notion-->>SyncManager: databases[]
    
    loop For each database
        SyncManager->>Notion: query(databaseId)
        Notion-->>SyncManager: pages[]
        
        loop For each page
            SyncManager->>Notion: extractContent(pageId)
            Notion-->>SyncManager: content
            SyncManager->>OllamaEmbedding: embedDocuments([doc])
            OllamaEmbedding->>OllamaEmbedding: getOllamaEmbedding(text)
            OllamaEmbedding-->>SyncManager: embeddedDocs[]
            SyncManager->>Qdrant: upsert(points)
        end
    end

    Note over User, SyncManager: Query Processing Flow (Real-time)
    User->>TelegramBot: Send question
    TelegramBot->>OllamaEmbedding: getOllamaEmbedding(query)
    OllamaEmbedding->>OllamaEmbedding: POST /api/embeddings
    OllamaEmbedding-->>TelegramBot: queryVector[]
    
    TelegramBot->>Qdrant: search(queryVector, limit=5)
    Qdrant-->>TelegramBot: searchResults[]
    
    TelegramBot->>TelegramBot: buildContext(results)
    TelegramBot->>OllamaGeneration: generateResponse(query, context)
    OllamaGeneration->>OllamaGeneration: POST /api/generate
    OllamaGeneration-->>TelegramBot: answer
    
    TelegramBot->>User: Send answer

    Note over OllamaEmbedding, OllamaGeneration: Key Distinction
    Note over OllamaEmbedding: Embedding API: Text → Vector
    Note over OllamaGeneration: Generation API: Text + Context → Text
```

## System Components

### Data Ingestion Flow (Sync Process)
1. **SyncManager** fetches all databases from Notion
2. For each database, queries all pages
3. For each page, extracts content and generates embeddings
4. Stores embedded content in Qdrant vector database

### Query Processing Flow (Real-time)
1. **User** sends question via Telegram channel
2. **TelegramBot** receives and processes the message
3. **OllamaEmbedding** converts question to vector
4. **Qdrant** performs semantic search for relevant content
5. **TelegramBot** builds context from search results
6. **OllamaGeneration** generates answer using context
7. **TelegramBot** sends response back to user

## Key Technologies
- **Telegram Bot API**: Channel message handling
- **Ollama**: Local LLM for embeddings and generation
- **Qdrant**: Vector database for semantic search
- **Notion API**: Content source and synchronization 
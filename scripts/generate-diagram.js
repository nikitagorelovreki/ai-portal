#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mermaid diagram content
const mermaidDiagram = `
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
`;

// Create a temporary mermaid file
const tempFile = path.join(__dirname, 'temp-diagram.mmd');
const outputFile = path.join(__dirname, '..', 'system-architecture.png');

try {
  // Write the diagram to a temporary file
  fs.writeFileSync(tempFile, mermaidDiagram);
  
  console.log('Generating diagram...');
  
  // Check if mmdc (mermaid-cli) is installed
  try {
    execSync('mmdc --version', { stdio: 'ignore' });
  } catch (error) {
    console.log('Installing mermaid-cli...');
    execSync('npm install -g @mermaid-js/mermaid-cli', { stdio: 'inherit' });
  }
  
  // Generate the image
  execSync(`mmdc -i ${tempFile} -o ${outputFile} -b transparent`, { stdio: 'inherit' });
  
  console.log(`✅ Diagram generated successfully: ${outputFile}`);
  
} catch (error) {
  console.error('❌ Error generating diagram:', error.message);
  console.log('\nAlternative: You can use online Mermaid editors:');
  console.log('1. Go to https://mermaid.live/');
  console.log('2. Paste the diagram content');
  console.log('3. Export as PNG/SVG');
} finally {
  // Clean up temporary file
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
} 
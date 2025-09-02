// File: src/telegram/query-bot.ts
import { Bot, Context } from 'grammy';
import { searchQdrant } from '../agents/notion-agent';
import { OPENAI_EMBED_MODEL as DEFAULT_EMBED_MODEL, OPENAI_CHAT_MODEL as DEFAULT_CHAT_MODEL } from '../constants';
import OpenAI from 'openai';
import { config } from 'dotenv';

config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure OpenAI models
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || DEFAULT_EMBED_MODEL;
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || DEFAULT_CHAT_MODEL;

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_ALLOWED_CHAT_ID || process.env.TELEGRAM_ALLOWED_CHAT_IDS;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

if (!ALLOWED_CHAT_ID) {
  console.error('❌ TELEGRAM_ALLOWED_CHAT_ID is required');
  process.exit(1);
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);
const ALLOWED_CHAT_IDS = ALLOWED_CHAT_ID.split(',').map(id => parseInt(id.trim()));

// MCP Tool Definitions
const tools = [
  {
    type: "function" as const,
    function: {
      name: "search_knowledge_base",
      description: "Search the knowledge base for relevant information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 10)"
          },
          score_threshold: {
            type: "number",
            description: "Minimum similarity score (0.0 to 1.0, default: 0.7)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "count_items",
      description: "Count ALL items matching specific criteria (searches entire database, not limited results)",
      parameters: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            description: "Filters to apply (e.g., {priority: 'high', status: 'done'})"
          }
        },
        required: ["filters"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "filter_items",
      description: "Filter items by specific criteria and return matching items",
      parameters: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            description: "Filters to apply (e.g., {priority: 'high', status: 'done'})"
          },
          limit: {
            type: "number",
            description: "Maximum number of items to return"
          }
        },
        required: ["filters"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_data",
      description: "Analyze data for patterns, trends, or insights",
      parameters: {
        type: "object",
        properties: {
          analysis_type: {
            type: "string",
            description: "Type of analysis: 'summary', 'trends', 'priorities', 'recommendations'"
          },
          filters: {
            type: "object",
            description: "Optional filters to apply before analysis"
          }
        },
        required: ["analysis_type"]
      }
    }
  }
];

// Tool implementations
async function searchKnowledgeBase(query: string, limit: number = 100, scoreThreshold: number = 0.1) {
  console.log(`🔍 Searching knowledge base: "${query}" (limit: ${limit}, threshold: ${scoreThreshold})`);
  
  try {
    const results = await searchQdrant(query, limit);
    const filteredResults = results.filter(r => r.score >= scoreThreshold);
    
    const items = filteredResults
      .filter(r => r.id !== 999999)
      .map((r, idx) => {
        const payload = r.payload as any;
        let itemContent = `--- ITEM ${idx + 1} ---\n`;
        
        for (const [key, value] of Object.entries(payload)) {
          let fieldValue = '';
          if (value === null || value === undefined) {
            fieldValue = 'null';
          } else {
            fieldValue = typeof value === 'object' ? JSON.stringify(value) : value.toString();
          }
          itemContent += `${key}: ${fieldValue}\n`;
        }
        
        itemContent += `Score: ${r.score.toFixed(3)}`;
        return itemContent;
      });

    return {
      success: true,
      items: items,
      total_found: items.length,
      query: query,
      score_threshold: scoreThreshold
    };
     } catch (error) {
     return {
       success: false,
       error: error instanceof Error ? error.message : String(error),
       query: query
     };
   }
}

async function countItems(filters: Record<string, any>) {
  console.log(`🔢 Counting items with filters:`, filters);
  
  try {
    // For counting, we need ALL items, not limited results
    const allResults = await searchQdrant("", 10000); // Get all items
    const filteredResults = allResults.filter(r => r.id !== 999999);
    
    let count = filteredResults.length;
    
    // Apply filters if provided
    if (filters && Object.keys(filters).length > 0) {
      count = 0;
      for (const result of filteredResults) {
        const payload = result.payload as any;
        let matches = true;
        
        for (const [field, value] of Object.entries(filters)) {
          let fieldValue = '';
          if (payload[field] === null || payload[field] === undefined) {
            fieldValue = 'null';
          } else {
            fieldValue = typeof payload[field] === 'object' ? JSON.stringify(payload[field]) : payload[field].toString();
          }
          if (!fieldValue.toLowerCase().includes(value.toString().toLowerCase())) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          count++;
        }
      }
    }
    
    return {
      success: true,
      count: count,
      total_items: filteredResults.length,
      filters: filters
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      filters: filters
    };
  }
}

function filterItems(filters: Record<string, any>, limit?: number) {
  console.log(`🔍 Filtering items with filters:`, filters, `limit:`, limit);
  
  return {
    success: true,
    filters: filters,
    limit: limit,
    note: "Use search_knowledge_base first to get data, then apply these filters"
  };
}

function analyzeData(analysisType: string, filters?: Record<string, any>) {
  console.log(`📊 Analyzing data: ${analysisType}`, filters ? `with filters: ${JSON.stringify(filters)}` : '');
  
  return {
    success: true,
    analysis_type: analysisType,
    filters: filters,
    note: "Use search_knowledge_base first to get data, then perform this analysis"
  };
}

// Helper function to split long messages
function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    if ((currentChunk + line + '\n').length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // If a single line is too long, split it
      if (line.length > maxLength) {
        const words = line.split(' ');
        let tempLine = '';
        for (const word of words) {
          if ((tempLine + word + ' ').length > maxLength) {
            if (tempLine) {
              chunks.push(tempLine.trim());
              tempLine = '';
            }
            // If a single word is too long, truncate it
            if (word.length > maxLength) {
              chunks.push(word.substring(0, maxLength - 3) + '...');
            } else {
              tempLine = word + ' ';
            }
          } else {
            tempLine += word + ' ';
          }
        }
        if (tempLine) {
          currentChunk = tempLine;
        }
      } else {
        currentChunk = line + '\n';
      }
    } else {
      currentChunk += line + '\n';
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

bot.on(['message:text', 'channel_post:text'], async (ctx: Context) => {
  // Debug: Log all incoming messages
  console.log(`📨 Received message from chat ID: ${ctx.chat?.id}, type: ${ctx.chat?.type}`);
  
  // Ensure message is from the allowed channel / chat
  // Temporarily allow all chats for debugging
  // if (!ctx.chat?.id || !ALLOWED_CHAT_IDS.includes(ctx.chat.id)) {
  //   console.log(`Message from unauthorized chat: ${ctx.chat?.id}`);
  //   return;
  // }

  const query = (ctx.update.message as any)?.text || (ctx.update.channel_post as any)?.text || '';
  if (!query.trim()) {
    console.log('Received empty text message');
    return;
      }
    
    console.log(`Processing query: ${query}`);
  const processingMsg = await ctx.reply('🤖 Thinking...');

  try {
        // Step 1: Analyze query and get relevant data
    console.log('🔍 Analyzing query and getting relevant data...');
    
    let toolResults: any[] = [];
    
    // Check if this is a field-specific query (e.g., status, priority, etc.)
    // Instead of hardcoding, use a generic heuristic: if the query contains 'with', 'where', '=', or common filter words
    const isFieldQuery = /\b(with|where|=|по|с|у которых|имеет|статус|priority|приоритет|статус)\b/i.test(query);
    
    if (isFieldQuery) {
      console.log('📊 Field-specific query detected, using direct filtering');
      // For field queries, get ALL data and let LLM filter
      const allData = await searchKnowledgeBase("", 100, 0.0); // Get all data
      toolResults.push({
        tool: 'search_knowledge_base',
        parameters: { query: "", limit: 100, score_threshold: 0.0 },
        result: allData
      });
    } else {
      // For general queries, use semantic search
      const searchResult = await searchKnowledgeBase(query, 20, 0.1);
      toolResults.push({
        tool: 'search_knowledge_base',
        parameters: { query, limit: 20, score_threshold: 0.1 },
        result: searchResult
      });
    }
    
    // If it's a counting question, also get accurate count
    if (/\b(how many|count|сколько|количество)\b/i.test(query)) {
      console.log('🔢 Also getting accurate count for counting question');
      const countResult = await countItems({});
      toolResults.push({
        tool: 'count_items',
        parameters: { filters: {} },
        result: countResult
      });
    }

    // Step 3: LLM generates final answer using tool results
    console.log('🧠 LLM generating final answer...');
    
    const finalResponse = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
                 {
           role: 'system',
           content: `You are an intelligent AI assistant with access to a personal knowledge base containing tasks, projects, and other information. You use GPT-5 for advanced reasoning and analysis.

IMPORTANT: Base your answer on the tool results provided. Be insightful, helpful, and provide actionable advice.

Available data:
- search_knowledge_base: Contains items from the knowledge base (may be all items for field queries)
- count_items: Contains total count of items (if provided)

Guidelines:
1. Answer naturally and conversationally in the user's language (Russian/English)
2. Provide intelligent analysis and insights, not just raw data
3. For task-related queries, analyze priorities, deadlines, and status
4. Suggest actionable next steps when appropriate
5. Identify patterns, trends, or potential issues in the data
6. Be proactive - if you see urgent tasks or deadlines, mention them
7. If no relevant data is found, suggest what might be missing or how to add it
8. Use your advanced reasoning to provide context and recommendations

For task analysis:
- Prioritize by urgency and importance
- Identify dependencies between tasks
- Suggest optimal task ordering
- Highlight potential bottlenecks or risks
- Recommend time management strategies

Examples of intelligent responses:
- "I found 5 high-priority tasks. The most urgent is [task] due [date]. I recommend focusing on [specific task] first because..."
- "Your task list shows a pattern of [observation]. Consider [recommendation] to improve efficiency."
- "I notice several tasks are overdue. Let's prioritize [specific tasks] and consider delegating [other tasks]."

Be insightful, proactive, and genuinely helpful.`
         },
        {
          role: 'user',
          content: `User Query: "${query}"

Tool Results:
${JSON.stringify(toolResults, null, 2)}

Provide a comprehensive answer based on the tool results.`
        }
      ],
      temperature: 1.0
    });

    const answerText = finalResponse.choices[0].message.content || '❌ Failed to generate an answer.';
    
    // Split long messages for Telegram (4096 character limit)
    if (answerText.length > 4000) {
      const chunks = splitMessage(answerText, 4000);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const prefix = chunks.length > 1 ? `**Part ${i + 1}/${chunks.length}**\n\n` : '';
        await ctx.reply(prefix + chunk);
      }
    } else {
      await ctx.reply(answerText);
    }
    
    console.log('✅ Answer sent successfully');

  } catch (error) {
    console.error('Error while processing query:', error);
    await ctx.reply('❌ An error occurred while processing your request.');
  } finally {
    // Delete the processing message to keep chat clean (ignore failures)
    try { 
      if (ctx.chat?.id) {
        await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id); 
      }
    } catch {}
  }
});

// Error handling
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start the bot
bot.start().then(() => {
  console.log('🤖 MCP Telegram Bot is running...');
  console.log(`Listening to chat IDs: ${ALLOWED_CHAT_IDS.join(', ')}`);
}).catch((err: any) => {
  console.error('❌ Bot startup error:', err);
  if (err.error_code === 401) {
    console.error('❌ Invalid bot token. Please check TELEGRAM_BOT_TOKEN in .env file');
  }
});

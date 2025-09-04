import { Telegraf } from 'telegraf';
import axios from 'axios';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// OpenAI client для рекомендаций
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// API клиент
const API_BASE_URL = process.env.HEALTH_API_URL || 'http://localhost:3100';

// Состояние регистрации пользователей
const registrationState = new Map<number, {
  step: 'name' | 'age' | 'complete';
  name?: string;
  age?: number;
  mockSteps?: { steps: number; activity: string; hourlyData: number[] };
}>();

// Generate random steps for user (Apple Health compatible)
function generateMockSteps(userId: number, age?: number): { steps: number; activity: string; hourlyData: number[] } {
  const seed = userId % 1000;
  const random = (seed * 9301 + 49297) % 233280;
  const normalized = random / 233280;
  
  // Age-appropriate step targets
  let targetSteps: number;
  let activity: string;
  
  if (age) {
    // Age-based generation
    if (age < 18) {
      targetSteps = 8000 + Math.floor(normalized * 4000); // 8000-12000
      activity = normalized < 0.3 ? 'low' : normalized < 0.7 ? 'medium' : 'high';
    } else if (age < 30) {
      targetSteps = 7000 + Math.floor(normalized * 5000); // 7000-12000
      activity = normalized < 0.2 ? 'low' : normalized < 0.6 ? 'medium' : 'high';
    } else if (age < 50) {
      targetSteps = 6000 + Math.floor(normalized * 4000); // 6000-10000
      activity = normalized < 0.25 ? 'low' : normalized < 0.65 ? 'medium' : 'high';
    } else if (age < 65) {
      targetSteps = 5000 + Math.floor(normalized * 3000); // 5000-8000
      activity = normalized < 0.3 ? 'low' : normalized < 0.7 ? 'medium' : 'high';
    } else {
      targetSteps = 3000 + Math.floor(normalized * 3000); // 3000-6000
      activity = normalized < 0.4 ? 'low' : normalized < 0.8 ? 'medium' : 'high';
    }
  } else {
    // Fallback to original logic
    if (normalized < 0.2) {
      targetSteps = 2000 + Math.floor(normalized * 3000);
      activity = 'low';
    } else if (normalized < 0.6) {
      targetSteps = 5000 + Math.floor(normalized * 4000);
      activity = 'medium';
    } else {
      targetSteps = 8000 + Math.floor(normalized * 7000);
      activity = 'high';
    }
  }
  
  const hourlyData = Array.from({ length: 24 }, (_, hour) => {
    if (hour < 6 || hour > 22) {
      return Math.floor(Math.random() * 50);
    } else if (hour >= 7 && hour <= 9) {
      return Math.floor(targetSteps * 0.15 * (0.8 + Math.random() * 0.4));
    } else if (hour >= 12 && hour <= 14) {
      return Math.floor(targetSteps * 0.12 * (0.6 + Math.random() * 0.8));
    } else if (hour >= 17 && hour <= 19) {
      return Math.floor(targetSteps * 0.18 * (0.7 + Math.random() * 0.6));
    } else {
      return Math.floor(targetSteps * 0.08 * (0.3 + Math.random() * 1.4));
    }
  });
  
  const totalGenerated = hourlyData.reduce((sum, steps) => sum + steps, 0);
  
  return {
    steps: totalGenerated,
    activity,
    hourlyData
  };
}

// Function to check if user is registered
function isUserRegistered(userId: number): boolean {
  const state = registrationState.get(userId);
  return state?.step === 'complete';
}

// Function to send "thinking" indicator
async function sendTyping(ctx: any) {
  await ctx.reply('🤔 Thinking...', { parse_mode: 'Markdown' });
}

// Help command
bot.command('help', async (ctx) => {
  await ctx.reply(`
🏃‍♂️ **WLNX Health Bot - Help**

📋 **Available commands:**

🔐 **Registration:**
• /start - Start registration

📊 **Statistics and advice:**
• /steps - Today's step statistics
• /advice - Personal advice for today
• /plan - Weekly plan
• /recommendation - New AI recommendations

💡 **How to use:**
1. Send /start to register
2. Enter your name and age
3. Get personal recommendations
4. Use commands for monitoring

🤖 **Features:**
• Each user gets unique data
• AI generates personal recommendations
• Data is saved in database

❓ **Need help?** Contact the developer
  `, { parse_mode: 'Markdown' });
});

// Registration command
bot.command('start', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  
  registrationState.set(userId, { step: 'name' });
  
  await ctx.reply(`
🏃‍♂️ **Welcome to WLNX Health!**

To get started, you need to register.

📝 **Enter your name:**
  `, { parse_mode: 'Markdown' });
});

// Commands for Health integration
bot.command('steps', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  
  if (!isUserRegistered(userId)) {
    await ctx.reply('❌ Please register first with /start');
    return;
  }
  
  await sendTyping(ctx);
  
  const state = registrationState.get(userId);
  const mockSteps = state?.mockSteps;
  
  if (!mockSteps) {
    await ctx.reply('❌ Step data not found. Try re-registering.');
    return;
  }
  
  try {
    const response = await axios.get(`${API_BASE_URL}/metrics/daily`);
    const data = response.data;
    
    const message = `
🏃‍♂️ **Today's Step Statistics**

📊 **Overall Progress:**
• Steps: ${mockSteps.steps}
• Goal: ${data.policy?.min_steps || 8000} - ${data.policy?.max_steps || 12000}
• Status: ${data.status || 'ok'}

⏰ **By Hour:**
${mockSteps.hourlyData.map((steps, hour) => 
  steps > 0 ? `• ${hour.toString().padStart(2, '0')}:00 - ${steps} steps` : ''
).filter(line => line).join('\n')}

💡 **Recommendations:**
• Try to walk 8000-12000 steps per day
• Take breaks every 2 hours
• Drink more water
    `;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply('❌ Error getting step data');
  }
});

bot.command('advice', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  
  if (!isUserRegistered(userId)) {
    await ctx.reply('❌ Please register first with /start');
    return;
  }
  
  await sendTyping(ctx);
  
  const state = registrationState.get(userId);
  const mockSteps = state?.mockSteps;
  
  if (!mockSteps) {
    await ctx.reply('❌ Step data not found. Try re-registering.');
    return;
  }
  
  try {
    const response = await axios.get(`${API_BASE_URL}/metrics/advice/today`);
    const data = response.data;
    
    const message = `
💡 **Personal Advice for Today**

📝 **Message:** ${data.message}
📊 **Current Steps:** ${mockSteps.steps}
🎯 **Target Range:** ${data.target_range?.[0] || 8000} - ${data.target_range?.[1] || 12000}

⏰ **Time:** ${new Date().toLocaleString('en-US')}
    `;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply('❌ Error getting advice');
  }
});

bot.command('plan', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  
  if (!isUserRegistered(userId)) {
    await ctx.reply('❌ Please register first with /start');
    return;
  }
  
  await sendTyping(ctx);
  
  try {
    const response = await axios.get(`${API_BASE_URL}/metrics/advice/weekly`);
    const data = response.data;
    
    const message = `
📅 **Weekly Plan**

${data.days?.map((day: any, index: number) => {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const isRestDay = day.is_rest_day ? '😴 Rest day' : '🚶‍♂️ Regular day';
  return `• ${dayNames[index]}: ${day.min_steps}-${day.max_steps} steps - ${isRestDay}`;
}).join('\n') || 'Plan not ready yet'}

💡 **General Recommendations:**
• Try to reach 10000 steps per day
• Take breaks every 2 hours
• Drink more water
• Watch your posture
    `;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply('❌ Error getting plan');
  }
});

// Command to get new recommendations
bot.command('recommendation', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  
  const state = registrationState.get(userId);
  if (!state || state.step !== 'complete') {
    await ctx.reply('❌ Please register first with /start');
    return;
  }
  
  const mockSteps = state.mockSteps;
  if (!mockSteps) {
    await ctx.reply('❌ Step data not found. Try re-registering.');
    return;
  }
  
  const recommendation = await generatePersonalRecommendation(state.name!, state.age!, mockSteps);
  
  await ctx.reply(`
🤖 **New Personal Recommendations**

📊 **Current Activity:** ${mockSteps.steps} steps (${mockSteps.activity})

${recommendation}
  `, { parse_mode: 'Markdown' });
});

// Universal message handler
bot.on('message', async (ctx) => {
  const message = ctx.message;
  const userId = ctx.from?.id;
  
  if (!userId) return;
  
  // Handle only text messages
  if (!('text' in message)) {
    await ctx.reply(`
❌ **Only text messages are supported**

🤖 Available commands:

🔐 **Registration:**
• /start - Start registration

📊 **Statistics and advice:**
• /steps - Today's step statistics
• /advice - Personal advice for today
• /plan - Weekly plan
• /recommendation - New AI recommendations

💡 **Help:** send "help" or "/help"
    `, { parse_mode: 'Markdown' });
    return;
  }
  
  const text = message.text;
  
  // Check for help command
  if (text.toLowerCase() === 'help' || text.toLowerCase() === '/help') {
    await ctx.reply(`
🏃‍♂️ **WLNX Health Bot - Help**

📋 **Available commands:**

🔐 **Registration:**
• /start - Start registration

📊 **Statistics and advice:**
• /steps - Today's step statistics
• /advice - Personal advice for today
• /plan - Weekly plan
• /recommendation - New AI recommendations

💡 **How to use:**
1. Send /start to register
2. Enter your name and age
3. Get personal recommendations
4. Use commands for monitoring

🤖 **Features:**
• Each user gets unique data
• AI generates personal recommendations
• Data is saved in database

❓ **Need help?** Contact the developer
    `, { parse_mode: 'Markdown' });
    return;
  }
  
  // Check for other possible commands
  if (text.startsWith('/')) {
    await ctx.reply(`
❌ **Unknown command: ${text}**

🤖 Available commands:

🔐 **Registration:**
• /start - Start registration

📊 **Statistics and advice:**
• /steps - Today's step statistics
• /advice - Personal advice for today
• /plan - Weekly plan
• /recommendation - New AI recommendations

💡 **Help:** send "help" or "/help"
    `, { parse_mode: 'Markdown' });
    return;
  }
  
  // Check registration state
  const state = registrationState.get(userId);
  if (!state) {
    // User not in registration process - show help
    await ctx.reply(`
❓ **I don't understand the command: "${text}"**

🤖 Available commands:

🔐 **Registration:**
• /start - Start registration

📊 **Statistics and advice:**
• /steps - Today's step statistics
• /advice - Personal advice for today
• /plan - Weekly plan
• /recommendation - New AI recommendations

💡 **Help:** send "help" or "/help"
    `, { parse_mode: 'Markdown' });
    return;
  }
  
  // Handle registration
  if (state.step === 'name') {
    // Save name and ask for age
    state.name = text;
    state.step = 'age';
    
    await ctx.reply(`
✅ Name saved: **${text}**

📅 **Enter your age (number):**
    `, { parse_mode: 'Markdown' });
    
  } else if (state.step === 'age') {
    const age = parseInt(text);
    if (isNaN(age) || age < 1 || age > 120) {
      await ctx.reply('❌ Please enter a valid age (1-120 years)');
      return;
    }
    
    // Save age and complete registration
    state.age = age;
    state.step = 'complete';
    
    // Generate mock data for this user
    const mockSteps = generateMockSteps(userId, age);
    
    // Save data in user state
    state.mockSteps = mockSteps;
    
    // Send data to API
    try {
      await axios.post(`${API_BASE_URL}/ingest/health/profile`, {
        dob: new Date(Date.now() - age * 365 * 24 * 60 * 60 * 1000).toISOString(),
        apple_health_uid: `user_${userId}`
      });
      
      // Use generated hourly data
      await axios.post(`${API_BASE_URL}/ingest/health/steps`, {
        items: mockSteps.hourlyData.map((steps, hour) => ({
          ts: new Date(new Date().setHours(hour, 0, 0, 0)).toISOString(),
          count_delta: steps
        })).filter(item => item.count_delta > 0)
      });
      
      // Generate personal recommendations via GPT-5
      const gptRecommendation = await generatePersonalRecommendation(state.name || 'User', age, mockSteps);
      
      await ctx.reply(`
🎉 **Registration Complete!**

👤 **User:** ${state.name}
📅 **Age:** ${age} years
📊 **Today's Activity:** ${mockSteps.steps} steps (${mockSteps.activity})

🤖 **Personal AI Recommendations:**
${gptRecommendation}

💡 **Available Commands:**
• /steps - step statistics
• /advice - personal advice
• /plan - weekly plan
• /recommendation - new recommendations

🚀 Ready to use!
      `, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('Error during registration:', error);
      await ctx.reply('❌ Error during registration. Try again later.');
    }
  }
});

// Function to generate recommendations via GPT-5
async function generatePersonalRecommendation(name: string, age: number, stepsData: { steps: number; activity: string }): Promise<string> {
  try {
    // Calculate age-appropriate step targets
    let targetSteps: number;
    let ageGroup: string;
    let activityLevel: string;
    
    if (age < 18) {
      targetSteps = 10000;
      ageGroup = 'teenager';
      activityLevel = age < 13 ? 'child' : 'teen';
    } else if (age < 30) {
      targetSteps = 10000;
      ageGroup = 'young adult';
      activityLevel = 'young';
    } else if (age < 50) {
      targetSteps = 8000;
      ageGroup = 'adult';
      activityLevel = 'adult';
    } else if (age < 65) {
      targetSteps = 7000;
      ageGroup = 'middle-aged adult';
      activityLevel = 'middle-aged';
    } else {
      targetSteps = 6000;
      ageGroup = 'senior';
      activityLevel = 'senior';
    }
    
    const prompt = `
You are an experienced personal fitness trainer and health coach. Create personalized, age-appropriate health recommendations for your client.

CLIENT PROFILE:
- Name: ${name}
- Age: ${age} years old (${ageGroup})
- Current daily steps: ${stepsData.steps} steps
- Activity level: ${stepsData.activity}
- Age-appropriate target: ${targetSteps} steps per day

TRAINER INSTRUCTIONS:
1. First, assess if their current step count is appropriate for their age group
2. Provide specific, actionable advice based on their age and current activity
3. Consider age-related factors (energy levels, joint health, recovery time)
4. Give encouraging but realistic recommendations
5. Include specific tips for their age group

RESPONSE FORMAT:
- Start with a brief assessment of their current activity
- Provide 3-4 specific, age-appropriate recommendations
- End with a motivating message
- Keep it friendly but professional
- Use bullet points for recommendations

IMPORTANT: Be realistic about what's achievable for their age group. Don't recommend 10,000 steps to a 70-year-old if they're currently doing 2,000.
    `;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional personal trainer with 15+ years of experience working with clients of all ages. You understand age-related fitness considerations and provide realistic, encouraging advice. You always consider the client's age when making recommendations and never suggest unrealistic goals.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 400,
      temperature: 0.7
    });
    
    return response.choices[0]?.message?.content || 'Failed to get recommendations';
  } catch (error) {
    console.error('Error generating recommendation:', error);
    
    // Fallback with age-appropriate recommendations
    let targetSteps: number;
    if (age < 18) targetSteps = 10000;
    else if (age < 30) targetSteps = 10000;
    else if (age < 50) targetSteps = 8000;
    else if (age < 65) targetSteps = 7000;
    else targetSteps = 6000;
    
    return `Hello, ${name}! 👋

Your activity today: ${stepsData.steps} steps (${stepsData.activity} activity).

💪 **Age-Appropriate Recommendations for ${age} years old:**

• Your target: ${targetSteps} steps per day
• Take regular breaks every 1-2 hours
• Stay hydrated throughout the day
• Listen to your body and don't overexert

🎯 **Specific Tips:**
${age < 30 ? '• You can aim for higher activity levels' : age < 50 ? '• Focus on consistency over intensity' : age < 65 ? '• Prioritize gentle, regular movement' : '• Gentle walking is excellent for your health'}

Keep up the great work! 🚀`;
  }
}

// Автоматические уведомления
export async function sendMorningAdvice() {
  try {
    const response = await axios.get(`${API_BASE_URL}/metrics/advice/today`);
    const data = response.data;
    
    const message = `
🌅 **Доброе утро!**

💡 **Совет на сегодня:** ${data.message}
🎯 **Цель:** ${data.target_range?.[0] || 8000} - ${data.target_range?.[1] || 12000} шагов

💪 Начните день с небольшой прогулки!
    `;
    
    // Отправляем в канал или группу
    await bot.telegram.sendMessage(process.env.TELEGRAM_CHANNEL_ID || '', message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error sending morning advice:', error);
  }
}

export async function sendEveningAdvice() {
  try {
    const response = await axios.get(`${API_BASE_URL}/metrics/daily`);
    const data = response.data;
    
    const message = `
🌙 **Итоги дня**

📊 **Сегодня пройдено:** ${data.steps_total || 0} шагов
🎯 **Цель:** ${data.policy?.min_steps || 8000} - ${data.policy?.max_steps || 12000}
${getEveningMessage(data.steps_total || 0, data.policy?.min_steps || 8000)}

🌙 Хорошего отдыха!
    `;
    
    await bot.telegram.sendMessage(process.env.TELEGRAM_CHANNEL_ID || '', message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error sending evening advice:', error);
  }
}

// Вспомогательные функции
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'go_walk': return '🚶‍♂️';
    case 'slow_down': return '⏸️';
    case 'perfect': return '🎉';
    default: return '📊';
  }
}

function getAdviceEmoji(kind: string): string {
  switch (kind) {
    case 'go_walk': return '🚶‍♂️';
    case 'slow_down': return '⏸️';
    case 'rest_day': return '😴';
    default: return '💡';
  }
}

function formatHourlySteps(stepsByHour: Record<string, number>): string {
  let result = '';
  for (let hour = 6; hour <= 22; hour++) {
    const steps = stepsByHour[hour] || 0;
    if (steps > 0) {
      result += `• ${hour}:00 - ${steps} шагов\n`;
    }
  }
  return result || '• Данных пока нет';
}

function formatWeeklyPlan(plan: any[]): string {
  if (!plan || plan.length === 0) {
    return 'План пока не готов';
  }
  
  return plan.map((day, index) => {
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const isRestDay = day.is_rest_day ? '😴 День отдыха' : '🚶‍♂️ Обычный день';
    return `• ${dayNames[index]}: ${day.min_steps}-${day.max_steps} шагов - ${isRestDay}`;
  }).join('\n');
}

function getMotivationalMessage(steps: number, target: number): string {
  const percentage = (steps / target) * 100;
  
  if (percentage >= 100) {
    return '🎉 Отличная работа! Цель достигнута!';
  } else if (percentage >= 75) {
    return '💪 Почти у цели! Еще немного усилий!';
  } else if (percentage >= 50) {
    return '👍 Хороший прогресс! Продолжайте в том же духе!';
  } else if (percentage >= 25) {
    return '🚶‍♂️ Начинаем! Каждый шаг важен!';
  } else {
    return '🌅 Время начать! Пройдитесь немного!';
  }
}

function getEveningMessage(steps: number, target: number): string {
  const percentage = (steps / target) * 100;
  
  if (percentage >= 100) {
    return '🎉 Поздравляем! Цель дня достигнута!';
  } else if (percentage >= 75) {
    return '💪 Хороший день! Завтра будет еще лучше!';
  } else if (percentage >= 50) {
    return '👍 Неплохо! Завтра постараемся больше!';
  } else {
    return '🌙 Не переживайте, завтра новый день!';
  }
}

// Запуск бота
export function startBot() {
  bot.launch();
  console.log('🤖 WLNX Health Bot запущен');
}

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Запускаем бота
startBot();

# AI Portal - Personal Knowledge Base with GPT-5

Интеллектуальный портал для управления персональной базой знаний с использованием GPT-5 и векторного поиска.

## 🚀 Возможности

- **GPT-5 интеграция** - умный анализ и рекомендации
- **Векторный поиск** - семантический поиск по базе знаний
- **Telegram бот** - удобный интерфейс для запросов
- **Notion синхронизация** - автоматическая синхронизация с Notion
- **Qdrant векторная БД** - высокопроизводительное хранение эмбеддингов

## 🛠 Технологии

- **OpenAI GPT-5** - для генерации ответов
- **OpenAI text-embedding-3-large** - для векторных эмбеддингов (3072 измерения)
- **Qdrant** - векторная база данных
- **Notion API** - интеграция с Notion
- **Telegram Bot API** - интерфейс пользователя
- **TypeScript** - типобезопасность
- **Node.js** - серверная часть

## 📋 Требования

- Node.js 18+
- Docker (для локального Qdrant)
- OpenAI API ключ
- Notion API ключ
- Telegram Bot токен

## 🚀 Установка

1. **Клонируйте репозиторий:**
```bash
git clone https://github.com/nikitagorelovreki/ai-portal.git
cd ai-portal
```

2. **Установите зависимости:**
```bash
npm install
```

3. **Настройте переменные окружения:**
```bash
cp env.template .env
# Отредактируйте .env файл с вашими ключами
```

4. **Запустите Qdrant:**
```bash
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

5. **Синхронизируйте данные из Notion:**
```bash
npm run sync-notion
```

6. **Запустите Telegram бота:**
```bash
npm run start-bot
```

## 🔧 Конфигурация

### Переменные окружения (.env)

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_EMBED_MODEL=text-embedding-3-large
OPENAI_CHAT_MODEL=gpt-5

# Qdrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key

# Notion Configuration
NOTION_API_KEY=your_notion_api_key

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ALLOWED_CHAT_ID=your_chat_id
```

## 📖 Использование

### Telegram бот

Отправьте боту вопросы на русском или английском языке:

- "Какие задачи у меня на сегодня?"
- "Покажи высокоприоритетные задачи"
- "Сколько задач в работе?"
- "What are my current tasks?"
- "Show me tasks due this week"

### Синхронизация с Notion

```bash
# Полная синхронизация
npm run sync-notion

# Синхронизация конкретной базы данных
npm run sync-notion -- --database="Job Tasks Tracker"
```

## 🏗 Архитектура

```
src/
├── agents/           # Агенты для работы с внешними сервисами
│   ├── notion-agent.ts
│   ├── sync-manager.ts
│   └── sync-state.ts
├── constants.ts      # Централизованная конфигурация
├── embed/           # Эмбеддинги
│   └── openai-embedder.ts
├── telegram/        # Telegram боты
│   └── query-bot.ts
└── types.ts         # TypeScript типы
```

## 🔧 Разработка

### Компиляция TypeScript

```bash
# Компиляция всех файлов
npx tsc src/**/*.ts --outDir dist --target es2020 --module commonjs --esModuleInterop --allowSyntheticDefaultImports

# Компиляция конкретного файла
npx tsc src/telegram/query-bot.ts --outDir dist --target es2020 --module commonjs --esModuleInterop --allowSyntheticDefaultImports
```

### Тестирование

```bash
# Тест поиска
node scripts/test-search.ts

# Тест синхронизации (dry run)
node scripts/sync-notion-dry-run.ts
```

## 📊 Мониторинг

- Логи бота в реальном времени
- Статистика синхронизации
- Метрики производительности поиска

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

## 📄 Лицензия

MIT License

## 👨‍💻 Автор

Nikita Gorelov - [GitHub](https://github.com/nikitagorelovreki)

---

**AI Portal** - Умная база знаний для продуктивной работы! 🚀 
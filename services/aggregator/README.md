# WLNX Health Aggregator API

API для агрегации данных о здоровье из Apple Health и Notion, с интеграцией в Telegram бот.

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
cd services/aggregator
npm install
```

### 2. Настройка окружения
```bash
cp env.template .env
# Отредактируйте .env с вашими ключами
```

### 3. Запуск базы данных
```bash
docker-compose up postgres -d
```

### 4. Применение миграций
```bash
psql -d wlnx_health -f migrations/001_initial_schema.sql
```

### 5. Запуск API
```bash
npm run dev
```

## 📊 API Endpoints

### Health Data
- `POST /ingest/health/profile` - Обновление профиля пользователя
- `POST /ingest/health/steps` - Загрузка данных о шагах

### Notion Sync
- `POST /sync/notion` - Синхронизация заметок из Notion
- `GET /sync/notion/status` - Статус синхронизации

### Metrics & Advice
- `GET /metrics/daily?date=YYYY-MM-DD` - Дневные метрики
- `GET /advice/today` - Совет на сегодня
- `GET /advice/weekly` - План на неделю

### Health Check
- `GET /healthcheck` - Проверка состояния API

## 🔧 Конфигурация

### Переменные окружения
```bash
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/wlnx_health

# Notion
NOTION_TOKEN=secret_...
NOTION_NOTES_DB_ID=...

# Telegram
TELEGRAM_BOT_TOKEN=...

# API
API_JWT_SECRET=your_jwt_secret_here
TZ=Asia/Bangkok

# Health
HEALTH_API_URL=http://localhost:3100

# Logging
LOG_LEVEL=info
```

## 🏗️ Архитектура

```
src/
├── server.ts              # Основной сервер
├── routes/                # API роуты
│   ├── health.ts         # Health data endpoints
│   ├── notion.ts         # Notion sync endpoints
│   └── metrics.ts        # Metrics & advice endpoints
├── services/             # Бизнес-логика
│   ├── database.ts       # Database service
│   ├── healthService.ts  # Health data processing
│   ├── notionService.ts  # Notion integration
│   └── adviceService.ts  # Advice generation
└── utils/                # Утилиты
    └── cron.ts           # Cron jobs
```

## 📊 Схема базы данных

### Таблицы
- `users` - Пользователи
- `steps_raw` - Сырые данные о шагах
- `steps_daily` - Дневные агрегаты
- `health_notes` - Заметки из Notion
- `advice_log` - Лог советов

## 🔄 Cron Jobs

- `*/30 * * * *` - Пересчет дневных метрик
- `0 11,20 * * *` - Отправка советов

## 🧪 Тестирование

```bash
# Unit тесты
npm test

# Линтинг
npm run lint

# Сборка
npm run build
```

## 🐳 Docker

```bash
# Сборка образа
docker build -t wlnx-aggregator .

# Запуск с docker-compose
docker-compose up
```

## 📝 Примеры запросов

### Обновление профиля
```bash
curl -X POST http://localhost:3100/ingest/health/profile \
  -H "Content-Type: application/json" \
  -d '{"dob": "1990-01-01", "apple_health_uid": "user123"}'
```

### Загрузка шагов
```bash
curl -X POST http://localhost:3100/ingest/health/steps \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"ts": "2024-01-01T10:00:00Z", "count_delta": 100},
      {"ts": "2024-01-01T11:00:00Z", "count_delta": 150}
    ]
  }'
```

### Получение совета
```bash
curl http://localhost:3100/advice/today
```

## 🚀 Разработка

### Структура проекта
```
services/aggregator/
├── src/                    # Исходный код
├── migrations/             # Миграции БД
├── package.json            # Зависимости
├── tsconfig.json           # TypeScript конфиг
├── docker-compose.yml      # Docker Compose
├── Dockerfile              # Docker образ
└── README.md               # Документация
```

### Команды разработки
```bash
npm run dev      # Запуск в режиме разработки
npm run build    # Сборка TypeScript
npm run start    # Запуск production версии
npm run migrate  # Применение миграций
npm run test     # Запуск тестов
npm run lint     # Проверка кода
```

## 🔗 Интеграции

- **Apple Health** - через iOS приложение
- **Notion** - синхронизация заметок
- **Telegram** - отправка советов
- **Postgres** - хранение данных

---

**Готов к интеграции с WLNX!** 🚀

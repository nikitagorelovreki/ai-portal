# WLNX Health MVP - Apple Health Integration Plan

## 🎯 Цель MVP (1 неделя)

Создать систему мониторинга здоровья с интеграцией Apple Health, которая:
1. **iOS-приложение** читает возраст и шаги из Apple Health
2. **Aggregator API** обрабатывает телеметрию и хранит метрики + политики из Notion
3. **Telegram-бот** дает советы на основе правил (раз в день + по команде)
4. **Postgres** хранит все данные для будущей интеграции с WLNX

## 🏗️ Архитектура

```
iOS App (SwiftUI + HealthKit)
    ↓ HTTPS
Aggregator API (Node/TS + Fastify)
    ↓
Postgres (users, steps_raw, steps_daily, policies_notion, advice_log)
    ↓
Notion Sync (скрипт) + Telegram Bot (интеграция с WLNX)
```

## 📊 Схема базы данных (Postgres)

### Таблицы

```sql
-- Пользователи
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    tg_chat_id BIGINT UNIQUE NOT NULL,
    apple_health_uid VARCHAR(255) UNIQUE,
    dob DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Сырые данные шагов от HealthKit
CREATE TABLE steps_raw (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    ts TIMESTAMP NOT NULL,
    count_delta INTEGER NOT NULL,
    source VARCHAR(50) DEFAULT 'healthkit',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Дневные агрегаты (витрина для скорости)
CREATE TABLE steps_daily (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    steps_total INTEGER DEFAULT 0,
    steps_by_hour JSONB, -- {0: 100, 1: 150, ...}
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Политики из Notion (заметки)
CREATE TABLE health_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    notion_page_id VARCHAR(255) UNIQUE,
    title VARCHAR(500),
    content TEXT,
    parsed_data JSONB, -- {stepGoals: [], restDays: [], rules: []}
    last_edited TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Лог советов
CREATE TABLE advice_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    kind VARCHAR(20) CHECK (kind IN ('go_walk', 'slow_down', 'ok')),
    sent_at TIMESTAMP NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🧠 Правила для советов

### Логика советов (MVP)

```typescript
interface AdviceRules {
  // Получаем актуальные цели из заметок
  const currentGoals = await getCurrentStepGoals();
  const isRestDay = await checkIfRestDay();
  
  // Если rest_day = true → не даем советов "идти"
  if (isRestDay && steps < currentGoals.max * 0.8) {
    return { kind: 'slow_down', reason: 'rest_day_overactivity' };
  }
  
  // Если к 18:00 шагов меньше 75% от min_steps
  if (currentHour >= 18 && steps < currentGoals.min * 0.75) {
    return { kind: 'go_walk', reason: 'low_steps_evening' };
  }
  
  // Если до 14:00 шагов больше max_steps
  if (currentHour <= 14 && steps > currentGoals.max) {
    return { kind: 'slow_down', reason: 'overactivity_morning' };
  }
  
  // Если в коридоре [min_steps, max_steps] к 20:00
  if (currentHour >= 20 && steps >= currentGoals.min && steps <= currentGoals.max) {
    return { kind: 'ok', reason: 'target_achieved' };
  }
  
  return { kind: 'ok', reason: 'default' };
}

async function getCurrentStepGoals() {
  // Анализируем все заметки и извлекаем актуальные цели
  const notes = await db.getHealthNotes();
  const goals = notes
    .map(note => note.parsed_data.stepGoals)
    .flat()
    .filter(goal => goal.isActive); // проверяем даты активности
  
  return {
    min: Math.min(...goals.map(g => g.min)),
    max: Math.max(...goals.map(g => g.max))
  };
}
```

## 📱 iOS App (SwiftUI + HealthKit)

### Структура проекта
```
apps/ios-health/
├── HealthApp/
│   ├── HealthApp.swift
│   ├── ContentView.swift
│   ├── HealthKitManager.swift
│   ├── APIClient.swift
│   └── Models/
│       ├── HealthData.swift
│       └── APIRequest.swift
```

### Основные компоненты

#### HealthKitManager.swift
```swift
class HealthKitManager: ObservableObject {
    private let healthStore = HKHealthStore()
    
    func requestPermissions() async throws {
        let typesToRead: Set<HKObjectType> = [
            HKQuantityType.quantityType(forIdentifier: .stepCount)!,
            HKCharacteristicType.characteristicType(forIdentifier: .dateOfBirth)!
        ]
        
        try await healthStore.requestAuthorization(toShare: nil, read: typesToRead)
    }
    
    func getAge() async throws -> Int {
        let dob = try healthStore.dateOfBirthComponents()
        let calendar = Calendar.current
        let age = calendar.dateComponents([.year], from: dob.date!, to: Date()).year!
        return age
    }
    
    func getTodaySteps() async throws -> Int {
        // Реализация получения шагов за сегодня
    }
    
    func getHourlySteps() async throws -> [Int] {
        // Реализация получения почасовых шагов
    }
}
```

#### APIClient.swift
```swift
class APIClient {
    private let baseURL = "http://localhost:3000"
    
    func sendHealthProfile(dob: Date) async throws {
        // POST /ingest/health/profile
    }
    
    func sendStepsData(items: [StepData]) async throws {
        // POST /ingest/health/steps
    }
}
```

## 🔧 Aggregator API (Node/TS + Fastify)

### Структура проекта
```
services/aggregator/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── notion.ts
│   │   └── metrics.ts
│   ├── services/
│   │   ├── database.ts
│   │   ├── healthService.ts
│   │   ├── notionService.ts
│   │   └── adviceService.ts
│   ├── models/
│   │   └── types.ts
│   └── utils/
│       └── cron.ts
├── migrations/
├── package.json
└── docker-compose.yml
```

### Основные эндпоинты

```typescript
// POST /ingest/health/profile
interface HealthProfileRequest {
  dob: string; // ISO date string
  apple_health_uid?: string;
}

// POST /ingest/health/steps
interface StepsDataRequest {
  items: Array<{
    ts: string; // ISO timestamp
    count_delta: number;
  }>;
}

// GET /metrics/daily?date=YYYY-MM-DD
interface DailyMetricsResponse {
  steps_total: number;
  steps_by_hour: Record<number, number>;
  policy: {
    min_steps: number;
    max_steps: number;
    is_rest_day: boolean;
  };
  status: 'go_walk' | 'slow_down' | 'ok';
}

// GET /advice/today
interface AdviceResponse {
  kind: 'go_walk' | 'slow_down' | 'ok';
  reason: string;
  message: string;
  current_steps: number;
  target_range: [number, number];
}
```

## 🔄 Notion Integration

### Сбор заметок из Notion
Из Notion собираем обычные заметки (страницы), а не структурированную базу данных. Система анализирует контент заметок и извлекает информацию о целях и политиках здоровья.

### Структура заметок в Notion
```
Заметки могут содержать:
├── Цели по шагам (например: "Цель: 8000-12000 шагов в день")
├── Дни отдыха (например: "Воскресенье - день отдыха")
├── Специальные правила (например: "Если больше 15000 шагов - сбавить темп")
└── Общие заметки о здоровье
```

### Синхронизация и парсинг
```typescript
class NotionService {
  async syncNotes() {
    // Получаем все страницы из указанной базы данных
    const pages = await this.notion.databases.query({
      database_id: process.env.NOTION_NOTES_DB_ID,
      filter: {
        property: 'Last edited time',
        last_edited_time: {
          on_or_after: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      }
    });
    
    // Парсим контент каждой страницы
    for (const page of pages.results) {
      const content = await this.extractPageContent(page.id);
      const parsedData = this.parseHealthContent(content);
      await this.db.upsertHealthNotes(parsedData);
    }
  }
  
  private parseHealthContent(content: string) {
    // Извлекаем цели по шагам
    const stepGoals = this.extractStepGoals(content);
    // Извлекаем дни отдыха
    const restDays = this.extractRestDays(content);
    // Извлекаем специальные правила
    const rules = this.extractHealthRules(content);
    
    return { stepGoals, restDays, rules };
  }
  
  private extractStepGoals(content: string) {
    // Парсим фразы типа "8000-12000 шагов", "минимум 6000", "максимум 15000"
    const stepPatterns = [
      /(\d+)-(\d+)\s*шагов?/gi,
      /минимум\s*(\d+)\s*шагов?/gi,
      /максимум\s*(\d+)\s*шагов?/gi,
      /цель:\s*(\d+)-(\d+)/gi
    ];
    
    // Возвращаем найденные цели
  }
}
```
```

## 🤖 Telegram Bot Integration

### Команды бота
```typescript
// /steps - текущие шаги и план
bot.command('steps', async (ctx) => {
  const metrics = await apiClient.getDailyMetrics();
  const message = `Сегодня ${metrics.steps_total} шагов\n` +
                  `План: ${metrics.policy.min_steps}-${metrics.policy.max_steps}\n` +
                  `Статус: ${getStatusEmoji(metrics.status)}`;
  await ctx.reply(message);
});

// /advice - текущий совет
bot.command('advice', async (ctx) => {
  const advice = await apiClient.getAdvice();
  await ctx.reply(advice.message);
});

// /plan - план на неделю
bot.command('plan', async (ctx) => {
  const plan = await apiClient.getWeeklyPlan();
  await ctx.reply(formatWeeklyPlan(plan));
});
```

### Cron задачи
```typescript
// Каждые 30 минут - пересчет дневных метрик
cron.schedule('*/30 * * * *', async () => {
  await healthService.recomputeDailyMetrics();
});

// 11:00 и 20:00 - отправка советов
cron.schedule('0 11,20 * * *', async () => {
  await adviceService.sendDailyAdvice();
});
```

## 📅 Пошаговый план работ

### День 1: iOS App Foundation
- [ ] Создать `apps/ios-health/` проект
- [ ] Настроить HealthKit capabilities
- [ ] Реализовать запрос разрешений
- [ ] Получение возраста и шагов за сегодня
- [ ] Подготовить JSON формат для API

### День 2: Aggregator API Foundation
- [ ] Создать `services/aggregator/` проект
- [ ] Настроить Fastify + TypeScript
- [ ] Поднять Postgres в Docker
- [ ] Создать миграции схемы
- [ ] Реализовать эндпоинты `/ingest/health/*`
- [ ] Запись в `steps_raw` и агрегация `steps_daily`

### День 3: Notion Integration
- [ ] Создать базу данных "Health Notes" в Notion
- [ ] Реализовать `NotionService` для парсинга заметок
- [ ] Эндпоинт `POST /sync/notion`
- [ ] Парсинг контента и извлечение целей
- [ ] Реализовать `GET /advice/today` с правилами из заметок

### День 4: Telegram Bot Integration
- [ ] Интегрировать команды в существующий WLNX бот
- [ ] Реализовать `/steps`, `/advice`, `/plan`
- [ ] Настроить cron на 11:00 и 20:00
- [ ] Логирование в `advice_log`
- [ ] Тестирование команд

### День 5: Polish & Testing
- [ ] Фоновая доставка HealthKit
- [ ] Тесты краевых случаев
- [ ] Мини-дашборд `/healthcheck`
- [ ] Обработка ошибок
- [ ] Документация API

## 🔧 Конфигурация

### .env файл
```bash
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/wlnx_health

# Notion
NOTION_TOKEN=secret_...
NOTION_NOTES_DB_ID=... # ID базы данных с заметками

# Telegram
TELEGRAM_BOT_TOKEN=...

# API
API_JWT_SECRET=...
TZ=Asia/Bangkok

# Health
HEALTH_API_URL=http://localhost:3000
```

### Docker Compose
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: wlnx_health
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  aggregator:
    build: ./services/aggregator
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://user:pass@postgres:5432/wlnx_health
    depends_on:
      - postgres

volumes:
  postgres_data:
```

## 🚀 Что дальше (расширения)

### Краткосрочные улучшения
- [ ] Цели по неделям/циклам из Notion
- [ ] "Темп к цели" и мягкие напоминания
- [ ] Сон/калории из HealthKit
- [ ] Более умные советы на основе нагрузки

### Интеграция с WLNX
- [ ] Исторические графики в WLNX портале
- [ ] Аналитика и тренды
- [ ] Семантические заметки о здоровье
- [ ] Qdrant для поиска по истории здоровья

## 🎯 Успешные метрики MVP

- [ ] iOS app отправляет данные в API
- [ ] Postgres хранит все метрики
- [ ] Notion синхронизация работает
- [ ] Telegram бот дает советы по расписанию
- [ ] Система работает стабильно 24/7

---

**Готов к реализации!** Этот MVP создаст прочную основу для будущей интеграции с полным WLNX порталом.

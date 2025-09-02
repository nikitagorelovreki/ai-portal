# Примеры заметок в Notion для Health MVP

## 📝 Структура заметок

### 1. Основные цели по шагам
```
Заголовок: "Цели по шагам на неделю"

Контент:
Цель: 8000-12000 шагов в день
Выходные: 6000-8000 шагов (дни отдыха)
Если больше 15000 шагов - сбавить темп на следующий день
```

### 2. Дни отдыха
```
Заголовок: "Расписание отдыха"

Контент:
Воскресенье - день отдыха
Среда - легкая активность
Пятница - можно больше шагов (до 14000)
```

### 3. Специальные правила
```
Заголовок: "Правила активности"

Контент:
Если устал - минимум 5000 шагов
Если болею - максимум 3000 шагов
Если тренировка - можно до 15000 шагов
```

### 4. Сезонные цели
```
Заголовок: "Летние цели"

Контент:
Июнь-август: 10000-14000 шагов
В жаркие дни: 6000-8000 шагов
Пляжные дни: минимум 8000 шагов
```

## 🔍 Парсинг паттернов

### Извлечение целей по шагам
```typescript
const stepPatterns = [
  /(\d+)-(\d+)\s*шагов?/gi,           // "8000-12000 шагов"
  /минимум\s*(\d+)\s*шагов?/gi,       // "минимум 6000 шагов"
  /максимум\s*(\d+)\s*шагов?/gi,      // "максимум 15000 шагов"
  /цель:\s*(\d+)-(\d+)/gi,            // "Цель: 8000-12000"
  /до\s*(\d+)\s*шагов?/gi,            // "до 14000 шагов"
  /можно\s*до\s*(\d+)/gi              // "можно до 15000"
];
```

### Извлечение дней отдыха
```typescript
const restDayPatterns = [
  /(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)\s*[-—]\s*день\s*отдыха/gi,
  /(пн|вт|ср|чт|пт|сб|вс)\s*[-—]\s*отдых/gi,
  /день\s*отдыха:\s*(.+)/gi
];
```

### Извлечение специальных правил
```typescript
const rulePatterns = [
  /если\s+(.+?)\s*[-—]\s*(.+)/gi,     // "Если устал - минимум 5000"
  /при\s+(.+?)\s*[-—]\s*(.+)/gi,      // "При болезни - максимум 3000"
  /когда\s+(.+?)\s*[-—]\s*(.+)/gi     // "Когда тренировка - до 15000"
];
```

## 📊 Структура parsed_data

```json
{
  "stepGoals": [
    {
      "min": 8000,
      "max": 12000,
      "condition": "default",
      "isActive": true
    },
    {
      "min": 6000,
      "max": 8000,
      "condition": "weekend",
      "isActive": true
    }
  ],
  "restDays": [
    {
      "day": "sunday",
      "description": "день отдыха"
    }
  ],
  "rules": [
    {
      "condition": "overactivity",
      "action": "slow_down",
      "threshold": 15000,
      "description": "сбавить темп на следующий день"
    }
  ]
}
```

## 🎯 Примеры использования

### Заметка: "Мои цели на эту неделю"
```
Цель: 8000-12000 шагов в день
Выходные: 6000-8000 шагов
Если больше 15000 - сбавить темп
Воскресенье - день отдыха
```

### Результат парсинга:
```json
{
  "stepGoals": [
    {"min": 8000, "max": 12000, "condition": "weekday"},
    {"min": 6000, "max": 8000, "condition": "weekend"}
  ],
  "restDays": [
    {"day": "sunday", "description": "день отдыха"}
  ],
  "rules": [
    {"condition": "overactivity", "threshold": 15000, "action": "slow_down"}
  ]
}
```

## 🔧 Интеграция с системой

### Обновление целей
```typescript
async function updateGoalsFromNotes() {
  const notes = await notionService.getHealthNotes();
  const currentGoals = parseGoalsFromNotes(notes);
  
  // Обновляем кэш целей
  await cache.set('current_goals', currentGoals, 3600); // 1 час
}

async function getCurrentGoals() {
  let goals = await cache.get('current_goals');
  if (!goals) {
    await updateGoalsFromNotes();
    goals = await cache.get('current_goals');
  }
  return goals;
}
```

### Генерация советов
```typescript
async function generateAdvice(steps: number, hour: number) {
  const goals = await getCurrentGoals();
  const isRestDay = checkIfRestDay();
  
  if (isRestDay && steps > goals.max * 0.8) {
    return {
      kind: 'slow_down',
      message: 'Сегодня день отдыха, сбавь темп!',
      reason: 'rest_day_overactivity'
    };
  }
  
  if (hour >= 18 && steps < goals.min * 0.75) {
    return {
      kind: 'go_walk',
      message: `Нужно еще ${goals.min - steps} шагов до цели!`,
      reason: 'low_steps_evening'
    };
  }
  
  // ... остальная логика
}
```

import { DatabaseService } from './database';

export interface DailyMetrics {
  steps_total: number;
  steps_by_hour: Record<number, number>;
  policy: {
    min_steps: number;
    max_steps: number;
    is_rest_day: boolean;
  };
  status: 'go_walk' | 'slow_down' | 'ok';
}

export interface Advice {
  kind: 'go_walk' | 'slow_down' | 'ok';
  reason: string;
  message: string;
  current_steps: number;
  target_range: [number, number];
}

export interface WeeklyPlan {
  days: Array<{
    date: string;
    day: string;
    min_steps: number;
    max_steps: number;
    is_rest_day: boolean;
    notes: string;
  }>;
}

export class AdviceService {
  constructor(private db: DatabaseService) {}

  async getDailyMetrics(date: string): Promise<DailyMetrics> {
    const userId = 1; // MVP: фиксированный пользователь
    const targetDate = new Date(date);
    
    // Получаем данные о шагах
    const dailySteps = await this.db.getDailySteps(userId, targetDate);
    const stepsTotal = dailySteps?.steps_total || 0;
    const stepsByHour = dailySteps?.steps_by_hour || {};

    // Получаем актуальные цели из заметок
    const currentGoals = await this.getCurrentGoals();
    const isRestDay = this.checkIfRestDay(targetDate);

    // Определяем статус
    const status = this.determineStatus(stepsTotal, currentGoals, isRestDay);

    return {
      steps_total: stepsTotal,
      steps_by_hour: stepsByHour,
      policy: {
        min_steps: currentGoals.min,
        max_steps: currentGoals.max,
        is_rest_day: isRestDay
      },
      status
    };
  }

  async getTodayAdvice(): Promise<Advice> {
    const today = new Date().toISOString().split('T')[0];
    const metrics = await this.getDailyMetrics(today);
    const currentHour = new Date().getHours();

    const advice = this.generateAdvice(metrics.steps_total, currentHour, metrics.policy);

    // Логируем совет
    await this.db.logAdvice({
      user_id: 1,
      date: new Date(today),
      kind: advice.kind,
      sent_at: new Date(),
      details: {
        steps: metrics.steps_total,
        hour: currentHour,
        reason: advice.reason
      }
    });

    return {
      ...advice,
      current_steps: metrics.steps_total,
      target_range: [metrics.policy.min_steps, metrics.policy.max_steps]
    };
  }

  async getWeeklyPlan(): Promise<WeeklyPlan> {
    const currentGoals = await this.getCurrentGoals();
    const days: WeeklyPlan['days'] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const dayName = date.toLocaleDateString('ru-RU', { weekday: 'long' });
      const isRestDay = this.checkIfRestDay(date);
      
      days.push({
        date: date.toISOString().split('T')[0],
        day: dayName,
        min_steps: isRestDay ? Math.floor(currentGoals.min * 0.7) : currentGoals.min,
        max_steps: isRestDay ? Math.floor(currentGoals.max * 0.8) : currentGoals.max,
        is_rest_day: isRestDay,
        notes: isRestDay ? 'День отдыха' : ''
      });
    }

    return { days };
  }

  private async getCurrentGoals(): Promise<{ min: number; max: number }> {
    const notes = await this.db.getHealthNotes(1);
    
    if (notes.length === 0) {
      // Дефолтные цели если нет заметок
      return { min: 8000, max: 12000 };
    }

    const allGoals = notes
      .map(note => note.parsed_data.stepGoals)
      .flat()
      .filter(goal => goal.isActive);

    if (allGoals.length === 0) {
      return { min: 8000, max: 12000 };
    }

    // Берем самые строгие цели
    const min = Math.max(...allGoals.map(g => g.min));
    const max = Math.min(...allGoals.map(g => g.max));

    return { min, max };
  }

  private checkIfRestDay(date: Date): boolean {
    const dayOfWeek = date.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[dayOfWeek];

    // Проверяем заметки на предмет дней отдыха
    // Для MVP используем простую логику
    return currentDay === 'sunday'; // Воскресенье - день отдыха по умолчанию
  }

  private determineStatus(
    steps: number, 
    goals: { min: number; max: number }, 
    isRestDay: boolean
  ): 'go_walk' | 'slow_down' | 'ok' {
    if (isRestDay && steps > goals.max * 0.8) {
      return 'slow_down';
    }
    
    if (steps < goals.min * 0.75) {
      return 'go_walk';
    }
    
    if (steps > goals.max) {
      return 'slow_down';
    }
    
    return 'ok';
  }

  private generateAdvice(
    steps: number, 
    hour: number, 
    policy: { min_steps: number; max_steps: number; is_rest_day: boolean }
  ): { kind: 'go_walk' | 'slow_down' | 'ok'; reason: string; message: string } {
    
    // Если день отдыха и много шагов
    if (policy.is_rest_day && steps > policy.max_steps * 0.8) {
      return {
        kind: 'slow_down',
        reason: 'rest_day_overactivity',
        message: 'Сегодня день отдыха! Сбавь темп и отдохни.'
      };
    }

    // Если к 18:00 шагов меньше 75% от цели
    if (hour >= 18 && steps < policy.min_steps * 0.75) {
      const needed = policy.min_steps - steps;
      return {
        kind: 'go_walk',
        reason: 'low_steps_evening',
        message: `Нужно еще ${needed} шагов до цели! Пройдись вечером.`
      };
    }

    // Если до 14:00 шагов больше максимума
    if (hour <= 14 && steps > policy.max_steps) {
      return {
        kind: 'slow_down',
        reason: 'overactivity_morning',
        message: 'Ты уже превысил дневную норму! Сбавь активность.'
      };
    }

    // Если в коридоре целей к 20:00
    if (hour >= 20 && steps >= policy.min_steps && steps <= policy.max_steps) {
      return {
        kind: 'ok',
        reason: 'target_achieved',
        message: `Отлично! ${steps} шагов - идеальный результат! 🎉`
      };
    }

    // Дефолтный совет
    if (steps < policy.min_steps) {
      const needed = policy.min_steps - steps;
      return {
        kind: 'go_walk',
        reason: 'below_target',
        message: `Нужно еще ${needed} шагов до цели.`
      };
    }

    if (steps > policy.max_steps) {
      return {
        kind: 'slow_down',
        reason: 'above_target',
        message: 'Ты превысил дневную норму. Отдохни!'
      };
    }

    return {
      kind: 'ok',
      reason: 'on_target',
      message: `Хорошо! ${steps} шагов - в пределах нормы.`
    };
  }
}

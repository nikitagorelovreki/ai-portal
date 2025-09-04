import { DatabaseService } from './database';

export class HealthService {
  constructor(private db: DatabaseService) {}

  async updateUserProfile(dob: string, apple_health_uid?: string): Promise<number> {
    // Для MVP используем фиксированный tg_chat_id = 1
    const tg_chat_id = 1;
    
    let user = await this.db.getUserByTgChatId(tg_chat_id);
    
    if (!user) {
      const userId = await this.db.createUser(tg_chat_id, apple_health_uid, new Date(dob));
      return userId;
    } else {
      if (dob) {
        await this.db.updateUserDob(user.id, new Date(dob));
      }
      return user.id;
    }
  }

  async ingestStepsData(items: Array<{ ts: string; count_delta: number }>): Promise<void> {
    // Для MVP используем фиксированный user_id = 1
    const userId = 1;
    
    const processedItems = items.map(item => ({
      ts: new Date(item.ts),
      count_delta: item.count_delta
    }));

    await this.db.insertStepsRaw(userId, processedItems);
    
    // Пересчитываем дневные агрегаты
    await this.recomputeDailyMetrics(userId);
  }

  async recomputeDailyMetrics(userId: number): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Получаем сырые данные за сегодня
    const result = await (this.db as any).pool.query(
      `SELECT 
        EXTRACT(HOUR FROM ts) as hour,
        SUM(count_delta) as steps
       FROM steps_raw 
       WHERE user_id = $1 
         AND ts >= $2 
         AND ts < $2 + INTERVAL '1 day'
       GROUP BY EXTRACT(HOUR FROM ts)
       ORDER BY hour`,
      [userId, today]
    );

    // Собираем почасовые данные
    const stepsByHour: Record<number, number> = {};
    let stepsTotal = 0;

    for (let hour = 0; hour < 24; hour++) {
      const hourData = result.rows.find((row: any) => row.hour === hour);
      const steps = hourData ? parseInt(hourData.steps) : 0;
      stepsByHour[hour] = steps;
      stepsTotal += steps;
    }

    // Сохраняем агрегаты
    await this.db.upsertDailySteps(userId, today, stepsTotal, stepsByHour);
  }
}

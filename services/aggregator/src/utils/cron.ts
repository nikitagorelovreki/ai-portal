import * as cron from 'node-cron';
import { DatabaseService } from '../services/database';
import { HealthService } from '../services/healthService';
import { AdviceService } from '../services/adviceService';

export class CronService {
  private healthService: HealthService;
  private adviceService: AdviceService;

  constructor(private db: DatabaseService) {
    this.healthService = new HealthService(db);
    this.adviceService = new AdviceService(db);
  }

  start(): void {
    console.log('🕐 Starting cron jobs...');

    // Каждые 30 минут - пересчет дневных метрик
    cron.schedule('*/30 * * * *', async () => {
      try {
        console.log('📊 Recomputing daily metrics...');
        await this.healthService.recomputeDailyMetrics(1); // user_id = 1 для MVP
        console.log('✅ Daily metrics updated');
      } catch (error) {
        console.error('❌ Error recomputing daily metrics:', error);
      }
    });

    // 11:00 - утренний совет
    cron.schedule('0 11 * * *', async () => {
      try {
        console.log('🌅 Sending morning advice...');
        const advice = await this.adviceService.getTodayAdvice();
        console.log('✅ Morning advice sent:', advice.message);
        
        // TODO: Отправить в Telegram бот
        // await this.sendTelegramAdvice(advice);
      } catch (error) {
        console.error('❌ Error sending morning advice:', error);
      }
    });

    // 20:00 - вечерний совет
    cron.schedule('0 20 * * *', async () => {
      try {
        console.log('🌙 Sending evening advice...');
        const advice = await this.adviceService.getTodayAdvice();
        console.log('✅ Evening advice sent:', advice.message);
        
        // TODO: Отправить в Telegram бот
        // await this.sendTelegramAdvice(advice);
      } catch (error) {
        console.error('❌ Error sending evening advice:', error);
      }
    });

    // Каждый час - проверка синхронизации Notion (если нужно)
    cron.schedule('0 * * * *', async () => {
      try {
        console.log('🔄 Checking Notion sync status...');
        // TODO: Проверить статус синхронизации и при необходимости запустить
        // await this.checkNotionSync();
      } catch (error) {
        console.error('❌ Error checking Notion sync:', error);
      }
    });

    console.log('✅ Cron jobs started');
  }

  stop(): void {
    console.log('🛑 Stopping cron jobs...');
    cron.getTasks().forEach(task => task.stop());
    console.log('✅ Cron jobs stopped');
  }

  // TODO: Метод для отправки советов в Telegram
  private async sendTelegramAdvice(advice: any): Promise<void> {
    // Здесь будет интеграция с Telegram ботом
    console.log('📱 Would send to Telegram:', advice.message);
  }

  // TODO: Метод для проверки синхронизации Notion
  private async checkNotionSync(): Promise<void> {
    // Здесь будет логика проверки необходимости синхронизации
    console.log('📝 Checking if Notion sync is needed...');
  }
}

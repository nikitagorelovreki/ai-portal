import { Pool, PoolClient } from 'pg';

export interface User {
  id: number;
  tg_chat_id: number;
  apple_health_uid?: string;
  dob?: Date;
  created_at: Date;
}

export interface StepsRaw {
  id: number;
  user_id: number;
  ts: Date;
  count_delta: number;
  source: string;
  created_at: Date;
}

export interface StepsDaily {
  id: number;
  user_id: number;
  date: Date;
  steps_total: number;
  steps_by_hour: Record<number, number>;
  created_at: Date;
  updated_at: Date;
}

export interface HealthNote {
  id: number;
  user_id: number;
  notion_page_id: string;
  title: string;
  content: string;
  parsed_data: {
    stepGoals: Array<{
      min: number;
      max: number;
      condition: string;
      isActive: boolean;
    }>;
    restDays: Array<{
      day: string;
      description: string;
    }>;
    rules: Array<{
      condition: string;
      action: string;
      threshold?: number;
      description: string;
    }>;
  };
  last_edited: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AdviceLog {
  id: number;
  user_id: number;
  date: Date;
  kind: 'go_walk' | 'slow_down' | 'ok';
  sent_at: Date;
  details: Record<string, any>;
  created_at: Date;
}

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async connect(): Promise<void> {
    try {
      await this.pool.query('SELECT NOW()');
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  // User methods
  async createUser(tg_chat_id: number, apple_health_uid?: string, dob?: Date): Promise<number> {
    const result = await this.pool.query(
      'INSERT INTO users (tg_chat_id, apple_health_uid, dob) VALUES ($1, $2, $3) RETURNING id',
      [tg_chat_id, apple_health_uid, dob]
    );
    return result.rows[0].id;
  }

  async getUserByTgChatId(tg_chat_id: number): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE tg_chat_id = $1',
      [tg_chat_id]
    );
    return result.rows[0] || null;
  }

  async updateUserDob(userId: number, dob: Date): Promise<void> {
    await this.pool.query(
      'UPDATE users SET dob = $1 WHERE id = $2',
      [dob, userId]
    );
  }

  // Steps methods
  async insertStepsRaw(userId: number, items: Array<{ ts: Date; count_delta: number }>): Promise<void> {
    const values = items.map((item, index) => 
      `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`
    ).join(', ');
    
    const params = items.flatMap(item => [userId, item.ts, item.count_delta]);
    
    await this.pool.query(
      `INSERT INTO steps_raw (user_id, ts, count_delta) VALUES ${values}`,
      params
    );
  }

  async getDailySteps(userId: number, date: Date): Promise<StepsDaily | null> {
    const result = await this.pool.query(
      'SELECT * FROM steps_daily WHERE user_id = $1 AND date = $2',
      [userId, date]
    );
    return result.rows[0] || null;
  }

  async upsertDailySteps(userId: number, date: Date, stepsTotal: number, stepsByHour: Record<number, number>): Promise<void> {
    await this.pool.query(
      `INSERT INTO steps_daily (user_id, date, steps_total, steps_by_hour) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, date) 
       DO UPDATE SET steps_total = $3, steps_by_hour = $4, updated_at = NOW()`,
      [userId, date, stepsTotal, JSON.stringify(stepsByHour)]
    );
  }

  // Health notes methods
  async upsertHealthNote(note: Omit<HealthNote, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
    await this.pool.query(
      `INSERT INTO health_notes (user_id, notion_page_id, title, content, parsed_data, last_edited) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (notion_page_id) 
       DO UPDATE SET title = $3, content = $4, parsed_data = $5, last_edited = $6, updated_at = NOW()`,
      [note.user_id, note.notion_page_id, note.title, note.content, JSON.stringify(note.parsed_data), note.last_edited]
    );
  }

  async getHealthNotes(userId: number): Promise<HealthNote[]> {
    const result = await this.pool.query(
      'SELECT * FROM health_notes WHERE user_id = $1 ORDER BY last_edited DESC',
      [userId]
    );
    return result.rows;
  }

  // Advice methods
  async logAdvice(advice: Omit<AdviceLog, 'id' | 'created_at'>): Promise<void> {
    await this.pool.query(
      'INSERT INTO advice_log (user_id, date, kind, sent_at, details) VALUES ($1, $2, $3, $4, $5)',
      [advice.user_id, advice.date, advice.kind, advice.sent_at, JSON.stringify(advice.details)]
    );
  }

  async getAdviceLog(userId: number, date: Date): Promise<AdviceLog[]> {
    const result = await this.pool.query(
      'SELECT * FROM advice_log WHERE user_id = $1 AND date = $2 ORDER BY sent_at DESC',
      [userId, date]
    );
    return result.rows;
  }
}

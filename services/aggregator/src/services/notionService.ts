import { Client } from '@notionhq/client';
import { DatabaseService, HealthNote } from './database';

export interface ParsedHealthData {
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
}

export class NotionService {
  private notion: Client;

  constructor(private db: DatabaseService) {
    this.notion = new Client({
      auth: process.env.NOTION_API_KEY || process.env.NOTION_TOKEN,
    });
  }

  async syncNotes(): Promise<{ syncedPages: number; parsedGoals: any[] }> {
    try {
      // Получаем все страницы из базы данных
      const pages = await this.notion.databases.query({
        database_id: process.env.NOTION_NOTES_DB_ID!,
        filter: {
          property: 'Last edited time',
          last_edited_time: {
            on_or_after: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      });

      let syncedPages = 0;
      const allParsedGoals: any[] = [];

      // Обрабатываем каждую страницу
      for (const page of pages.results) {
        const content = await this.extractPageContent(page.id);
        const parsedData = this.parseHealthContent(content);
        
        if (parsedData.stepGoals.length > 0 || parsedData.restDays.length > 0 || parsedData.rules.length > 0) {
          await this.db.upsertHealthNote({
            user_id: 1, // MVP: фиксированный пользователь
            notion_page_id: page.id,
            title: this.getPageTitle(page),
            content: content,
            parsed_data: parsedData,
            last_edited: new Date((page as any).last_edited_time || Date.now())
          });
          
          syncedPages++;
          allParsedGoals.push(...parsedData.stepGoals);
        }
      }

      return { syncedPages, parsedGoals: allParsedGoals };
    } catch (error) {
      console.error('Error syncing Notion notes:', error);
      throw error;
    }
  }

  async getSyncStatus(): Promise<{ lastSync: Date; totalNotes: number; activeGoals: number }> {
    const notes = await this.db.getHealthNotes(1);
    const activeGoals = notes.reduce((count, note) => {
      return count + note.parsed_data.stepGoals.filter(goal => goal.isActive).length;
    }, 0);

    return {
      lastSync: new Date(),
      totalNotes: notes.length,
      activeGoals
    };
  }

  private async extractPageContent(pageId: string): Promise<string> {
    const blocks = await this.notion.blocks.children.list({
      block_id: pageId,
    });

    let content = '';
    for (const block of blocks.results) {
      if ('type' in block) {
        switch (block.type) {
          case 'paragraph':
            content += block.paragraph.rich_text.map(text => text.plain_text).join('') + '\n';
            break;
          case 'heading_1':
            content += block.heading_1.rich_text.map(text => text.plain_text).join('') + '\n';
            break;
          case 'heading_2':
            content += block.heading_2.rich_text.map(text => text.plain_text).join('') + '\n';
            break;
          case 'heading_3':
            content += block.heading_3.rich_text.map(text => text.plain_text).join('') + '\n';
            break;
          case 'bulleted_list_item':
            content += '- ' + block.bulleted_list_item.rich_text.map(text => text.plain_text).join('') + '\n';
            break;
          case 'numbered_list_item':
            content += '1. ' + block.numbered_list_item.rich_text.map(text => text.plain_text).join('') + '\n';
            break;
        }
      }
    }
    return content;
  }

  private getPageTitle(page: any): string {
    if (page.properties.Title && page.properties.Title.title) {
      return page.properties.Title.title[0]?.plain_text || 'Untitled';
    }
    if (page.properties.Name && page.properties.Name.title) {
      return page.properties.Name.title[0]?.plain_text || 'Untitled';
    }
    return 'Untitled';
  }

  private parseHealthContent(content: string): ParsedHealthData {
    const stepGoals = this.extractStepGoals(content);
    const restDays = this.extractRestDays(content);
    const rules = this.extractHealthRules(content);

    return { stepGoals, restDays, rules };
  }

  private extractStepGoals(content: string): ParsedHealthData['stepGoals'] {
    const goals: ParsedHealthData['stepGoals'] = [];
    
    // Паттерны для поиска целей по шагам
    const patterns = [
      { regex: /(\d+)-(\d+)\s*шагов?/gi, condition: 'default' },
      { regex: /минимум\s*(\d+)\s*шагов?/gi, condition: 'minimum' },
      { regex: /максимум\s*(\d+)\s*шагов?/gi, condition: 'maximum' },
      { regex: /цель:\s*(\d+)-(\d+)/gi, condition: 'target' },
      { regex: /до\s*(\d+)\s*шагов?/gi, condition: 'max' },
      { regex: /можно\s*до\s*(\d+)/gi, condition: 'flexible' }
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        if (pattern.condition === 'default' || pattern.condition === 'target') {
          goals.push({
            min: parseInt(match[1]),
            max: parseInt(match[2]),
            condition: pattern.condition,
            isActive: true
          });
        } else if (pattern.condition === 'minimum') {
          goals.push({
            min: parseInt(match[1]),
            max: parseInt(match[1]) * 1.5, // Примерная оценка максимума
            condition: pattern.condition,
            isActive: true
          });
        } else if (pattern.condition === 'maximum' || pattern.condition === 'max') {
          goals.push({
            min: parseInt(match[1]) * 0.7, // Примерная оценка минимума
            max: parseInt(match[1]),
            condition: pattern.condition,
            isActive: true
          });
        }
      }
    }

    return goals;
  }

  private extractRestDays(content: string): ParsedHealthData['restDays'] {
    const restDays: ParsedHealthData['restDays'] = [];
    
    const dayPatterns = [
      { regex: /(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)\s*[-—]\s*день\s*отдыха/gi, day: 'monday' },
      { regex: /(пн|вт|ср|чт|пт|сб|вс)\s*[-—]\s*отдых/gi, day: 'monday' },
      { regex: /день\s*отдыха:\s*(.+)/gi, day: 'sunday' }
    ];

    const dayMapping: Record<string, string> = {
      'понедельник': 'monday',
      'вторник': 'tuesday', 
      'среда': 'wednesday',
      'четверг': 'thursday',
      'пятница': 'friday',
      'суббота': 'saturday',
      'воскресенье': 'sunday',
      'пн': 'monday',
      'вт': 'tuesday',
      'ср': 'wednesday',
      'чт': 'thursday',
      'пт': 'friday',
      'сб': 'saturday',
      'вс': 'sunday'
    };

    for (const pattern of dayPatterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const day = dayMapping[match[1]?.toLowerCase()] || pattern.day;
        restDays.push({
          day,
          description: match[0]
        });
      }
    }

    return restDays;
  }

  private extractHealthRules(content: string): ParsedHealthData['rules'] {
    const rules: ParsedHealthData['rules'] = [];
    
    const rulePatterns = [
      { regex: /если\s+(.+?)\s*[-—]\s*(.+)/gi, type: 'conditional' },
      { regex: /при\s+(.+?)\s*[-—]\s*(.+)/gi, type: 'situational' },
      { regex: /когда\s+(.+?)\s*[-—]\s*(.+)/gi, type: 'temporal' }
    ];

    for (const pattern of rulePatterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const condition = match[1].trim();
        const action = match[2].trim();
        
        // Извлекаем пороговые значения
        const thresholdMatch = action.match(/(\d+)/);
        const threshold = thresholdMatch ? parseInt(thresholdMatch[1]) : undefined;
        
        rules.push({
          condition: condition,
          action: action,
          threshold,
          description: `${condition} - ${action}`
        });
      }
    }

    return rules;
  }
}

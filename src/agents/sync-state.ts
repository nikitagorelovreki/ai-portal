import { QdrantClient } from '@qdrant/js-client-rest';
import { COLLECTION_NAME, SYNC_STATE_ID } from '../constants';

interface SyncState {
  lastSyncTime: string;
  processedPages: string[];
  totalDocuments: number;
  totalEmbeddings: number;
}

export class SyncStateManager {
  private qdrant: QdrantClient;
  private collectionName: string;

  constructor(qdrant: QdrantClient, collectionName: string = 'aiportal-data') {
    this.qdrant = qdrant;
    this.collectionName = collectionName;
  }

  private async loadState(): Promise<SyncState> {
    try {
      const response = await this.qdrant.retrieve(this.collectionName, {
        ids: [SYNC_STATE_ID],
      });

             if (response.length > 0 && response[0].payload) {
         const payload = response[0].payload as any;
         return {
           lastSyncTime: payload.lastSyncTime || new Date(0).toISOString(),
           processedPages: payload.processedPages || [],
           totalDocuments: payload.totalDocuments || 0,
           totalEmbeddings: payload.totalEmbeddings || 0,
         };
       }
    } catch (error) {
      console.log('No previous sync state found, starting fresh');
    }

    return {
      lastSyncTime: new Date(0).toISOString(),
      processedPages: [],
      totalDocuments: 0,
      totalEmbeddings: 0,
    };
  }

  async getState(): Promise<SyncState> {
    return await this.loadState();
  }

  async updateState(updates: Partial<SyncState>): Promise<void> {
    const currentState = await this.loadState();
    const newState = { ...currentState, ...updates };

    // Store sync state as a special document in Qdrant
    await this.qdrant.upsert(this.collectionName, {
      points: [{
        id: SYNC_STATE_ID,
        vector: new Array(1536).fill(0), // Dummy vector for sync state (OpenAI dimensions)
        payload: newState,
      }],
    });
  }

  async clearState(): Promise<void> {
    const emptyState: SyncState = {
      lastSyncTime: new Date(0).toISOString(),
      processedPages: [],
      totalDocuments: 0,
      totalEmbeddings: 0,
    };

    await this.updateState(emptyState);
  }

  async isPageProcessed(pageId: string): Promise<boolean> {
    const state = await this.loadState();
    return state.processedPages.includes(pageId);
  }

  async markPageProcessed(pageId: string): Promise<void> {
    const state = await this.loadState();
    if (!state.processedPages.includes(pageId)) {
      state.processedPages.push(pageId);
      await this.updateState(state);
    }
  }

  async getSyncStatus(): Promise<{
    lastSyncTime: string;
    processedPages: number;
    totalDocuments: number;
    totalEmbeddings: number;
  }> {
    const state = await this.loadState();
    return {
      lastSyncTime: state.lastSyncTime,
      processedPages: state.processedPages.length,
      totalDocuments: state.totalDocuments,
      totalEmbeddings: state.totalEmbeddings,
    };
  }
} 
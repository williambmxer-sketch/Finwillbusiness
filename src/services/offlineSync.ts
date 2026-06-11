import { api, mappers } from './api';
import { supabase } from '../lib/supabase';

interface QueuedMutation {
  id: string;
  timestamp: number;
  collection: string;
  action: 'insert' | 'update' | 'delete' | 'bulkInsert';
  payload: any;
  recordId?: string; // Para updates e deletes
}

const SYNC_QUEUE_KEY = 'financas_sync_queue';

export const offlineSync = {
  getQueue: (): QueuedMutation[] => {
    try {
      const stored = localStorage.getItem(SYNC_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  getOptimisticTransactions: (): any[] => {
    const queue = offlineSync.getQueue();
    const transactions: any[] = [];
    for (const item of queue) {
      if (item.collection === 'transacoes') {
        if (item.action === 'insert') {
          transactions.push(item.payload);
        } else if (item.action === 'bulkInsert') {
          transactions.push(...item.payload);
        }
      }
    }
    return transactions;
  },

  setQueue: (queue: QueuedMutation[]) => {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  },

  queueMutation: (mutation: Omit<QueuedMutation, 'id' | 'timestamp'>) => {
    const queue = offlineSync.getQueue();
    queue.push({
      ...mutation,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    });
    offlineSync.setQueue(queue);
    
    // Tenta processar caso já esteja online
    if (navigator.onLine) {
      offlineSync.processQueue();
    }
  },

  processQueue: async () => {
    const queue = offlineSync.getQueue();
    if (queue.length === 0) return;
    if (!navigator.onLine) return;

    console.log(`[OfflineSync] Processando ${queue.length} operações em fila...`);
    
    // Processamos um a um para garantir a ordem
    const failed: QueuedMutation[] = [];
    
    for (const item of queue) {
      try {
        if (item.action === 'insert') {
          await supabase.from(item.collection).insert(item.payload);
        } else if (item.action === 'bulkInsert') {
          await supabase.from(item.collection).insert(item.payload);
        } else if (item.action === 'update' && item.recordId) {
          await supabase.from(item.collection).update(item.payload).eq('id', item.recordId);
        } else if (item.action === 'delete' && item.recordId) {
          await supabase.from(item.collection).delete().eq('id', item.recordId);
        }
      } catch (err: any) {
        console.error(`[OfflineSync] Erro ao sincronizar item ${item.id}:`, err);
        // Se falhou novamente por rede, re-enfileira. Se foi bad request, descartamos para não travar a fila.
        if (err.message && (err.message.includes('fetch') || err.message.includes('network'))) {
          failed.push(item);
        }
      }
    }

    offlineSync.setQueue(failed);
    if (failed.length === 0) {
      console.log('[OfflineSync] Sincronização concluída com sucesso!');
    }
  },

  setupListeners: () => {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', offlineSync.processQueue);
      
      // Tenta rodar ao inicializar
      setTimeout(offlineSync.processQueue, 2000);
    }
  }
};

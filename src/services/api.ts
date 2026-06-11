import { supabase } from '../lib/supabase';
import { Account, Card, Category, Transaction, Invoice, CustomPaymentMethod } from '../db/db';
import { offlineSync } from './offlineSync';

// Initialize offline listeners
offlineSync.setupListeners();

/**
 * MAPPERS: Translate Supabase PT-BR to Frontend EN-US and vice versa
 */

export const mappers = {
  category: {
    toApp: (row: any): Category => ({
      id: row.id,
      name: row.nome,
      icon: row.icone,
      color: row.cor,
      type: row.tipo,
      showInCards: row.mostrar_em_cartoes ?? true,
      showInAccounts: row.mostrar_em_contas ?? true,
    }),
    toDb: (obj: Partial<Category>) => ({
      nome: obj.name,
      icone: obj.icon,
      cor: obj.color,
      tipo: obj.type,
      mostrar_em_cartoes: obj.showInCards ?? true,
      mostrar_em_contas: obj.showInAccounts ?? true,
    })
  },
  account: {
    toApp: (row: any): Account => ({
      id: row.id,
      name: row.nome,
      type: row.tipo,
      balance: Number(row.saldo),
      color: row.cor,
      icon: row.icone,
    }),
    toDb: (obj: Partial<Account>) => ({
      nome: obj.name,
      tipo: obj.type,
      saldo: obj.balance,
      cor: obj.color,
      icone: obj.icon,
    })
  },
  card: {
    toApp: (row: any): Card => ({
      id: row.id,
      name: row.nome,
      brand: row.bandeira,
      color: row.cor,
      limit: Number(row.limite_credito),
      closingDay: row.dia_fechamento,
      dueDay: row.dia_vencimento,
      bank: row.banco,
      lastFour: row.ultimos_quatro,
    }),
    toDb: (obj: Partial<Card>) => ({
      nome: obj.name,
      bandeira: obj.brand,
      cor: obj.color,
      limite_credito: obj.limit,
      dia_fechamento: obj.closingDay,
      dia_vencimento: obj.dueDay,
      banco: obj.bank,
      ultimos_quatro: obj.lastFour,
    })
  },
  transaction: {
    toApp: (row: any): Transaction => ({
      id: row.id,
      description: row.descricao,
      amount: Number(row.valor),
      date: new Date(row.data),
      type: row.tipo,
      categoryId: row.categoria_id,
      accountId: row.conta_id || undefined,
      cardId: row.cartao_id || undefined,
      installments: row.parcelas || undefined,
      currentInstallment: row.parcela_atual || undefined,
      parentId: row.transacao_pai_id || undefined,
      isPaid: row.esta_pago,
      paymentDate: row.data_pagamento ? new Date(row.data_pagamento) : undefined,
      notes: row.observacoes || undefined,
      createdAt: row.criado_em,
    }),
    toDb: (obj: Partial<Transaction>) => ({
      descricao: obj.description,
      valor: obj.amount,
      data: obj.date?.toISOString(),
      tipo: obj.type,
      categoria_id: obj.categoryId,
      conta_id: obj.accountId || null,
      cartao_id: obj.cardId || null,
      parcelas: obj.installments || null,
      parcela_atual: obj.currentInstallment || null,
      transacao_pai_id: obj.parentId || null,
      esta_pago: obj.isPaid,
      data_pagamento: obj.paymentDate?.toISOString() || null,
      observacoes: obj.notes || null,
    })
  },
  paymentMethod: {
    toApp: (row: any): CustomPaymentMethod => ({
      id: row.id,
      name: row.nome,
      debitFromAccount: row.debitar_conta,
    }),
    toDb: (obj: Partial<CustomPaymentMethod>) => ({
      nome: obj.name,
      debitar_conta: obj.debitFromAccount,
    })
  }
};

/**
 * REPOSITORY METHODS
 */

const getUserId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
};

const notifyMutation = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('db_mutation'));
  }
};

export const api = {
  categories: {
    list: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from('categorias').select('*');
      if (error) throw error;
      return (data || []).map(mappers.category.toApp);
    },
    add: async (category: Omit<Category, 'id'>) => {
      const userId = await getUserId();
      const { data, error } = await supabase.from('categorias').insert({
        ...mappers.category.toDb(category),
        usuario_id: userId
      }).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.category.toApp(data);
    },
    update: async (id: string, category: Partial<Category>) => {
      const { data, error } = await supabase.from('categorias').update(mappers.category.toDb(category)).eq('id', id).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.category.toApp(data);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('categorias').delete().eq('id', id);
      if (error) throw error;
      notifyMutation();
    }
  },

  accounts: {
    list: async (): Promise<Account[]> => {
      const { data, error } = await supabase.from('contas').select('*');
      if (error) throw error;
      return (data || []).map(mappers.account.toApp);
    },
    add: async (account: Omit<Account, 'id'>) => {
      const userId = await getUserId();
      const { data, error } = await supabase.from('contas').insert({
        ...mappers.account.toDb(account),
        usuario_id: userId
      }).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.account.toApp(data);
    },
    update: async (id: string, account: Partial<Account>) => {
      const { data, error } = await supabase.from('contas').update(mappers.account.toDb(account)).eq('id', id).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.account.toApp(data);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('contas').delete().eq('id', id);
      if (error) throw error;
      notifyMutation();
    }
  },

  cards: {
    list: async (): Promise<Card[]> => {
      const { data, error } = await supabase.from('cartoes').select('*');
      if (error) throw error;
      return (data || []).map(mappers.card.toApp);
    },
    add: async (card: Omit<Card, 'id'>) => {
      const userId = await getUserId();
      const { data, error } = await supabase.from('cartoes').insert({
        ...mappers.card.toDb(card),
        usuario_id: userId
      }).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.card.toApp(data);
    },
    update: async (id: string, card: Partial<Card>) => {
      const { data, error } = await supabase.from('cartoes').update(mappers.card.toDb(card)).eq('id', id).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.card.toApp(data);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('cartoes').delete().eq('id', id);
      if (error) throw error;
      notifyMutation();
    }
  },

  transactions: {
    list: async (): Promise<Transaction[]> => {
      let remoteData: any[] = [];
      try {
        const { data, error } = await supabase.from('transacoes').select('*');
        if (error) throw error;
        remoteData = data || [];
      } catch (err: any) {
        if (!navigator.onLine || (err.message && err.message.includes('fetch'))) {
          console.log('[API] Usando transações em cache devido a falha de rede');
        } else {
          throw err;
        }
      }
      
      // Merge com cache otimista local
      const optimisticData = offlineSync.getOptimisticTransactions();
      const allData = [...remoteData, ...optimisticData];
      
      return allData.map(row => {
        // Se for do otimista, ele já pode ter vindo no formato "Db".
        // Se a chave for minúscula (ex: valor), passa no mapper, senão mapeia manual.
        if ('valor' in row) return mappers.transaction.toApp(row);
        // Fallback pra caso o optimisticData tenha estrutura incompleta:
        return mappers.transaction.toApp(row); 
      });
    },
    add: async (transaction: Omit<Transaction, 'id'>) => {
      const userId = await getUserId();
      const payload = {
        ...mappers.transaction.toDb(transaction),
        usuario_id: userId
      };

      try {
        const { data, error } = await supabase.from('transacoes').insert(payload).select().single();
        if (error) throw error;
        notifyMutation();
        return mappers.transaction.toApp(data);
      } catch (err: any) {
        if (!navigator.onLine || (err.message && err.message.includes('fetch'))) {
          offlineSync.queueMutation({ collection: 'transacoes', action: 'insert', payload });
          notifyMutation();
          return { ...transaction, id: 'temp-' + Date.now() } as Transaction;
        }
        throw err;
      }
    },
    bulkAdd: async (transactions: Omit<Transaction, 'id'>[]) => {
      const userId = await getUserId();
      const payload = transactions.map(t => ({
        ...mappers.transaction.toDb(t),
        usuario_id: userId
      }));

      try {
        const { data, error } = await supabase.from('transacoes').insert(payload).select();
        if (error) throw error;
        notifyMutation();
        return (data || []).map(mappers.transaction.toApp);
      } catch (err: any) {
        if (!navigator.onLine || (err.message && err.message.includes('fetch'))) {
          offlineSync.queueMutation({ collection: 'transacoes', action: 'bulkInsert', payload });
          notifyMutation();
          return transactions.map((t, i) => ({ ...t, id: 'temp-' + Date.now() + '-' + i })) as Transaction[];
        }
        throw err;
      }
    },
    update: async (id: string, transaction: Partial<Transaction>) => {
      const { data, error } = await supabase.from('transacoes').update(mappers.transaction.toDb(transaction)).eq('id', id).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.transaction.toApp(data);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('transacoes').delete().eq('id', id);
      if (error) throw error;
      notifyMutation();
    }
  },

  paymentMethods: {
    list: async (): Promise<CustomPaymentMethod[]> => {
      const { data, error } = await supabase.from('formas_pagamento').select('*');
      if (error) throw error;
      return (data || []).map(mappers.paymentMethod.toApp);
    },
    add: async (pm: Omit<CustomPaymentMethod, 'id'>) => {
      const userId = await getUserId();
      const { data, error } = await supabase.from('formas_pagamento').insert({
        ...mappers.paymentMethod.toDb(pm),
        usuario_id: userId
      }).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.paymentMethod.toApp(data);
    },
    update: async (id: string, pm: Partial<CustomPaymentMethod>) => {
      const { data, error } = await supabase.from('formas_pagamento').update(mappers.paymentMethod.toDb(pm)).eq('id', id).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.paymentMethod.toApp(data);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('formas_pagamento').delete().eq('id', id);
      if (error) throw error;
      notifyMutation();
    }
  }
};

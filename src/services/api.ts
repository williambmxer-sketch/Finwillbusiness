import { supabase } from '../lib/supabase';
import {
  Account,
  Card,
  Category,
  Contact,
  Transaction,
  CustomPaymentMethod,
  Organization,
  OrganizationMember,
  WithdrawalConfig,
} from '../db/db';
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
    toDb: (obj: Partial<Category>) => {
      const payload: any = {};
      if (obj.name !== undefined) payload.nome = obj.name;
      if (obj.icon !== undefined) payload.icone = obj.icon;
      if (obj.color !== undefined) payload.cor = obj.color;
      if (obj.type !== undefined) payload.tipo = obj.type;
      if (obj.showInCards !== undefined) payload.mostrar_em_cartoes = obj.showInCards;
      if (obj.showInAccounts !== undefined) payload.mostrar_em_contas = obj.showInAccounts;
      return payload;
    }
  },
  contact: {
    toApp: (row: any): Contact => ({
      id: row.id,
      name: row.nome,
      type: row.tipo,
      email: row.email || undefined,
      phone: row.telefone || undefined,
      notes: row.observacoes || undefined,
      active: row.ativo ?? true,
    }),
    toDb: (obj: Partial<Contact>) => {
      const payload: any = {};
      if (obj.name !== undefined) payload.nome = obj.name;
      if (obj.type !== undefined) payload.tipo = obj.type;
      if ('email' in obj) payload.email = obj.email || null;
      if ('phone' in obj) payload.telefone = obj.phone || null;
      if ('notes' in obj) payload.observacoes = obj.notes || null;
      if (obj.active !== undefined) payload.ativo = obj.active;
      return payload;
    }
  },
  account: {
    toApp: (row: any): Account => ({
      id: row.id,
      name: row.nome,
      type: row.tipo,
      balance: Number(row.saldo),
      color: row.cor,
      icon: row.icone,
      showInPayments: row.mostrar_em_pagamentos ?? true,
      showInReceipts: row.mostrar_em_recebimentos ?? true,
    }),
    toDb: (obj: Partial<Account>) => {
      const payload: any = {};
      if (obj.name !== undefined) payload.nome = obj.name;
      if (obj.type !== undefined) payload.tipo = obj.type;
      if (obj.balance !== undefined) payload.saldo = obj.balance;
      if (obj.color !== undefined) payload.cor = obj.color;
      if (obj.icon !== undefined) payload.icone = obj.icon;
      if (obj.showInPayments !== undefined) payload.mostrar_em_pagamentos = obj.showInPayments;
      if (obj.showInReceipts !== undefined) payload.mostrar_em_recebimentos = obj.showInReceipts;
      return payload;
    }
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
    toDb: (obj: Partial<Card>) => {
      const payload: any = {};
      if (obj.name !== undefined) payload.nome = obj.name;
      if (obj.brand !== undefined) payload.bandeira = obj.brand;
      if (obj.color !== undefined) payload.cor = obj.color;
      if (obj.limit !== undefined) payload.limite_credito = obj.limit;
      if (obj.closingDay !== undefined) payload.dia_fechamento = obj.closingDay;
      if (obj.dueDay !== undefined) payload.dia_vencimento = obj.dueDay;
      if (obj.bank !== undefined) payload.banco = obj.bank;
      if (obj.lastFour !== undefined) payload.ultimos_quatro = obj.lastFour;
      return payload;
    }
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
      dueDate: row.data_vencimento ? new Date(row.data_vencimento) : undefined,
      competenceMonth: row.competencia_mes || undefined,
      nature: row.natureza || 'operacional',
      contactId: row.contato_id || undefined,
      beneficiaryUserId: row.beneficiario_usuario_id || undefined,
      createdBy: row.criado_por || undefined,
      updatedBy: row.atualizado_por || undefined,
      paidBy: row.baixado_por || undefined,
      version: row.versao || 1,
      notes: row.observacoes || undefined,
      createdAt: row.criado_em,
    }),
    toDb: (obj: Partial<Transaction>) => {
      const payload: any = {};
      if (obj.description !== undefined) payload.descricao = obj.description;
      if (obj.amount !== undefined) payload.valor = obj.amount;
      if (obj.date !== undefined) payload.data = obj.date?.toISOString();
      if (obj.type !== undefined) payload.tipo = obj.type;
      if (obj.categoryId !== undefined) payload.categoria_id = obj.categoryId;
      if (obj.accountId !== undefined) payload.conta_id = obj.accountId || null;
      if (obj.cardId !== undefined) payload.cartao_id = obj.cardId || null;
      if (obj.installments !== undefined) payload.parcelas = obj.installments || null;
      if (obj.currentInstallment !== undefined) payload.parcela_atual = obj.currentInstallment || null;
      if (obj.parentId !== undefined) payload.transacao_pai_id = obj.parentId || null;
      if (obj.isPaid !== undefined) payload.esta_pago = obj.isPaid;
      if ('paymentDate' in obj) payload.data_pagamento = obj.paymentDate ? obj.paymentDate.toISOString() : null;
      if ('dueDate' in obj) payload.data_vencimento = obj.dueDate ? obj.dueDate.toISOString() : null;
      if ('competenceMonth' in obj) payload.competencia_mes = obj.competenceMonth || null;
      if (obj.nature !== undefined) payload.natureza = obj.nature;
      if ('contactId' in obj) payload.contato_id = obj.contactId || null;
      if ('beneficiaryUserId' in obj) payload.beneficiario_usuario_id = obj.beneficiaryUserId || null;
      if (obj.notes !== undefined) payload.observacoes = obj.notes || null;
      return payload;
    }
  },
  paymentMethod: {
    toApp: (row: any): CustomPaymentMethod => ({
      id: row.id,
      name: row.nome,
      debitFromAccount: row.debitar_conta,
      linkedAccountId: row.conta_id || undefined,
    }),
    toDb: (obj: Partial<CustomPaymentMethod>) => {
      const payload: any = {};
      if (obj.name !== undefined) payload.nome = obj.name;
      if (obj.debitFromAccount !== undefined) payload.debitar_conta = obj.debitFromAccount;
      if ('linkedAccountId' in obj) payload.conta_id = obj.linkedAccountId || null;
      return payload;
    }
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

const getCurrentOrganizationId = async () => {
  const { data, error } = await supabase.rpc('current_organization_id');
  if (error) throw error;
  if (!data) throw new Error('Nenhuma empresa ativa foi encontrada.');
  return data as string;
};

const notifyMutation = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('db_mutation'));
  }
};

export const api = {
  demo: {
    seed: async () => {
      const { data, error } = await supabase.rpc('ensure_business_demo_data');
      if (error) throw error;
      if (data) notifyMutation();
      return Boolean(data);
    },
  },

  organizations: {
    list: async (): Promise<Organization[]> => {
      const { data, error } = await supabase
        .from('membros_organizacao')
        .select('organizacao_id,papel,ativo,padrao,organizacoes(id,nome,nome_fantasia,documento,moeda,fuso_horario)')
        .eq('ativo', true);
      if (error) throw error;

      return (data || []).map((row: any) => {
        const organization = Array.isArray(row.organizacoes) ? row.organizacoes[0] : row.organizacoes;
        return {
          id: organization.id,
          name: organization.nome,
          tradeName: organization.nome_fantasia || undefined,
          document: organization.documento || undefined,
          currency: organization.moeda || 'BRL',
          timezone: organization.fuso_horario || 'America/Sao_Paulo',
          role: row.papel,
          isDefault: row.padrao,
        } as Organization;
      });
    },
    switch: async (organizationId: string) => {
      const { error } = await supabase.rpc('switch_organization', { p_organizacao_id: organizationId });
      if (error) throw error;
      notifyMutation();
    },
    update: async (organizationId: string, changes: { name?: string; tradeName?: string; document?: string }) => {
      const payload: any = {};
      if (changes.name !== undefined) payload.nome = changes.name;
      if (changes.tradeName !== undefined) payload.nome_fantasia = changes.tradeName || null;
      if (changes.document !== undefined) payload.documento = changes.document || null;
      const { data, error } = await supabase.from('organizacoes').update(payload).eq('id', organizationId).select().single();
      if (error) throw error;
      return data;
    },
    members: async (): Promise<OrganizationMember[]> => {
      const { data, error } = await supabase.rpc('list_current_organization_members');
      if (error) throw error;
      return (data || []).map((row: any) => ({
        organizationId: row.organizacao_id,
        userId: row.usuario_id,
        role: row.papel,
        active: row.ativo,
        isDefault: row.padrao,
        email: row.email || undefined,
        displayName: row.nome_exibicao || undefined,
      }));
    },
    createInvite: async (email: string, role: 'administrador' | 'socio' | 'consulta') => {
      const { data, error } = await supabase.rpc('create_organization_invite', {
        p_email: email,
        p_papel: role,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    updateMember: async (userId: string, role: 'administrador' | 'socio' | 'consulta', active: boolean) => {
      const { error } = await supabase.rpc('update_organization_member', {
        p_usuario_id: userId,
        p_papel: role,
        p_ativo: active,
      });
      if (error) throw error;
    },
    removeMember: async (userId: string) => {
      const { error } = await supabase.rpc('remove_organization_member', {
        p_usuario_id: userId,
      });
      if (error) throw error;
      notifyMutation();
    },
  },

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

  contacts: {
    list: async (): Promise<Contact[]> => {
      const { data, error } = await supabase.from('contatos').select('*').order('nome');
      if (error) throw error;
      return (data || []).map(mappers.contact.toApp);
    },
    add: async (contact: Omit<Contact, 'id'>) => {
      const userId = await getUserId();
      const { data, error } = await supabase.from('contatos').insert({
        ...mappers.contact.toDb(contact),
        usuario_id: userId,
      }).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.contact.toApp(data);
    },
    update: async (id: string, contact: Partial<Contact>) => {
      const { data, error } = await supabase.from('contatos').update(mappers.contact.toDb(contact)).eq('id', id).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.contact.toApp(data);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('contatos').update({ ativo: false }).eq('id', id);
      if (error) throw error;
      notifyMutation();
    },
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
    },
    resetBalances: async () => {
      const organizationId = await getCurrentOrganizationId();
      const { error } = await supabase.from('contas').update({ saldo: 0 }).eq('organizacao_id', organizationId);
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
    // Fluxos financeiros compostos não podem cair no cache nem entrar na fila
    // offline: precisamos confirmar o estado real antes de continuar.
    listFresh: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase.from('transacoes').select('*');
      if (error) throw error;
      return (data || []).map(mappers.transaction.toApp);
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
          throw new Error('Lançamentos financeiros exigem conexão para garantir a empresa e o saldo corretos.');
        }
        throw err;
      }
    },
    // Usado somente por operações que precisam ser atômicas/reconciliáveis.
    // Diferentemente de add(), nunca cria uma mutação offline silenciosa.
    addStrict: async (transaction: Omit<Transaction, 'id'>) => {
      const userId = await getUserId();
      const payload = {
        ...mappers.transaction.toDb(transaction),
        usuario_id: userId
      };
      const { data, error } = await supabase.from('transacoes').insert(payload).select().single();
      if (error) throw error;
      notifyMutation();
      return mappers.transaction.toApp(data);
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
          throw new Error('Lançamentos financeiros exigem conexão para garantir a empresa e o saldo corretos.');
        }
        throw err;
      }
    },
    bulkAddStrict: async (transactions: Omit<Transaction, 'id'>[]) => {
      const userId = await getUserId();
      const payload = transactions.map(t => ({
        ...mappers.transaction.toDb(t),
        usuario_id: userId
      }));
      const { data, error } = await supabase.from('transacoes').insert(payload).select();
      if (error) throw error;
      notifyMutation();
      return (data || []).map(mappers.transaction.toApp);
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
    },
    deleteAll: async () => {
      const organizationId = await getCurrentOrganizationId();
      const { error: transactionsError } = await supabase.from('transacoes').delete().eq('organizacao_id', organizationId);
      if (transactionsError) throw transactionsError;
      const { error: accountsError } = await supabase.from('contas').update({ saldo: 0 }).eq('organizacao_id', organizationId);
      if (accountsError) throw accountsError;

      if (typeof window !== 'undefined') {
        localStorage.removeItem('financas_sync_queue');
        localStorage.removeItem('financas_simulated_items');
      }
      notifyMutation();
    }
  },

  withdrawals: {
    list: async (): Promise<WithdrawalConfig[]> => {
      const { data, error } = await supabase.from('configuracoes_retirada').select('*').order('descricao');
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        organizationId: row.organizacao_id,
        beneficiaryUserId: row.beneficiario_usuario_id,
        description: row.descricao,
        amount: Number(row.valor),
        dueDay: row.dia_vencimento,
        accountId: row.conta_id || undefined,
        categoryId: row.categoria_id || undefined,
        nextCompetence: row.proxima_competencia,
        active: row.ativo,
      }));
    },
    save: async (config: Omit<WithdrawalConfig, 'id' | 'organizationId'> & { id?: string }) => {
      const userId = await getUserId();
      const organizationId = await getCurrentOrganizationId();
      const payload = {
        organizacao_id: organizationId,
        beneficiario_usuario_id: config.beneficiaryUserId,
        descricao: config.description,
        valor: config.amount,
        dia_vencimento: config.dueDay,
        conta_id: config.accountId || null,
        categoria_id: config.categoryId || null,
        proxima_competencia: config.nextCompetence,
        ativo: config.active,
        criado_por: userId,
      };
      const query = config.id
        ? supabase.from('configuracoes_retirada').update(payload).eq('id', config.id)
        : supabase.from('configuracoes_retirada').insert(payload);
      const { data, error } = await query.select().single();
      if (error) throw error;
      notifyMutation();
      return data;
    },
    generateDue: async () => {
      const { data, error } = await supabase.rpc('generate_due_prolabore');
      if (error) throw error;
      notifyMutation();
      return Number(data || 0);
    },
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

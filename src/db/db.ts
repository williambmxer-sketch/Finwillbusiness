import Dexie, { type Table } from 'dexie';

export interface Card {
  id: string;
  name: string;
  brand: string;
  color: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  bank: string;
  lastFour: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'corrente' | 'poupança' | 'carteira' | 'investimento';
  balance: number;
  color: string;
  icon: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'receita' | 'despesa';
  showInCards?: boolean;
  showInAccounts?: boolean;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date;
  type: 'receita' | 'despesa';
  categoryId: string;
  accountId?: string;
  cardId?: string; // If it's a credit card transaction
  installments?: number;
  currentInstallment?: number;
  parentId?: string; // To link installments
  isPaid: boolean;
  paymentDate?: Date; // The date when the user actually clicked 'Confirmar Pagamento'
  notes?: string;
}

export interface Invoice {
  id: string;
  cardId: string;
  month: string; // YYYY-MM
  status: 'open' | 'closed' | 'future' | 'paid' | 'overdue';
  totalAmount: number;
  dueDate: Date;
  closingDate: Date;
}

export interface CustomPaymentMethod {
  id: string;
  name: string;
  allowInstallments: boolean;
  debitFromAccount: boolean;
}

export class FinanceDB extends Dexie {
  cards!: Table<Card>;
  accounts!: Table<Account>;
  categories!: Table<Category>;
  transactions!: Table<Transaction>;
  invoices!: Table<Invoice>;
  paymentMethods!: Table<CustomPaymentMethod>;

  constructor() {
    super('FinanceDB');
    this.version(1).stores({
      cards: 'id',
      accounts: 'id',
      categories: 'id',
      transactions: 'id, date, type, categoryId, accountId, cardId, isPaid, parentId',
      invoices: 'id, cardId, month, status',
      paymentMethods: 'id'
    });
  }
}

export const db = new FinanceDB();

export async function seedDB() {
  // Database mock seeding removed per user request to start fresh.
  // When we switch to Supabase, this will be deprecated entirely.
}

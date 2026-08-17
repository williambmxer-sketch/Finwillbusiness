import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../utils/formatters';
import { getTransactionCycle } from '../../utils/cycleUtils';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  HelpCircle,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Edit
} from 'lucide-react';
import { Card } from '../ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../services/api';
import { splitAmount } from '../../utils/financialRules';

interface SimulatedItem {
  id: string;
  description: string;
  amount: number;
  type: 'receita' | 'despesa';
  startMonth: string; // YYYY-MM
  durationMonths: number; // 1 = uma vez, 0 = recorrente, >1 = parcelado
  categoryId: string;
  accountId?: string;
  cardId?: string;
  projectSubsequentMonth?: boolean;
}

export function PlanningView() {
  const setCurrentView = useAppStore(state => state.currentView);
  const { setCurrentView: goToView } = useAppStore();
  const accounts = useDataStore(state => state.accounts);
  const cards = useDataStore(state => state.cards);
  const categories = useDataStore(state => state.categories);
  const allTransactions = useDataStore(state => state.transactions);

  const [simulatedItems, setSimulatedItems] = useState<SimulatedItem[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>(null);
  const [shiftedIncomeNames, setShiftedIncomeNames] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [calculationMode, setCalculationMode] = useState<'cumulative' | 'static'>('cumulative');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    const savedMode = localStorage.getItem('financas_planning_calc_mode');
    if (savedMode === 'cumulative' || savedMode === 'static') {
      setCalculationMode(savedMode);
    }
    const saved = localStorage.getItem('financas_shifted_income_names');
    if (saved) {
      try {
        setShiftedIncomeNames(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const toggleShiftIncome = (name: string) => {
    const updated = shiftedIncomeNames.includes(name)
      ? shiftedIncomeNames.filter(x => x !== name)
      : [...shiftedIncomeNames, name];
    setShiftedIncomeNames(updated);
    localStorage.setItem('financas_shifted_income_names', JSON.stringify(updated));
  };

  const toggleMonthExpand = (cycleId: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [cycleId]: !prev[cycleId]
    }));
  };
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'receita' | 'despesa'>('despesa');
  const [startMonth, setStartMonth] = useState('');
  const [durationMonths, setDurationMonths] = useState(1); // 1 = once, 0 = permanent/recurring, >1 = installments
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [projectSubsequentMonth, setProjectSubsequentMonth] = useState(false);
  const [formSimulationResult, setFormSimulationResult] = useState<any[] | null>(null);

  // Clear simulated form results when inputs change, ensuring they recalculate fresh
  useEffect(() => {
    setFormSimulationResult(null);
  }, [description, amount, type, startMonth, durationMonths, categoryId, accountId, cardId, projectSubsequentMonth]);

  // Assistant states
  const [assistantItemName, setAssistantItemName] = useState('');
  const [assistantItemAmount, setAssistantItemAmount] = useState('');
  const [assistantInstallments, setAssistantInstallments] = useState(1);
  const [assistantResult, setAssistantResult] = useState<{
    month: string;
    monthLabel: string;
    isSafe: boolean;
    minBalance: number;
  }[] | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('financas_simulated_items');
    if (saved) {
      try {
        setSimulatedItems(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading simulated items', e);
      }
    }

    // Set default month to current month
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setStartMonth(currentMonthStr);
  }, []);

  // Save to localStorage when simulatedItems change
  const saveItems = (items: SimulatedItem[]) => {
    setSimulatedItems(items);
    localStorage.setItem('financas_simulated_items', JSON.stringify(items));
  };

  const totalActualBalance = useMemo(() => {
    return accounts.reduce((acc, a) => acc + a.balance, 0);
  }, [accounts]);

  const allUniqueIncomes = useMemo(() => {
    const grouped = new Map<string, any>();
    
    allTransactions.forEach(t => {
      if (t.type === 'receita' && !t.notes?.startsWith('transferencia:')) {
        // Clean installments or counter suffixes like (1/6)
        const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
        if (!grouped.has(cleanDesc) || new Date(t.date).getTime() > new Date(grouped.get(cleanDesc).date).getTime()) {
          grouped.set(cleanDesc, {
            id: t.id,
            description: cleanDesc,
            amount: t.amount,
            date: t.date
          });
        }
      }
    });

    return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
  }, [allTransactions]);

  // Helper to generate the list of next 6 months starting from current
  const projectionMonths = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const id = `${year}-${String(month).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      list.push({ id, label, year, month });
    }
    return list;
  }, []);

  // Calculate projected balance, income and expenses for each of the next 6 months
  const projections = useMemo(() => {
    const results = [];
    let runningBalance = totalActualBalance;

    for (let i = 0; i < projectionMonths.length; i++) {
      const { id: cycleId, label, year, month } = projectionMonths[i];

      // 1. Actual transactions in this cycle
      const actualInThisCycle = allTransactions.filter(t => {
        return getTransactionCycle(t, cards) === cycleId;
      });

      // Shift incomes by exactly +1 month if configured in shiftedIncomeNames
      const getPreviousCycleId = (cid: string) => {
        const [y, m] = cid.split('-').map(Number);
        const prevDate = new Date(y, m - 2, 1);
        return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      };
      const prevCycleId = getPreviousCycleId(cycleId);

      const actualIncomesNotShifted = allTransactions.filter(t => {
        const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
        return getTransactionCycle(t, cards) === cycleId && 
               t.type === 'receita' && 
               !t.notes?.startsWith('transferencia:') && 
               !shiftedIncomeNames.includes(cleanDesc);
      }).reduce((sum, t) => sum + t.amount, 0);

      const actualIncomesShiftedFromPrev = allTransactions.filter(t => {
        const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
        return getTransactionCycle(t, cards) === prevCycleId && 
               t.type === 'receita' && 
               !t.notes?.startsWith('transferencia:') && 
               shiftedIncomeNames.includes(cleanDesc);
      }).reduce((sum, t) => sum + t.amount, 0);

      const actualIncomes = actualIncomesNotShifted + actualIncomesShiftedFromPrev;

      const actualExpenses = actualInThisCycle
        .filter(t => t.type === 'despesa' && !t.notes?.startsWith('transferencia:'))
        .reduce((sum, t) => sum + t.amount, 0);

      // 2. Simulated transactions in this cycle
      let simulatedIncomes = 0;
      let simulatedExpenses = 0;

      simulatedItems.forEach(item => {
        // Parse item start month
        const [sYear, sMonth] = item.startMonth.split('-').map(Number);
        const itemStartDate = new Date(sYear, sMonth - 1, 1);
        const currentCycleDate = new Date(year, month - 1, 1);

        // Calculate diff in months
        const monthDiff = (year - sYear) * 12 + (month - sMonth);
        const effectiveDiff = item.projectSubsequentMonth ? (monthDiff - 1) : monthDiff;

        let isActive = false;
        if (effectiveDiff >= 0) {
          if (item.durationMonths === 1 && effectiveDiff === 0) {
            isActive = true;
          } else if (item.durationMonths === 0) {
            isActive = true; // Permanent
          } else if (item.durationMonths > 1 && effectiveDiff < item.durationMonths) {
            isActive = true; // Installments
          }
        }

        if (isActive) {
          const monthlyAmount = item.durationMonths > 1 ? (item.amount / item.durationMonths) : item.amount;
          if (item.type === 'receita') {
            simulatedIncomes += monthlyAmount;
          } else {
            simulatedExpenses += monthlyAmount;
          }
        }
      });

      const totalIncomes = actualIncomes + simulatedIncomes;
      const totalExpenses = actualExpenses + simulatedExpenses;
      const monthNet = totalIncomes - totalExpenses;
      const startBalance = calculationMode === 'static' ? 0 : runningBalance;
      
      // Update running balance (simulating the cash flow ending balance)
      runningBalance += monthNet;
      const endBalance = calculationMode === 'static' ? monthNet : runningBalance;

      results.push({
        cycleId,
        label,
        startBalance,
        actualIncomes,
        actualExpenses,
        simulatedIncomes,
        simulatedExpenses,
        totalIncomes,
        totalExpenses,
        endBalance,
        monthNet,
        isNegative: endBalance < 0
      });
    }

    return results;
  }, [projectionMonths, totalActualBalance, allTransactions, simulatedItems, cards, shiftedIncomeNames, calculationMode]);

  const itemAnalysis = useMemo(() => {
    if (!analyzingItemId) return null;
    const item = simulatedItems.find(x => x.id === analyzingItemId);
    if (!item) return null;

    const [itemYear, itemMonth] = item.startMonth.split('-').map(Number);
    const itemStartCycleId = `${itemYear}-${String(itemMonth).padStart(2, '0')}`;

    const getPreviousCycleId = (cid: string) => {
      const [y, m] = cid.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    };

    // Filter results to only calculate and show months starting from item.startMonth
    const activeProjectionMonths = projectionMonths.filter(pm => pm.id >= itemStartCycleId);

    // Baseline projections for next 6 months
    const results = activeProjectionMonths.map(targetMonth => {
      // 1. Calculate the projected balance/net for targetMonth:
      let targetMonthBalance = calculationMode === 'static' ? 0 : totalActualBalance;
      const targetIndex = projectionMonths.findIndex(pm => pm.id === targetMonth.id);
      
      // Calculate running balance up to the target month (or just target month if static):
      for (let j = 0; j <= targetIndex; j++) {
        const m = projectionMonths[j];
        
        // 1. Actual
        const prevCycleId = getPreviousCycleId(m.id);
        const actualIncomesNotShifted = allTransactions.filter(t => {
          const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
          return getTransactionCycle(t, cards) === m.id && t.type === 'receita' && !t.notes?.startsWith('transferencia:') && !shiftedIncomeNames.includes(cleanDesc);
        }).reduce((sum, t) => sum + t.amount, 0);

        const actualIncomesShiftedFromPrev = allTransactions.filter(t => {
          const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
          return getTransactionCycle(t, cards) === prevCycleId && t.type === 'receita' && !t.notes?.startsWith('transferencia:') && shiftedIncomeNames.includes(cleanDesc);
        }).reduce((sum, t) => sum + t.amount, 0);

        const actualIncomes = actualIncomesNotShifted + actualIncomesShiftedFromPrev;
        const actualExpenses = allTransactions.filter(t => getTransactionCycle(t, cards) === m.id && t.type === 'despesa' && !t.notes?.startsWith('transferencia:')).reduce((sum, t) => sum + t.amount, 0);

        // 2. Existing simulated (excluding currently analyzed item to treat it as the "added goal")
        let simulatedIncomes = 0;
        let simulatedExpenses = 0;
        simulatedItems.forEach(sim => {
          if (sim.id === analyzingItemId) return; // Exclude itself
          const [sYear, sMonth] = sim.startMonth.split('-').map(Number);
          const monthDiff = (m.year - sYear) * 12 + (m.month - sMonth);
          const effectiveDiff = sim.projectSubsequentMonth ? (monthDiff - 1) : monthDiff;

          let isActive = false;
          if (effectiveDiff >= 0) {
            if (sim.durationMonths === 1 && effectiveDiff === 0) isActive = true;
            else if (sim.durationMonths === 0) isActive = true;
            else if (sim.durationMonths > 1 && effectiveDiff < sim.durationMonths) isActive = true;
          }
          if (isActive) {
            const monthlyAmount = sim.durationMonths > 1 ? (sim.amount / sim.durationMonths) : sim.amount;
            if (sim.type === 'receita') simulatedIncomes += monthlyAmount;
            else simulatedExpenses += monthlyAmount;
          }
        });

        // 3. Current item simulated (treated as the target simulation item)
        let targetItemIncome = 0;
        let targetItemExpense = 0;
        
        const formStartIndex = projectionMonths.findIndex(pm => pm.id === itemStartCycleId);
        
        if (formStartIndex !== -1) {
          const diff = j - formStartIndex;
          const effectiveDiff = item.type === 'receita' ? (item.projectSubsequentMonth ? (diff - 1) : diff) : diff;

          let isTargetActive = false;
          if (effectiveDiff >= 0) {
            if (item.durationMonths === 1 && effectiveDiff === 0) isTargetActive = true;
            else if (item.durationMonths === 0) isTargetActive = true;
            else if (item.durationMonths > 1 && effectiveDiff < item.durationMonths) isTargetActive = true;
          }

          if (isTargetActive) {
            const monthlyAmount = item.durationMonths > 1 ? (item.amount / item.durationMonths) : item.amount;
            if (item.type === 'receita') targetItemIncome = monthlyAmount;
            else targetItemExpense = monthlyAmount;
          }
        }

        if (calculationMode === 'static') {
          if (j === targetIndex) {
            targetMonthBalance = (actualIncomes + simulatedIncomes + targetItemIncome) - (actualExpenses + simulatedExpenses + targetItemExpense);
          }
        } else {
          targetMonthBalance += (actualIncomes + simulatedIncomes + targetItemIncome) - (actualExpenses + simulatedExpenses + targetItemExpense);
        }
      }

      const isSafe = targetMonthBalance >= 0;

      return {
        month: targetMonth.id,
        monthLabel: targetMonth.label,
        isSafe,
        minBalance: targetMonthBalance
      };
    });

    return results;
  }, [analyzingItemId, simulatedItems, projectionMonths, totalActualBalance, allTransactions, cards, shiftedIncomeNames, calculationMode]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !startMonth) return;

    if (editingItemId) {
      const updated = simulatedItems.map(item => {
        if (item.id === editingItemId) {
          return {
            ...item,
            description,
            amount: Math.abs(parseFloat(amount)),
            type,
            startMonth,
            durationMonths: Number(durationMonths),
            categoryId: categoryId || categories[0]?.id || '',
            accountId: accountId || undefined,
            cardId: cardId || undefined,
            projectSubsequentMonth: type === 'receita' ? projectSubsequentMonth : false
          };
        }
        return item;
      });
      saveItems(updated);
      setEditingItemId(null);
    } else {
      const newItem: SimulatedItem = {
        id: Math.random().toString(36).substring(7),
        description,
        amount: Math.abs(parseFloat(amount)),
        type,
        startMonth,
        durationMonths: Number(durationMonths),
        categoryId: categoryId || categories[0]?.id || '',
        accountId: accountId || undefined,
        cardId: cardId || undefined,
        projectSubsequentMonth: type === 'receita' ? projectSubsequentMonth : false
      };
      saveItems([...simulatedItems, newItem]);
    }
    
    // Reset form
    setDescription('');
    setAmount('');
    setDurationMonths(1);
    setProjectSubsequentMonth(false);
    setFormSimulationResult(null);
    setShowAddForm(false);
  };

  const handleEditItem = (item: SimulatedItem) => {
    setDescription(item.description);
    setAmount(item.amount.toString());
    setType(item.type);
    setStartMonth(item.startMonth);
    setDurationMonths(item.durationMonths);
    setCategoryId(item.categoryId);
    setAccountId(item.accountId || '');
    setCardId(item.cardId || '');
    setProjectSubsequentMonth(item.projectSubsequentMonth || false);
    setEditingItemId(item.id);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSimulateForm = () => {
    const val = parseFloat(amount);
    if (!description || isNaN(val) || val <= 0 || !startMonth) {
      alert('Por favor, insira o nome/descrição, o valor e o mês de início da simulação antes de simular.');
      return;
    }

    const getPreviousCycleId = (cid: string) => {
      const [y, m] = cid.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    };

    const [formYear, formMonth] = startMonth.split('-').map(Number);
    const formStartCycleId = `${formYear}-${String(formMonth).padStart(2, '0')}`;

    const activeProjectionMonths = projectionMonths.filter(pm => pm.id >= formStartCycleId);

    if (activeProjectionMonths.length === 0) {
      alert('O mês selecionado está fora dos 6 meses de projeção.');
      return;
    }

    // Calculate simulated timeline results
    const results = activeProjectionMonths.map(targetMonth => {
      // 1. Calculate the projected balance/net for targetMonth:
      let targetMonthBalance = calculationMode === 'static' ? 0 : totalActualBalance;
      const targetIndex = projectionMonths.findIndex(pm => pm.id === targetMonth.id);
      
      // Calculate running balance up to the target month (or just target month if static):
      for (let j = 0; j <= targetIndex; j++) {
        const m = projectionMonths[j];
        
        // 1. Actual
        const prevCycleId = getPreviousCycleId(m.id);
        const actualIncomesNotShifted = allTransactions.filter(t => {
          const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
          return getTransactionCycle(t, cards) === m.id && t.type === 'receita' && !t.notes?.startsWith('transferencia:') && !shiftedIncomeNames.includes(cleanDesc);
        }).reduce((sum, t) => sum + t.amount, 0);

        const actualIncomesShiftedFromPrev = allTransactions.filter(t => {
          const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
          return getTransactionCycle(t, cards) === prevCycleId && t.type === 'receita' && !t.notes?.startsWith('transferencia:') && shiftedIncomeNames.includes(cleanDesc);
        }).reduce((sum, t) => sum + t.amount, 0);

        const actualIncomes = actualIncomesNotShifted + actualIncomesShiftedFromPrev;
        const actualExpenses = allTransactions.filter(t => getTransactionCycle(t, cards) === m.id && t.type === 'despesa' && !t.notes?.startsWith('transferencia:')).reduce((sum, t) => sum + t.amount, 0);

        // 2. Existing simulated
        let simulatedIncomes = 0;
        let simulatedExpenses = 0;
        simulatedItems.forEach(sim => {
          const [sYear, sMonth] = sim.startMonth.split('-').map(Number);
          const monthDiff = (m.year - sYear) * 12 + (m.month - sMonth);
          const effectiveDiff = sim.projectSubsequentMonth ? (monthDiff - 1) : monthDiff;

          let isActive = false;
          if (effectiveDiff >= 0) {
            if (sim.durationMonths === 1 && effectiveDiff === 0) isActive = true;
            else if (sim.durationMonths === 0) isActive = true;
            else if (sim.durationMonths > 1 && effectiveDiff < sim.durationMonths) isActive = true;
          }
          if (isActive) {
            const monthlyAmount = sim.durationMonths > 1 ? (sim.amount / sim.durationMonths) : sim.amount;
            if (sim.type === 'receita') simulatedIncomes += monthlyAmount;
            else simulatedExpenses += monthlyAmount;
          }
        });

        // 3. New purchase simulated inside form (starts at startMonth input)
        let targetItemIncome = 0;
        let targetItemExpense = 0;
        
        const formStartIndex = projectionMonths.findIndex(pm => pm.id === formStartCycleId);
        
        if (formStartIndex !== -1) {
          const diff = j - formStartIndex;
          const effectiveDiff = type === 'receita' ? (projectSubsequentMonth ? (diff - 1) : diff) : diff;

          let isTargetActive = false;
          if (effectiveDiff >= 0) {
            if (Number(durationMonths) === 1 && effectiveDiff === 0) isTargetActive = true;
            else if (Number(durationMonths) === 0) isTargetActive = true;
            else if (Number(durationMonths) > 1 && effectiveDiff < Number(durationMonths)) isTargetActive = true;
          }

          if (isTargetActive) {
            const monthlyAmount = Number(durationMonths) > 1 ? (val / Number(durationMonths)) : val;
            if (type === 'receita') targetItemIncome = monthlyAmount;
            else targetItemExpense = monthlyAmount;
          }
        }

        if (calculationMode === 'static') {
          if (j === targetIndex) {
            targetMonthBalance = (actualIncomes + simulatedIncomes + targetItemIncome) - (actualExpenses + simulatedExpenses + targetItemExpense);
          }
        } else {
          targetMonthBalance += (actualIncomes + simulatedIncomes + targetItemIncome) - (actualExpenses + simulatedExpenses + targetItemExpense);
        }
      }

      const isSafe = targetMonthBalance >= 0;

      return {
        month: targetMonth.id,
        monthLabel: targetMonth.label,
        isSafe,
        minBalance: targetMonthBalance
      };
    });

    setFormSimulationResult(results);
  };

  const handleDeleteItem = (id: string) => {
    const updated = simulatedItems.filter(item => item.id !== id);
    saveItems(updated);
  };

  const handleShiftMonth = (id: string, direction: 'forward' | 'backward') => {
    const updated = simulatedItems.map(item => {
      if (item.id === id) {
        const [year, month] = item.startMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + (direction === 'forward' ? 1 : -1), 1);
        const newStartMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return { ...item, startMonth: newStartMonth };
      }
      return item;
    });
    saveItems(updated);
  };

  const handleEfetivar = async (item: SimulatedItem) => {
    if (confirm(`Deseja converter a simulação "${item.description}" em transações reais no banco de dados?`)) {
      try {
        setIsSubmitting(true);
        const now = new Date();
        const [year, month] = item.startMonth.split('-').map(Number);

        if (item.durationMonths === 1) {
          // Single transaction
          await api.transactions.add({
            description: item.description,
            amount: item.amount,
            type: item.type,
            date: new Date(year, month - 1, 15), // middle of month
            categoryId: item.categoryId,
            accountId: item.accountId || 'none',
            cardId: item.cardId || 'money',
            isPaid: false
          });
        } else if (item.durationMonths > 1) {
          // Installment transactions
          const transactionsToAdd = [];
          const parentId = Math.random().toString(36).substring(7);
          const installmentAmounts = splitAmount(item.amount, item.durationMonths);
          
          for (let i = 0; i < item.durationMonths; i++) {
            const transDate = new Date(year, month - 1 + i, 15);
            transactionsToAdd.push({
              description: `${item.description} (${i + 1}/${item.durationMonths})`,
              amount: installmentAmounts[i],
              type: item.type,
              date: transDate,
              categoryId: item.categoryId,
              accountId: item.accountId || 'none',
              cardId: item.cardId || 'money',
              installments: item.durationMonths,
              currentInstallment: i + 1,
              parentId: parentId,
              isPaid: false
            });
          }
          await api.transactions.bulkAdd(transactionsToAdd);
        } else {
          // Recurring (just add one for current or start month as reference)
          await api.transactions.add({
            description: `${item.description} (Recorrente)`,
            amount: item.amount,
            type: item.type,
            date: new Date(year, month - 1, 15),
            categoryId: item.categoryId,
            accountId: item.accountId || 'none',
            cardId: item.cardId || 'money',
            isPaid: false,
            notes: 'recorrente_planejado'
          });
        }

        // Remove from simulations
        handleDeleteItem(item.id);
        alert('Transação criada com sucesso!');
      } catch (err: any) {
        alert('Erro ao efetivar transação: ' + err.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAnalyzeGoal = () => {
    const val = parseFloat(assistantItemAmount);
    if (!assistantItemName || isNaN(val) || val <= 0) return;

    // Simulate placing the purchase in each of the 6 months and check if any month goes negative
    const results = projectionMonths.map(targetMonth => {
      let runningBalance = totalActualBalance;
      let isSafe = true;
      let minBalance = Infinity;

      projectionMonths.forEach((m) => {
        // Calculate standard month balance without this goal
        const proj = projections.find(p => p.cycleId === m.id);
        const normalNet = proj ? proj.monthNet : 0;

        // Apply goal if within installment range starting from targetMonth
        let extraExpense = 0;
        const targetIndex = projectionMonths.findIndex(pm => pm.id === targetMonth.id);
        const currentIndex = projectionMonths.findIndex(pm => pm.id === m.id);
        const diff = currentIndex - targetIndex;

        if (diff >= 0 && diff < assistantInstallments) {
          extraExpense = val / assistantInstallments;
        }

        runningBalance += (normalNet - extraExpense);
        if (runningBalance < minBalance) {
          minBalance = runningBalance;
        }
        if (runningBalance < 0) {
          isSafe = false;
        }
      });

      return {
        month: targetMonth.id,
        monthLabel: targetMonth.label,
        isSafe,
        minBalance
      };
    });

    setAssistantResult(results);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };



  return (
    <div className="flex flex-col gap-4 p-4 pt-8 max-w-lg mx-auto w-full">
      
      {/* Header */}
      <header className="flex items-center gap-3 mb-2">
        <button 
          onClick={() => goToView('dashboard')}
          className="flex items-center justify-center h-8 w-8 rounded-lg border border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Planejamento</h1>
          <p className="text-xs text-muted-foreground">Simule futuras despesas e receitas e analise o caixa.</p>
        </div>
      </header>

      {/* Main Stats Widget */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 via-background to-background border shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              {calculationMode === 'static' ? 'Projeção Mensal Avulsa' : 'Saldo Atual das Contas'}
            </div>
            <div className="text-2xl font-bold">
              {calculationMode === 'static' ? 'Projeção Independente' : formatCurrency(totalActualBalance)}
            </div>
          </div>

          {/* Toggle Calculation Mode */}
          <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/20 text-[10px]">
            <button
              onClick={() => {
                setCalculationMode('cumulative');
                localStorage.setItem('financas_planning_calc_mode', 'cumulative');
              }}
              className={`px-2 py-1 font-bold rounded-md transition-all ${
                calculationMode === 'cumulative'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Acumulado
            </button>
            <button
              onClick={() => {
                setCalculationMode('static');
                localStorage.setItem('financas_planning_calc_mode', 'static');
              }}
              className={`px-2 py-1 font-bold rounded-md transition-all ${
                calculationMode === 'static'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Receita vs Despesa
            </button>
          </div>
        </div>
        
        {/* Next 6 Months Projections overview */}
        <div 
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`flex gap-2.5 overflow-x-auto pb-1.5 -mx-2 px-2 select-none ${isDragging ? 'cursor-grabbing snap-none' : 'cursor-grab snap-x snap-mandatory'} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
        >
          {projections.map((p, idx) => (
            <div 
              key={p.cycleId} 
              className={`flex-none w-[170px] p-3 rounded-lg border transition-all flex flex-col justify-between ${
                p.isNegative 
                  ? 'border-rose-500/40 bg-rose-500/5 dark:bg-rose-500/10' 
                  : 'border-border/60 bg-muted/10'
              }`}
            >
              <div>
                <div className="text-[10px] font-bold text-muted-foreground capitalize mb-0.5">
                  {p.label}
                </div>
                <div className={`text-sm font-bold ${p.isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                  {calculationMode === 'static' 
                    ? `${p.endBalance >= 0 ? '+' : ''}${formatCurrency(p.endBalance)}` 
                    : formatCurrency(p.endBalance)
                  }
                </div>
              </div>

              <div className="border-t border-border/20 mt-2 pt-1.5 flex flex-col gap-0.5 text-[9px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Receitas:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-500">+{formatCurrency(p.totalIncomes)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Despesas:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(p.totalExpenses)}</span>
                </div>
              </div>

              {p.isNegative && (
                <div className="flex items-center justify-center gap-0.5 mt-2 bg-rose-500/10 p-1 rounded text-[8px] text-rose-500 font-bold uppercase tracking-wide">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Negativo
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Configuração de Receitas (Salários) */}
      <section className="mt-1">
        <div className="flex justify-between items-center mb-1.5 px-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Configuração de Receitas (Salários)</h2>
        </div>
        <Card className="p-3 bg-card border shadow-sm flex flex-col gap-2">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Selecione quais receitas (salários) recebidas no fim do mês devem ser projetadas apenas a partir do mês subsequente (competência):
          </p>
          {allUniqueIncomes.length === 0 ? (
            <div className="text-[10px] text-muted-foreground italic text-center p-2">
              Nenhuma receita cadastrada localizada.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 mt-1">
              {allUniqueIncomes.map(income => (
                <div key={income.description} className="flex justify-between items-center bg-muted/20 border border-border/30 rounded-lg p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id={`shift-${income.description}`}
                      checked={shiftedIncomeNames.includes(income.description)}
                      onChange={() => toggleShiftIncome(income.description)}
                      className="rounded border-border/40 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                    />
                    <label htmlFor={`shift-${income.description}`} className="font-semibold text-foreground cursor-pointer select-none">
                      {income.description}
                    </label>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-500">
                    {formatCurrency(income.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Simulated Items Management */}
      <section className="mt-4">
        <div className="flex justify-between items-center mb-2 px-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Simulações de Contas</h2>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 transition-all"
          >
            <Plus className="h-3 w-3" /> ADICIONAR
          </button>
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <form onSubmit={handleAddItem} className="p-4 bg-card border border-border/80 rounded-[11px] flex flex-col gap-3 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Tipo</label>
                    <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/20">
                      <button 
                        type="button"
                        onClick={() => setType('receita')}
                        className={`flex-1 text-[10px] py-1 font-bold rounded-md transition-all ${type === 'receita' ? 'bg-background text-emerald-600 shadow-sm' : 'text-muted-foreground'}`}
                      >
                        Receita
                      </button>
                      <button 
                        type="button"
                        onClick={() => setType('despesa')}
                        className={`flex-1 text-[10px] py-1 font-bold rounded-md transition-all ${type === 'despesa' ? 'bg-background text-rose-600 shadow-sm' : 'text-muted-foreground'}`}
                      >
                        Despesa
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Mês de Início</label>
                    <input 
                      type="month"
                      required
                      value={startMonth}
                      onChange={(e) => setStartMonth(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-border/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    />
                  </div>
                </div>

                {type === 'receita' && (
                  <div className="flex items-center gap-2 px-1 bg-muted/40 p-2 rounded-lg border border-border/20">
                    <input 
                      type="checkbox"
                      id="projectSubsequentMonth"
                      checked={projectSubsequentMonth}
                      onChange={(e) => setProjectSubsequentMonth(e.target.checked)}
                      className="rounded border-border/40 text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <label htmlFor="projectSubsequentMonth" className="text-[10px] font-medium text-muted-foreground select-none cursor-pointer leading-tight">
                      Recebo no fim do mês (projetar este saldo a partir do mês seguinte)
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Nome / Descrição</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: Monitor, Aluguel..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-border/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Valor Total</label>
                    <input 
                      type="number"
                      required
                      step="0.01"
                      placeholder="R$ 0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-border/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Parcelas / Meses (0 = recorrente, 1 = à vista)</label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      required
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full text-xs p-1.5 rounded-lg border border-border/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary font-bold text-primary"
                      placeholder="Ex: 10"
                    />
                  </div>
                  <div className="flex items-end pb-1.5 text-[10px] text-muted-foreground font-semibold italic">
                    {amount && !isNaN(parseFloat(amount)) && (
                      <span>
                        {durationMonths === 0 ? (
                          <span className="text-primary font-bold">R$ {formatCurrency(parseFloat(amount))} / mês</span>
                        ) : durationMonths > 1 ? (
                          <span>
                            {durationMonths}x de {formatCurrency(parseFloat(amount) / durationMonths)}
                          </span>
                        ) : (
                          <span>À vista</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Categoria (Opcional)</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-border/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Selecione categoria</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Conta (Opcional)</label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-border/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Qualquer Conta</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Cartão (Opcional)</label>
                    <select
                      value={cardId}
                      onChange={(e) => setCardId(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-border/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Dinheiro / Conta</option>
                      {cards.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end pb-1 text-[9px] text-muted-foreground font-medium">
                    * Campos opcionais ajudam na identificação futura ao efetivar.
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-1">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAddForm(false);
                      setFormSimulationResult(null);
                      setEditingItemId(null);
                      setDescription('');
                      setAmount('');
                      setDurationMonths(1);
                      setProjectSubsequentMonth(false);
                    }}
                    className="text-[10px] font-bold text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-all"
                  >
                    CANCELAR
                  </button>
                  <button 
                    type="button" 
                    onClick={handleSimulateForm}
                    className="bg-muted text-muted-foreground hover:bg-muted/80 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all border border-border/40"
                  >
                    📊 SIMULAR
                  </button>
                  <button 
                    type="submit" 
                    className="bg-primary text-primary-foreground text-[10px] font-bold px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-all uppercase"
                  >
                    {editingItemId ? 'ATUALIZAR' : 'SALVAR'}
                  </button>
                </div>

                {/* Form Simulation Result Inline */}
                <AnimatePresence>
                  {formSimulationResult && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-border/20 mt-2 pt-2"
                    >
                      <div className="flex justify-between items-center mb-1.5 px-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Resultado da Simulação Temporal:</span>
                        {Number(durationMonths) > 1 && amount && (
                          <span className="text-[8px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Parcelas: {durationMonths}x de {formatCurrency(parseFloat(amount) / Number(durationMonths))}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {formSimulationResult.map(r => (
                          <div key={r.month} className="flex justify-between items-center text-[10px] p-1.5 rounded-lg bg-muted/40 border border-border/20">
                            <span className="capitalize font-medium">{r.monthLabel.split(' de ')[0]}</span>
                            <div className="flex items-center gap-1.5">
                              {r.isSafe ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 text-[10px]">
                                  <CheckCircle2 className="h-3 w-3" /> Saldo Seguro
                                </span>
                              ) : (
                                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5 text-[10px]">
                                  <AlertTriangle className="h-3 w-3" /> Fica Negativo
                                </span>
                              )}
                              <span className="text-[9px] text-muted-foreground">
                                ({formatCurrency(r.minBalance)})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List of Simulated Items */}
        <div className="flex flex-col gap-2">
          {simulatedItems.length === 0 ? (
            <div className="text-center text-muted-foreground p-6 border border-dashed rounded-[11px] border-border/50 text-xs">
              Nenhuma simulação cadastrada. Clique em "ADICIONAR" acima para planejar contas ou metas.
            </div>
          ) : (
            simulatedItems.map(item => {
              const [year, month] = item.startMonth.split('-');
              const startMonthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
              const isAnalyzing = analyzingItemId === item.id;

              return (
                <div key={item.id} className="flex flex-col gap-2 p-3 bg-card border shadow-sm rounded-[11px] transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-xs text-foreground tracking-tight flex items-center gap-1.5 flex-wrap">
                        {item.description}
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${
                          item.type === 'receita' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                        }`}>
                          {item.type === 'receita' ? 'Receita' : 'Despesa'}
                        </span>
                        {item.projectSubsequentMonth && (
                          <span className="text-[8px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Fim de Mês (Mês+1)
                          </span>
                        )}
                      </span>
                      <div className="text-[10px] text-muted-foreground font-medium mt-0.5 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        Inicia em: <span className="capitalize">{startMonthLabel}</span>
                        {item.durationMonths === 0 ? (
                          <span className="text-primary font-bold">(Recorrente)</span>
                        ) : item.durationMonths > 1 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">({item.durationMonths} parcelas)</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xs block">
                        {item.type === 'receita' ? '+' : '-'}{formatCurrency(item.amount)}
                      </span>
                      {item.durationMonths > 1 && (
                        <span className="text-[9px] text-muted-foreground block">
                          ({formatCurrency(item.amount / item.durationMonths)}/mês)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-border/20 pt-2 mt-1 gap-2 flex-wrap">
                    {/* Shift months controls */}
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleShiftMonth(item.id, 'backward')}
                        className="text-[9px] font-bold border border-border/40 hover:bg-muted text-muted-foreground px-1.5 py-0.5 rounded transition-all"
                        title="Adiar 1 mês atrás"
                      >
                        -1 mês
                      </button>
                      <button 
                        onClick={() => handleShiftMonth(item.id, 'forward')}
                        className="text-[9px] font-bold border border-border/40 hover:bg-muted text-muted-foreground px-1.5 py-0.5 rounded transition-all"
                        title="Adiar 1 mês à frente"
                      >
                        +1 mês
                      </button>
                    </div>

                    <div className="flex gap-1 items-center">
                      <button 
                        onClick={() => setAnalyzingItemId(isAnalyzing ? null : item.id)}
                        className={`text-[9px] font-bold py-1 px-2.5 rounded-lg border transition-all flex items-center gap-1 ${
                          isAnalyzing 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-muted/10 text-muted-foreground hover:bg-muted/30 border-border/40'
                        }`}
                      >
                        📊 Simular Meta
                      </button>
                      <button 
                        onClick={() => handleEfetivar(item)}
                        disabled={isSubmitting}
                        className="bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 text-[9px] font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 transition-all border border-transparent"
                      >
                        <Play className="h-2.5 w-2.5" /> EFETIVAR
                      </button>
                      <button 
                        onClick={() => handleEditItem(item)}
                        className="text-primary hover:bg-primary/10 p-1 rounded transition-all"
                        title="Editar simulação"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-rose-600 hover:bg-rose-500/10 p-1 rounded transition-all"
                        title="Excluir simulação"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Viability Analysis Panel */}
                  <AnimatePresence>
                    {isAnalyzing && itemAnalysis && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border/20 mt-2 pt-2"
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Simulação de Melhor Mês de Início:</span>
                          {item.durationMonths > 1 && (
                            <span className="text-[8px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              Parcelas: {item.durationMonths}x de {formatCurrency(item.amount / item.durationMonths)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {itemAnalysis.map(r => (
                            <div key={r.month} className="flex justify-between items-center text-[10px] p-1.5 rounded-lg bg-muted/40 border border-border/20">
                              <span className="capitalize font-medium">{r.monthLabel.split(' de ')[0]}</span>
                              <div className="flex items-center gap-1.5">
                                {r.isSafe ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 text-[10px]">
                                    <CheckCircle2 className="h-3 w-3" /> Saldo Seguro
                                  </span>
                                ) : (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5 text-[10px]">
                                    <AlertTriangle className="h-3 w-3" /> Fica Negativo
                                  </span>
                                )}
                                <span className="text-[9px] text-muted-foreground">
                                  ({formatCurrency(r.minBalance)})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </section>

    </div>
  );
}

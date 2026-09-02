import React, { useState } from 'react';
import { api } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';
import { formatCurrency } from '../../utils/formatters';
import { getTransactionCycle, getCycleId, getInvoiceClosingDate } from '../../utils/cycleUtils';
import { Plus, Filter, Search, TrendingUp, TrendingDown, Clock, Settings2, CheckCircle2, Pencil, CreditCard, ChevronDown, Check, ChevronLeft, ChevronRight, FileSpreadsheet, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { Input } from '../ui/input';
import { useAppStore } from '../../store/useAppStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCashDate, INVOICE_PAYMENT_PREFIX, isInvoicePayment } from '../../utils/financialRules';

export function TransactionsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    receita: true,
    despesa: true,
    pending: true,
    paid: true
  });
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasClickedType, setHasClickedType] = useState(false);
  const [hasClickedStatus, setHasClickedStatus] = useState(false);

  const now = new Date();
  const currentCycleId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedCycle, setSelectedCycle] = useState<string>(currentCycleId);

  const { setTransactionModalOpen, setEditingTransactionId, setCategoryModalOpen, setConfirmPaymentTransactionId, setConfirmModal } = useAppStore();

  const allTransactions = useDataStore(state => state.transactions);
  const cards = useDataStore(state => state.cards);
  const categories = useDataStore(state => state.categories);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [isCatFilterOpen, setIsCatFilterOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setFilterDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
    if (!filterDropdownOpen) {
      setHasClickedType(false);
      setHasClickedStatus(false);
    }
  }, [filterDropdownOpen]);

  const transactions = React.useMemo(() => {
    return allTransactions
      .filter(t => !isInvoicePayment(t))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allTransactions]);

  const getEffectiveCycle = (t: any) => getTransactionCycle(t, cards);

  const lastProcessedFilterKeyRef = React.useRef<string | null>(null);
  const hasInitializedRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    const cycleTransactions = transactions.filter(t => {
      if (t.notes?.startsWith('transferencia:')) return false;
      if (selectedCycle !== 'all' && getEffectiveCycle(t) !== selectedCycle) return false;

      // Category & Card filtering
      const hasCategoryFilter = selectedCategoryIds.length > 0;
      const hasCardFilter = selectedCardIds.length > 0;
      const tHasCard = t.cardId && t.cardId !== 'money';

      if (!hasCategoryFilter && !hasCardFilter) {
        return true;
      }

      let matches = false;
      if (hasCardFilter && tHasCard && selectedCardIds.includes(t.cardId)) {
        matches = true;
      }
      if (hasCategoryFilter && !tHasCard && selectedCategoryIds.includes(t.categoryId)) {
        matches = true;
      }
      return matches;
    });

    if (transactions.length === 0 && !hasInitializedRef.current) {
      return;
    }

    const currentFilterKey = `${selectedCycle}-${selectedCardIds.join(',')}-${selectedCategoryIds.join(',')}`;

    if (lastProcessedFilterKeyRef.current !== currentFilterKey || !hasInitializedRef.current) {
      lastProcessedFilterKeyRef.current = currentFilterKey;
      hasInitializedRef.current = true;

      const nonCardTx = cycleTransactions.filter(t => !t.cardId || t.cardId === 'money');
      const hasPending = nonCardTx.some(t => !t.isPaid);
      const hasPaid = nonCardTx.some(t => t.isPaid);

      if (hasPending && hasPaid) {
        setFilters({
          receita: false,
          despesa: true,
          pending: true,
          paid: false
        });
      } else {
        setFilters({
          receita: true,
          despesa: true,
          pending: true,
          paid: true
        });
      }
    }
  }, [selectedCycle, transactions, selectedCardIds, selectedCategoryIds]);

  const chronologicalCycles = React.useMemo(() => {
    const uniqueCycles = Array.from<string>(new Set(allTransactions.map(t => getEffectiveCycle(t))));
    if (!uniqueCycles.includes(currentCycleId)) {
      uniqueCycles.push(currentCycleId);
    }
    return uniqueCycles.sort();
  }, [allTransactions, currentCycleId]);

  const sortedCycles = React.useMemo(() => {
    const future = chronologicalCycles.filter(c => c > currentCycleId); // Already sorted ASC
    const past = chronologicalCycles.filter(c => c < currentCycleId).reverse(); // Sorted DESC
    return [currentCycleId, ...future, ...past];
  }, [chronologicalCycles, currentCycleId]);

  const handlePrevCycle = () => {
    const idx = chronologicalCycles.indexOf(selectedCycle);
    if (idx > 0) {
      setSelectedCycle(chronologicalCycles[idx - 1]);
    }
  };

  const handleNextCycle = () => {
    const idx = chronologicalCycles.indexOf(selectedCycle);
    if (idx !== -1 && idx < chronologicalCycles.length - 1) {
      setSelectedCycle(chronologicalCycles[idx + 1]);
    }
  };

  const formatCycleName = (cycleId: string) => {
    const [y, m] = cycleId.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    return `${month}/${y}`;
  };

  const handleTogglePayment = async (t: any) => {
    const isNowPaid = !t.isPaid;

    if (isNowPaid) {
      // O mesmo título precisa ser baixado pelo mesmo modal em todas as telas.
      // Isso garante forma de pagamento, conta e baixa integral antes de gravar.
      setConfirmPaymentTransactionId(t.id);
      return;
    }

    if (!isNowPaid) {
      setConfirmModal({
        title: t.type === 'receita' ? 'Estornar Recebimento' : 'Estornar Pagamento',
        description: t.type === 'receita'
          ? 'Deseja cancelar o recebimento e estornar o valor desta transação?'
          : 'Deseja cancelar o pagamento e estornar o valor desta transação?',
        onConfirm: async () => {
          await executeTogglePayment(t, isNowPaid);
        }
      });
    } else {
      await executeTogglePayment(t, isNowPaid);
    }
  };

  const executeTogglePayment = async (t: any, isNowPaid: boolean) => {
    const paymentDate = isNowPaid ? new Date() : null;
    await api.transactions.update(t.id, { isPaid: isNowPaid, paymentDate });
  };

  const filtered = transactions.filter(t => {
    if (t.notes?.startsWith('transferencia:')) return false;
    if (selectedCycle !== 'all' && getEffectiveCycle(t) !== selectedCycle) return false;
    if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;

    // Type filter
    if (t.type === 'receita' && !filters.receita) return false;
    if (t.type === 'despesa' && !filters.despesa) return false;

    const tHasCard = Boolean(t.cardId && t.cardId !== 'money');

    // Status filter
    if (!tHasCard) {
      if (t.isPaid && !filters.paid) return false;
      if (!t.isPaid && !filters.pending) return false;
    }

    // Category & Card filtering
    const hasCategoryFilter = selectedCategoryIds.length > 0;
    const hasCardFilter = selectedCardIds.length > 0;

    if (!hasCategoryFilter && !hasCardFilter) {
      return true;
    }

    if (hasCategoryFilter && !selectedCategoryIds.includes(t.categoryId)) {
      return false;
    }

    if (hasCardFilter) {
      if (!tHasCard || !selectedCardIds.includes(t.cardId as string)) {
        return false;
      }
    }

    return true;
  });

  // We will move the totals calculation to be below displayItems
  // so we can calculate it directly from displayItems, which prevents discrepancies.

  const getFilterLabel = () => {
    const active: string[] = [];
    if (filters.receita) active.push('REC.');
    if (filters.despesa) active.push('DESP.');
    if (filters.pending) active.push('PEND.');
    if (filters.paid) active.push('PAGAS');

    if (active.length === 4) return '✨ TODAS';
    if (active.length === 0) return '❌ NENHUM';
    return active.join(' + ');
  };

  const displayItems = React.useMemo(() => {
    const items: any[] = [];
    const cardInvoices = new Map<string, any>(); // cardId + cycleId -> VirtualInvoice

    filtered.forEach(t => {
      // Se for transação de crédito, não coloca solta na lista. Agrupa na fatura.
      if (t.cardId && t.cardId !== 'money') {
        const cycleId = getEffectiveCycle(t);
        // Uma fatura continua sendo uma única unidade mesmo quando parte dela
        // já foi paga. Separar por status fazia a mesma fatura aparecer duas
        // vezes na tela de transações.
        const invoiceKey = `${t.cardId}-${cycleId}`;

        if (!cardInvoices.has(invoiceKey)) {
          const card = cards.find(c => c.id === t.cardId);
          
          let dueDate = new Date(t.date);
          if (card) {
            const cycleData = getCycleId(new Date(t.date), card.closingDay, card.dueDay);
            dueDate = cycleData.dueDate;
          }

          cardInvoices.set(invoiceKey, {
            id: `invoice-${invoiceKey}`,
            isVirtualInvoice: true,
            cardId: t.cardId,
            cycleId,
            description: `Fatura ${card ? card.name : 'Cartão'}`,
            amount: 0,
            date: dueDate,
            type: 'despesa',
            paidAmount: 0,
            outstandingAmount: 0,
            isPaid: false,
            isPartiallyPaid: false,
            isPaidEarly: false,
            paidAt: null,
            color: card?.color,
            brand: card?.brand
          });
        }

        const inv = cardInvoices.get(invoiceKey);
        if (t.type === 'despesa') {
          inv.amount += t.amount;
          if (t.isPaid) inv.paidAmount += t.amount;
          else inv.outstandingAmount += t.amount;
        } else {
          inv.amount -= t.amount;
          if (t.isPaid) inv.paidAmount -= t.amount;
          else inv.outstandingAmount -= t.amount;
        }

        inv.isPaid = inv.outstandingAmount <= 0.005;
        inv.isPartiallyPaid = inv.paidAmount > 0.005 && inv.outstandingAmount > 0.005;
      } else {
        items.push(t);
      }
    });

    for (const invoice of cardInvoices.values()) {
      const card = cards.find(currentCard => currentCard.id === invoice.cardId);
      if (!card || !invoice.isPaid) continue;

      const paymentDates = allTransactions
        .filter(transaction => isInvoicePayment(transaction)
          && (transaction.notes === `${INVOICE_PAYMENT_PREFIX}${invoice.cardId}-${invoice.cycleId}`
            || transaction.notes?.startsWith(`${INVOICE_PAYMENT_PREFIX}${invoice.cardId}-${invoice.cycleId}:`)))
        .map(transaction => getCashDate(transaction))
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => a.getTime() - b.getTime());

      const closingDate = getInvoiceClosingDate(invoice.date, card.closingDay, card.dueDay);
      invoice.paidAt = paymentDates[paymentDates.length - 1] || null;
      invoice.isPaidEarly = paymentDates.some(paymentDate => paymentDate <= closingDate);
    }

    const finalInvoices = Array.from(cardInvoices.values()).filter(inv => {
      if (inv.isPaid && !filters.paid) return false;
      if (!inv.isPaid && !filters.pending) return false;
      return true;
    });

    items.push(...finalInvoices);
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filtered, allTransactions, cards, filters.paid, filters.pending]);

  const totals = React.useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    
    displayItems.forEach(item => {
      if (item.isVirtualInvoice) {
        despesas += item.amount;
      } else {
        if (item.notes?.startsWith('transferencia:')) return;
        if (item.type === 'receita') {
          receitas += item.amount;
        } else {
          despesas += item.amount;
        }
      }
    });
    return {
      receitas,
      despesas,
      saldo: receitas - despesas
    };
  }, [displayItems]);

  const handleExportExcel = () => {
    if (displayItems.length === 0) return;

    // Use displayItems directly since it's already sorted ASC now
    const grouped = displayItems.reduce((acc, t) => {
      const cycle = getEffectiveCycle(t);
      if (!acc[cycle]) acc[cycle] = [];
      acc[cycle].push(t);
      return acc;
    }, {} as Record<string, any[]>);

    const aoa: any[][] = [];
    let totalGeralReceitas = 0;
    let totalGeralDespesas = 0;

    Object.keys(grouped).sort().forEach(cycle => {
      const items = grouped[cycle];
      let monthReceitas = 0;
      let monthDespesas = 0;

      aoa.push([{
        v: `Mês: ${formatCycleName(cycle)}`,
        s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "3B82F6" } } }
      }]);
      aoa.push([
        { v: "Data", s: { font: { bold: true } } },
        { v: "Descrição", s: { font: { bold: true } } },
        { v: "Categoria", s: { font: { bold: true } } },
        { v: "Tipo", s: { font: { bold: true } } },
        { v: "Valor", s: { font: { bold: true } } },
        { v: "Situação", s: { font: { bold: true } } }
      ]);

      items.forEach(t => {
        let catName = 'N/A';
        if (t.isVirtualInvoice) {
          catName = 'Fatura';
        } else {
          const cat = categories.find(c => c.id === t.categoryId);
          if (cat) catName = cat.name;
        }

        if (t.type === 'receita') {
          monthReceitas += t.amount;
          totalGeralReceitas += t.amount;
        } else {
          monthDespesas += t.amount;
          totalGeralDespesas += t.amount;
        }

        aoa.push([
          t.date.toLocaleDateString('pt-BR'),
          t.description,
          catName,
          t.type === 'receita' ? 'Receita' : 'Despesa',
          t.amount,
          (t.isPaid || t.isVirtualInvoice) ? 'Pago' : 'Pendente'
        ]);
      });

      const isPositiveMonth = (monthReceitas - monthDespesas) >= 0;
      aoa.push([]);
      aoa.push([
        "", "", "",
        { v: "Total Mês:", s: { font: { bold: true } } },
        {
          v: `Rec: ${formatCurrency(monthReceitas)} | Desp: ${formatCurrency(monthDespesas)} | Saldo: ${formatCurrency(monthReceitas - monthDespesas)}`,
          s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: isPositiveMonth ? "10B981" : "EF4444" } } }
        },
        ""
      ]);
      aoa.push([]);
    });

    const isPositiveTotal = (totalGeralReceitas - totalGeralDespesas) >= 0;
    aoa.push([]);
    aoa.push([
      "", "", "",
      { v: "TOTAL GERAL:", s: { font: { bold: true } } },
      {
        v: `Rec: ${formatCurrency(totalGeralReceitas)} | Desp: ${formatCurrency(totalGeralDespesas)} | Saldo: ${formatCurrency(totalGeralReceitas - totalGeralDespesas)}`,
        s: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: isPositiveTotal ? "059669" : "DC2626" } } }
      },
      ""
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transações");

    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 40 },
      { wch: 15 }
    ];

    XLSX.writeFile(workbook, `transacoes-${selectedCycle}.xlsx`);
  };

  const handleExportPDF = () => {
    if (displayItems.length === 0) return;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const tableColumn = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Situação"];
    const tableRows: any[] = [];

    const grouped = displayItems.reduce((acc, t) => {
      const cycle = getEffectiveCycle(t);
      if (!acc[cycle]) acc[cycle] = [];
      acc[cycle].push(t);
      return acc;
    }, {} as Record<string, any[]>);

    let totalGeralReceitas = 0;
    let totalGeralDespesas = 0;

    Object.keys(grouped).sort().forEach(cycle => {
      const items = grouped[cycle];
      let monthReceitas = 0;
      let monthDespesas = 0;

      tableRows.push([{ content: `Mês: ${formatCycleName(cycle)}`, colSpan: 6, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: [0, 0, 0] } }]);

      items.forEach(t => {
        let catName = 'N/A';
        if (t.isVirtualInvoice) {
          catName = 'Fatura';
        } else {
          const cat = categories.find(c => c.id === t.categoryId);
          if (cat) catName = cat.name;
        }

        if (t.type === 'receita') {
          monthReceitas += t.amount;
          totalGeralReceitas += t.amount;
        } else {
          monthDespesas += t.amount;
          totalGeralDespesas += t.amount;
        }

        tableRows.push([
          t.date.toLocaleDateString('pt-BR'),
          t.description,
          catName,
          t.type === 'receita' ? 'Receita' : 'Despesa',
          formatCurrency(t.amount),
          (t.isPaid || t.isVirtualInvoice) ? 'Pago' : 'Pendente'
        ]);
      });

      tableRows.push([{
        content: `Total do Mês - Receitas: ${formatCurrency(monthReceitas)} | Despesas: ${formatCurrency(monthDespesas)} | Saldo: ${formatCurrency(monthReceitas - monthDespesas)}`,
        colSpan: 6,
        styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] }
      }]);
    });

    tableRows.push([{
      content: `TOTAL GERAL - Receitas: ${formatCurrency(totalGeralReceitas)} | Despesas: ${formatCurrency(totalGeralDespesas)} | Saldo: ${formatCurrency(totalGeralReceitas - totalGeralDespesas)}`,
      colSpan: 6,
      styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 230, 230], textColor: [0, 0, 0] }
    }]);

    const cycleText = selectedCycle === 'all' ? 'Todo o Período' : formatCycleName(selectedCycle);
    const typeFilter = filters.receita && filters.despesa ? 'Receitas e despesas' : filters.receita ? 'Somente receitas' : filters.despesa ? 'Somente despesas' : 'Nenhum tipo';
    const statusFilter = filters.paid && filters.pending ? 'Pagos e pendentes' : filters.paid ? 'Somente pagos' : filters.pending ? 'Somente pendentes' : 'Nenhuma situação';
    const categoryFilter = selectedCategoryIds.length > 0
      ? `Categorias: ${selectedCategoryIds.map(id => categories.find(category => category.id === id)?.name || 'Categoria').join(', ')}`
      : '';
    const cardFilter = selectedCardIds.length > 0
      ? `Cartões: ${selectedCardIds.map(id => cards.find(card => card.id === id)?.name || 'Cartão').join(', ')}`
      : '';
    const activeFilters = [`Período: ${cycleText}`, `Tipo: ${typeFilter}`, `Situação: ${statusFilter}`, categoryFilter, cardFilter].filter(Boolean);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Relatório de Transações', 12, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const filterText = `Filtros aplicados: ${activeFilters.join('  •  ')}`;
    const filterLines = doc.splitTextToSize(filterText, 186);
    doc.text(filterLines, 12, 23, { maxWidth: 186 });
    doc.setTextColor(0, 0, 0);

    const summaryY = 29 + (filterLines.length - 1) * 4.5;
    const summaryHeight = 18;
    const saldo = totalGeralReceitas - totalGeralDespesas;
    const saldoColor: [number, number, number] = saldo >= 0 ? [5, 150, 105] : [220, 38, 38];

    // Resumo com fundo suave e cantos arredondados para separar visualmente
    // os filtros da tabela e facilitar a leitura no PDF impresso.
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(255, 214, 183);
    doc.setLineWidth(0.25);
    doc.roundedRect(12, summaryY, 186, summaryHeight, 3, 3, 'FD');
    doc.setFillColor(249, 115, 22);
    doc.roundedRect(12, summaryY, 3, summaryHeight, 1.5, 1.5, 'F');

    const summaryColumns = [
      { label: 'RECEITAS', value: formatCurrency(totalGeralReceitas), color: [5, 150, 105] as [number, number, number] },
      { label: 'DESPESAS', value: formatCurrency(totalGeralDespesas), color: [220, 38, 38] as [number, number, number] },
      { label: 'SALDO', value: formatCurrency(saldo), color: saldoColor },
    ];
    summaryColumns.forEach((item, index) => {
      const x = 20 + index * 59;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(105, 105, 105);
      doc.text(item.label, x, summaryY + 6);
      doc.setFontSize(10);
      doc.setTextColor(...item.color);
      doc.text(item.value, x, summaryY + 13);
    });
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: summaryY + summaryHeight + 7,
      margin: { left: 12, right: 12 },
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.2, right: 2.5, bottom: 2.2, left: 2.5 },
        lineColor: [218, 218, 218],
        lineWidth: 0.2,
        valign: 'middle',
        overflow: 'linebreak',
      },
      bodyStyles: { minCellHeight: 8 },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      columnStyles: {
        0: { cellWidth: 21 },
        1: { cellWidth: 47 },
        2: { cellWidth: 35 },
        3: { cellWidth: 23 },
        4: { cellWidth: 27, halign: 'right' },
        5: { cellWidth: 27 },
      },
      headStyles: {
        fillColor: false,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        cellPadding: { top: 2.8, right: 2.5, bottom: 2.8, left: 2.5 },
      },
      willDrawCell: data => {
        if (data.section === 'head') {
          // Cada célula recebe seu próprio arredondamento, mantendo o laranja
          // destacado sem transformar a tabela em um bloco pesado.
          doc.setFillColor(249, 115, 22);
          doc.roundedRect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 1.5, 1.5, 'F');
          data.cell.styles.fillColor = false;
        }
      },
    });

    doc.save(`transacoes-${selectedCycle}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-background relative pt-6 px-4 max-w-6xl mx-auto w-full lg:px-8">
      <header className="px-4 pb-3">
        <div className="flex justify-between items-end mb-4 relative">
          <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
          <div className="relative flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={displayItems.length === 0}
              className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/20 transition-all disabled:opacity-30 shadow-sm"
              title="Exportar para Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden xs:inline">Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={displayItems.length === 0}
              className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-500 hover:bg-rose-500/20 transition-all disabled:opacity-30 shadow-sm"
              title="Exportar para PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden xs:inline">PDF</span>
            </button>
            <button
              onClick={() => setIsCatFilterOpen(!isCatFilterOpen)}
              className={`flex items-center justify-center h-8 w-8 rounded-lg border transition-all ${(selectedCategoryIds.length > 0 || selectedCardIds.length > 0)
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              title="Filtrar por Categoria e Cartão"
            >
              <Filter className="w-4 h-4" />
            </button>

            {isCatFilterOpen && (
              <>
                <div className="fixed inset-0 z-[190]" onClick={() => setIsCatFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border shadow-xl rounded-xl p-2 z-[200] max-h-72 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-2">Categorias</div>
                  {categories
                    .filter(c => c.type === 'receita' || c.showInAccounts !== false)
                    .map(cat => {
                      const isSelected = selectedCategoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategoryIds(prev =>
                              isSelected ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                            );
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/50 rounded-lg transition-colors text-xs font-medium text-left"
                        >
                          <div className="flex items-center gap-2 max-w-[80%]">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#ccc' }} />
                            <span className="truncate">{cat.name}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      )
                    })}

                  {cards.length > 0 && (
                    <>
                      <div className="h-px bg-border my-1.5" />
                      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-2">Cartões</div>
                      {cards.map(card => {
                        const isSelected = selectedCardIds.includes(card.id);
                        return (
                          <button
                            key={card.id}
                            onClick={() => {
                              setSelectedCardIds(prev =>
                                isSelected ? prev.filter(id => id !== card.id) : [...prev, card.id]
                              );
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/50 rounded-lg transition-colors text-xs font-medium text-left"
                          >
                            <div className="flex items-center gap-2 max-w-[80%]">
                              <div className="w-2.5 h-2.5 rounded border border-white/10 shrink-0" style={{ backgroundColor: card.color }} />
                              <span className="truncate">{card.name}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                          </button>
                        )
                      })}
                    </>
                  )}

                  {(selectedCategoryIds.length > 0 || selectedCardIds.length > 0) && (
                    <>
                      <div className="h-px bg-border my-1.5" />
                      <button
                        onClick={() => {
                          setSelectedCategoryIds([]);
                          setSelectedCardIds([]);
                          setFilters({
                            receita: true,
                            despesa: true,
                            pending: true,
                            paid: true
                          });
                          setHasClickedType(false);
                          setHasClickedStatus(false);
                        }}
                        className="w-full py-1 text-[9px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-600 text-center transition-colors"
                      >
                        Limpar Filtros
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar transações..."
            className="pl-9 bg-muted/50 border-none rounded-[11px] h-10 text-sm focus-visible:ring-primary shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Totalizadores */}
        <div className="grid grid-cols-3 gap-2 mt-3.5">
          <div className="bg-card/40 border border-border/40 rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Receitas</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-500 mt-1 truncate">
              {formatCurrency(totals.receitas)}
            </span>
          </div>
          <div className="bg-card/40 border border-border/40 rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Despesas</span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-500 mt-1 truncate">
              {formatCurrency(totals.despesas)}
            </span>
          </div>
          <div className="bg-card/40 border border-border/40 rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Saldo</span>
            <span className={`text-xs font-bold mt-1 truncate ${totals.saldo >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
              {formatCurrency(totals.saldo)}
            </span>
          </div>
        </div>
      </header>

      <div className="px-4 mb-3 flex gap-2 items-center">
        <div className="flex-1 flex items-center gap-1 min-w-0">
          <button
            onClick={handlePrevCycle}
            disabled={selectedCycle === 'all' || chronologicalCycles.indexOf(selectedCycle) <= 0}
            className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 disabled:opacity-20 disabled:pointer-events-none transition-all h-10 w-9 flex items-center justify-center shrink-0"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <Select value={selectedCycle} onValueChange={setSelectedCycle}>
            <SelectTrigger className="flex-1 bg-muted/30 border-border/50 rounded-[11px] !h-10 text-xs font-bold uppercase tracking-wider text-foreground focus:ring-primary shadow-none hover:bg-muted/50 transition-colors min-w-0">
              <SelectValue placeholder="Mês" className="justify-center !text-center flex-1">
                {selectedCycle === 'all' ? '✨ TODO O PERÍODO' : formatCycleName(selectedCycle)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl z-[200]" side="bottom" sideOffset={4} alignItemWithTrigger={false}>
              <SelectItem value="all" className="text-sm font-medium">✨ TODO O PERÍODO</SelectItem>
              {sortedCycles.map(c => (
                <SelectItem key={c} value={c} className="text-sm font-medium capitalize">
                  {formatCycleName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            onClick={handleNextCycle}
            disabled={selectedCycle === 'all' || chronologicalCycles.indexOf(selectedCycle) === -1 || chronologicalCycles.indexOf(selectedCycle) >= chronologicalCycles.length - 1}
            className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 disabled:opacity-20 disabled:pointer-events-none transition-all h-10 w-9 flex items-center justify-center shrink-0"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            className="flex items-center justify-center gap-1.5 px-3 bg-muted/30 border border-border/50 rounded-[11px] h-10 text-xs font-bold uppercase text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-none hover:bg-muted/50 transition-colors"
            title="Filtrar Transações"
          >
            <Filter className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline truncate max-w-[80px]">{getFilterLabel()}</span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
          </button>

          {filterDropdownOpen && (() => {
            const toggleTypeFilter = (type: 'receita' | 'despesa') => {
              setFilters(prev => {
                const other = type === 'receita' ? 'despesa' : 'receita';
                if (!hasClickedType && prev[type] && prev[other]) {
                  setHasClickedType(true);
                  return { ...prev, [type]: true, [other]: false };
                }
                setHasClickedType(true);
                return { ...prev, [type]: !prev[type] };
              });
            };

            const toggleStatusFilter = (status: 'pending' | 'paid') => {
              setFilters(prev => {
                const other = status === 'pending' ? 'paid' : 'pending';
                if (!hasClickedStatus && prev[status] && prev[other]) {
                  setHasClickedStatus(true);
                  return { ...prev, [status]: true, [other]: false };
                }
                setHasClickedStatus(true);
                return { ...prev, [status]: !prev[status] };
              });
            };

            return (
              <div className="absolute right-0 top-full mt-1 w-full min-w-[200px] bg-popover text-popover-foreground border border-border rounded-xl shadow-md p-1.5 z-[250] animate-in fade-in-0 zoom-in-95 duration-100">
                <div
                  onClick={() => {
                    const allActive = Object.values(filters).every(v => v);
                    setFilters({
                      receita: !allActive,
                      despesa: !allActive,
                      pending: !allActive,
                      paid: !allActive
                    });
                    setHasClickedType(false);
                    setHasClickedStatus(false);
                  }}
                  className="relative flex w-full cursor-default items-center justify-between rounded-md py-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider select-none hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <span>✨ TODAS AS TRANSAÇÕES</span>
                  {Object.values(filters).every(v => v) && <Check className="size-3.5 text-primary" />}
                </div>

                <div className="h-px bg-border my-1" />

                <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-0.5 mb-0.5">Tipo</div>
                <div
                  onClick={() => toggleTypeFilter('receita')}
                  className="relative flex w-full cursor-default items-center justify-between rounded-md py-1.5 px-2.5 text-xs font-bold uppercase tracking-wider select-none hover:bg-accent text-emerald-600 dark:text-emerald-500 hover:text-accent-foreground transition-colors"
                >
                  <span>🟢 RECEITAS</span>
                  {filters.receita && <Check className="size-3.5 text-emerald-600 dark:text-emerald-500" />}
                </div>
                <div
                  onClick={() => toggleTypeFilter('despesa')}
                  className="relative flex w-full cursor-default items-center justify-between rounded-md py-1.5 px-2.5 text-xs font-bold uppercase tracking-wider select-none hover:bg-accent text-rose-600 dark:text-rose-500 hover:text-accent-foreground transition-colors"
                >
                  <span>🔴 DESPESAS</span>
                  {filters.despesa && <Check className="size-3.5 text-rose-600 dark:text-rose-500" />}
                </div>

                <div className="h-px bg-border my-1" />

                <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-0.5 mb-0.5">Situação</div>
                <div
                  onClick={() => toggleStatusFilter('pending')}
                  className="relative flex w-full cursor-default items-center justify-between rounded-md py-1.5 px-2.5 text-xs font-bold uppercase tracking-wider select-none hover:bg-accent text-amber-600 dark:text-amber-500 hover:text-accent-foreground transition-colors"
                >
                  <span>⏳ PENDENTES</span>
                  {filters.pending && <Check className="size-3.5 text-amber-600 dark:text-amber-500" />}
                </div>
                <div
                  onClick={() => toggleStatusFilter('paid')}
                  className="relative flex w-full cursor-default items-center justify-between rounded-md py-1.5 px-2.5 text-xs font-bold uppercase tracking-wider select-none hover:bg-accent text-primary hover:text-accent-foreground transition-colors"
                >
                  <span>✅ PAGAS</span>
                  {filters.paid && <Check className="size-3.5 text-primary" />}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-4">
        <div className="flex flex-col gap-2.5">
          {displayItems.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 flex flex-col items-center border border-dashed rounded-[11px] border-border/50">
              <div className="bg-card w-10 h-10 rounded-[11px] flex items-center justify-center mb-3">
                <Search className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-xs">Nenhuma transação</p>
            </div>
          ) : (
            displayItems.map((t, i) => {
              const isExpanded = expandedId === t.id;
              const isInvoice = t.isVirtualInvoice;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={t.id}
                  className={`flex flex-col bg-card shadow-sm rounded-[11px] border cursor-pointer hover:border-primary/50 transition-colors overflow-hidden ${isExpanded ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                >
                  {/* Main Row */}
                  <div
                    className="flex items-center justify-between p-3"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isInvoice ? (
                        <div className="p-2 rounded-[11px] text-white" style={{ backgroundColor: t.color || '#333' }}>
                          <CreditCard className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className={`p-2 rounded-[11px] ${t.type === 'receita' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500' :
                          !t.isPaid ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500'
                          }`}>
                          {t.type === 'receita' ? <TrendingUp className="h-4 w-4" /> :
                            !t.isPaid ? <Clock className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-xs mb-0.5 tracking-tight flex items-center gap-1.5 flex-wrap">
                          {t.description}
                          {isInvoice && t.brand && <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t.brand}</span>}
                          {t.notes && t.notes.startsWith('paymentMethod:') && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {t.notes.replace('paymentMethod:', '')}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex flex-col gap-0.5 font-medium">
                          <span className="flex items-center gap-1 flex-wrap">
                            {isInvoice ? 'Vencimento da Fatura' : 'Lançamento'}: {t.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            {!isInvoice && (() => {
                              const category = useDataStore.getState().categories.find(c => c.id === t.categoryId);
                              if (!category) return null;
                              return (
                                <>
                                  <span className="opacity-40">•</span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color || '#ccc' }} />
                                    <span>{category.name}</span>
                                  </span >
                                </>
                              );
                            })()}
                          </span>
                          {t.isPaid && t.paymentDate && (
                            <span className="text-emerald-600 dark:text-emerald-500 font-bold">Pago em: {new Date(t.paymentDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                          )}
                          {isInvoice && t.paidAt && (
                            <span className="text-emerald-600 dark:text-emerald-500 font-bold">
                              {t.isPaidEarly ? 'Antecipada em: ' : 'Paga em: '}{t.paidAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                          {t.installments && t.installments > 1 && (
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 self-start">
                              {t.currentInstallment}/{t.installments}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className={`font-bold text-xs ${t.type === 'receita' ? 'text-emerald-600 dark:text-emerald-500' :
                          (t.isPaid || isInvoice) ? 'text-foreground' : 'text-amber-600 dark:text-amber-500'
                          }`}>
                          {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
                        </div>
                        {!t.isPaid && !isInvoice && <div className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-1">Pendente</div>}
                        {t.isPaid && !isInvoice && <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest mt-1">Pago</div>}
                        {isInvoice && !t.isPaid && !t.isPartiallyPaid && <div className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-1">Fatura Aberta</div>}
                        {isInvoice && t.isPartiallyPaid && <div className="text-[9px] text-orange-500 font-bold uppercase tracking-widest mt-1">Pagamento parcial</div>}
                        {isInvoice && t.isPaid && (
                          <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest mt-1">
                            {t.isPaidEarly ? 'Fatura Paga antecipadamente' : 'Fatura Paga'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Area */}
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="border-t bg-muted/10 p-3 flex gap-2"
                    >
                      {isInvoice ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-2 text-center">
                          <p className="text-xs font-medium text-muted-foreground">Para dar baixa nesta fatura ou ver os lançamentos individuais, acesse a área de Cartões/Faturas.</p>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (t.isPaid) {
                                handleTogglePayment(t);
                              } else {
                                setConfirmPaymentTransactionId(t.id);
                              }
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${t.isPaid
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-400'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400'
                              }`}
                          >
                            {t.isPaid ? (
                              <><Clock className="w-4 h-4" /> Estornar</>
                            ) : t.type === 'receita' ? (
                              <><CheckCircle2 className="w-4 h-4" /> Confirmar Recebimento</>
                            ) : (
                              <><CheckCircle2 className="w-4 h-4" /> Confirmar Pagamento</>
                            )}
                          </button>

                          {!t.isPaid && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTransactionId(t.id);
                                setTransactionModalOpen(true);
                              }}
                              className="px-4 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg flex items-center justify-center transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

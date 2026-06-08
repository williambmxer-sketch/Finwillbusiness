import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDataStore } from '../store/useDataStore';
import { api } from '../services/api';
import { Card } from '../db/db';
import { generateUUID } from '../lib/utils';
import { X, Save, Trash } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function CardModal() {
  const { isCardModalOpen, setCardModalOpen, editingCardId, setEditingCardId } = useAppStore();

  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState('10');
  const [dueDay, setDueDay] = useState('17');
  const [lastFour, setLastFour] = useState('');
  const [color, setColor] = useState('#1a1a1a');

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') {
      setLimit('');
      return;
    }
    const numericValue = (parseInt(value, 10) / 100).toFixed(2);
    setLimit(numericValue);
  };

  const displayLimit = limit ? parseFloat(limit).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

  useEffect(() => {
    if (editingCardId && isCardModalOpen) {
      const c = useDataStore.getState().cards.find(card => card.id === editingCardId);
      if (c) {
          setName(c.name);
          setBank(c.bank);
          setLimit(c.limit.toString());
          setClosingDay(c.closingDay.toString());
          setDueDay(c.dueDay.toString());
          setLastFour(c.lastFour);
          setColor(c.color);
        }
    } else {
      setName('');
      setBank('');
      setLimit('');
      setClosingDay('10');
      setDueDay('17');
      setLastFour('');
      setColor('#1a1a1a');
    }
  }, [editingCardId, isCardModalOpen]);

  const handleSave = async () => {
    if (!name || !limit) return;
    
    const card: Card = {
      id: editingCardId || generateUUID(),
      name,
      bank: bank || 'Banco',
      brand: 'Mastercard', // Simplified for now
      color,
      limit: parseFloat(limit),
      closingDay: parseInt(closingDay),
      dueDay: parseInt(dueDay),
      lastFour: lastFour.slice(-4) || '0000',
    };

    if (editingCardId) {
      await api.cards.update(editingCardId, card);
    } else {
      await api.cards.add(card);
    }
    
    closeModal();
  };

  const handleDelete = async () => {
    if (editingCardId) {
      await api.cards.delete(editingCardId);
      closeModal();
    }
  };

  const closeModal = () => {
    setCardModalOpen(false);
    setTimeout(() => setEditingCardId(null), 300);
  };

  if (!isCardModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm sm:backdrop-blur-md">
      <div className="w-full max-w-md bg-card border-t sm:border border-border sm:rounded-[20px] rounded-t-[24px] shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90dvh] transition-all relative">
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted rounded-full" />
        
        <div className="flex justify-between items-center p-5 pb-4 border-b">
          <h2 className="text-base font-bold tracking-tight">{editingCardId ? 'Editar Cartão' : 'Novo Cartão'}</h2>
          <button onClick={closeModal} className="p-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Limite do Cartão</span>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold text-muted-foreground">R$</span>
                <Input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="0,00"
                  className="w-[180px] p-0 text-center text-4xl font-bold h-12 bg-transparent border-none shadow-none focus-visible:ring-0"
                  value={displayLimit}
                  onChange={handleLimitChange}
                />
              </div>
            </div>

            <div className="bg-muted/10 rounded-[24px] p-5 space-y-4 border border-border/30">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Nome do Cartão</Label>
                <Input 
                  placeholder="Ex: NuBank Black" 
                  className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">4 Últimos Dígitos</Label>
                  <Input 
                    placeholder="1234"
                    maxLength={4}
                    className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none font-mono tracking-widest"
                    value={lastFour}
                    onChange={e => setLastFour(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Cor</Label>
                  <div className="h-11 flex items-center bg-background border border-border shadow-sm rounded-xl px-3 relative">
                     <input 
                      type="color" 
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="w-5 h-5 rounded-full border border-border mr-2" style={{ backgroundColor: color }} />
                    <span className="text-xs uppercase font-mono text-muted-foreground flex-1">{color}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Dia Fechamento</Label>
                  <Input 
                    type="number" min="1" max="31"
                    className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none font-medium"
                    value={closingDay}
                    onChange={e => setClosingDay(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Dia Vencimento</Label>
                  <Input 
                    type="number" min="1" max="31"
                    className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none font-medium"
                    value={dueDay}
                    onChange={e => setDueDay(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 p-4 border-t pb-8 sm:pb-4 bg-background">
          {editingCardId && (
            <button onClick={handleDelete} className="p-3 w-12 border border-destructive/20 text-destructive rounded-xl flex items-center justify-center hover:bg-destructive/10 transition-colors">
              <Trash className="w-5 h-5" />
            </button>
          )}
          <button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground text-sm font-bold rounded-xl h-11 flex items-center justify-center transition-all">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

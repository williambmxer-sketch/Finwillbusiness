import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../services/api';
import { useDataStore } from '../store/useDataStore';
import { Category } from '../db/db';
import { generateUUID } from '../lib/utils';
import { X, Save, Trash, User, Briefcase, Car, Coffee, Home as HomeIcon, Phone, ShoppingCart } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function CategoryModal() {
  const { isCategoryModalOpen, setCategoryModalOpen } = useAppStore();
  const categories = useDataStore(state => state.categories);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'receita'|'despesa'>('despesa');
  const [color, setColor] = useState('#3b82f6');
  
  const handleEdit = (c: Category) => {
    setEditingId(c.id);
    setName(c.name);
    setType(c.type);
    setColor(c.color);
  };
  
  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setType('despesa');
    setColor('#3b82f6');
  };

  const handleSave = async () => {
    if (!name) return;
    const cat: Category = {
      id: editingId || generateUUID(),
      name,
      type,
      color,
      icon: 'Tag', // default icon for newly created specific tags
    };
    if (editingId) {
      await api.categories.update(cat.id, cat);
    } else {
      await api.categories.add(cat);
    }
    handleCancelEdit();
  };

  const handleDelete = async (id: string) => {
    await api.categories.delete(id);
    if (editingId === id) handleCancelEdit();
  };

  if (!isCategoryModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm sm:backdrop-blur-md">
      <div className="w-full max-w-md bg-card border-t sm:border border-border sm:rounded-[20px] rounded-t-[24px] shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90dvh] transition-all relative">
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted rounded-full" />
        
        <div className="flex justify-between items-center p-4 pb-3 border-b">
          <h2 className="text-sm font-bold tracking-tight">Categorias</h2>
          <button onClick={() => setCategoryModalOpen(false)} className="p-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Form */}
          <div className="p-4 bg-muted/10 border-b">
            <div className="flex gap-2 mb-3">
              <div className="flex flex-1 items-center bg-muted/80 p-1.5 rounded-xl basis-1/3">
                <button 
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'despesa' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setType('despesa')}
                >Desp</button>
                <button 
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'receita' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setType('receita')}
                >Rec</button>
              </div>
              <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-border shadow-sm flex-shrink-0">
                <input 
                  type="color" 
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="absolute -inset-2 w-12 h-12 cursor-pointer"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Input 
                placeholder="Nome..." 
                className="rounded-[12px] h-11 text-xs bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary shadow-none flex-1"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <button onClick={handleSave} className="px-4 bg-primary text-primary-foreground font-bold text-[10px] h-11 rounded-[12px] hover:bg-primary/90 transition-all uppercase tracking-wider">
                {editingId ? 'Salvar' : 'Add'}
              </button>
              {editingId && (
                <button onClick={handleCancelEdit} className="px-3 bg-muted text-foreground font-bold text-[10px] h-11 rounded-[12px] hover:bg-muted/80 transition-colors uppercase tracking-wider">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 pb-8 sm:pb-2">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-card border border-border/50 shadow-sm hover:border-primary/30 transition-colors text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: c.color }} />
                  <div>
                    <div className="font-semibold leading-none mb-0.5">{c.name}</div>
                    <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider leading-none">{c.type === 'receita' ? 'Rec' : 'Desp'}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(c)} className="text-[9px] font-bold text-primary px-2 py-1 bg-primary/10 rounded uppercase tracking-wider hover:bg-primary/20 transition-colors">Editar</button>
                  <button onClick={() => handleDelete(c.id)} className="text-destructive p-1 bg-destructive/10 rounded hover:bg-destructive/20 transition-colors"><Trash className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="text-center text-muted-foreground p-8 border border-dashed rounded-[16px] border-border/50 text-xs">
                Nenhuma categoria cadastrada
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

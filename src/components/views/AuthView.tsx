import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, Loader2, User } from 'lucide-react';
import { Input } from '../ui/input';

export function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Só usado no cadastro
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name
            }
          }
        });
        if (signUpError) throw signUpError;
        alert('Cadastro realizado com sucesso! Verifique seu email se o Supabase exigir, ou já estará logado se o auto-confirm estiver ativado.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[340px] bg-card/65 backdrop-blur-xl border border-border/40 rounded-[24px] p-6 shadow-xl relative z-10"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-[14px] flex items-center justify-center mb-3 overflow-hidden">
            <img src="/icone-financas-pwa.svg?v=2" alt="FinWill" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">FinWill Business</h1>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            {isLogin ? 'Financeiro simples para o seu MEI' : 'Crie sua empresa e comece em poucos minutos'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] p-2.5 rounded-lg mb-4 text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Nome Completo</label>
              <div className="relative">
                <Input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-10 bg-muted/40 border-transparent focus:ring-1 focus:ring-primary shadow-none rounded-xl pl-9 text-xs"
                  placeholder="Seu nome"
                  required={!isLogin}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                  <User className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">E-mail</label>
            <div className="relative">
              <Input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-10 bg-muted/40 border-transparent focus:ring-1 focus:ring-primary shadow-none rounded-xl pl-9 text-xs"
                placeholder="seu@email.com"
                required
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                <Mail className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Senha</label>
            <div className="relative">
              <Input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-10 bg-muted/40 border-transparent focus:ring-1 focus:ring-primary shadow-none rounded-xl pl-9 text-xs"
                placeholder="••••••••"
                required
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                <Lock className="w-4 h-4" />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full h-11 bg-primary text-primary-foreground font-bold uppercase tracking-wider text-xs rounded-xl shadow-md hover:bg-primary/95 transition-all flex items-center justify-center gap-1.5 mt-5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                {isLogin ? 'Entrar' : 'Criar Conta'}
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
          >
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

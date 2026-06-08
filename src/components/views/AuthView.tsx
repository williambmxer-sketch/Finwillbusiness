import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { motion } from 'motion/react';
import { Wallet, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-border/50 rounded-[32px] p-8 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-[20px] flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">FinWill</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? 'Acesse suas finanças inteligentemente' : 'Crie sua conta e assuma o controle'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs p-3 rounded-xl mb-6 text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</label>
              <div className="relative">
                <Input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-12 bg-muted/50 border-transparent focus:ring-1 focus:ring-primary shadow-none rounded-[16px] pl-11"
                  placeholder="Seu nome"
                  required={!isLogin}
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Wallet className="w-4 h-4" /> {/* Poderia ser um User icon */}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">E-mail</label>
            <div className="relative">
              <Input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 bg-muted/50 border-transparent focus:ring-1 focus:ring-primary shadow-none rounded-[16px] pl-11"
                placeholder="seu@email.com"
                required
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Mail className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Senha</label>
            <div className="relative">
              <Input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-12 bg-muted/50 border-transparent focus:ring-1 focus:ring-primary shadow-none rounded-[16px] pl-11"
                placeholder="••••••••"
                required
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Lock className="w-4 h-4" />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full h-14 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs rounded-[20px] shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mt-8 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {isLogin ? 'Entrar no Sistema' : 'Criar Conta'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem conta? Faça Login'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

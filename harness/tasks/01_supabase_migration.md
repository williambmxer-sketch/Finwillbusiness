# Tarefas: Migração para Supabase

- [ ] **Configuração do Projeto Supabase**
  - [ ] Criar projeto no painel do Supabase.
  - [ ] Configurar `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

- [ ] **Autenticação**
  - [ ] Habilitar Email/Password Auth no Supabase.
  - [ ] Criar cliente Supabase em `src/db/supabase.ts`.
  - [ ] Criar telas de Login e Cadastro (`AuthPage`).
  - [ ] Criar store no Zustand (`useAuthStore`) para manter a sessão.

- [ ] **Modelagem do Banco de Dados (PostgreSQL)**
  - [ ] Criar tabelas equivalentes ao Dexie atual (`accounts`, `cards`, `categories`, `transactions`).
  - [ ] Adicionar coluna `user_id` vinculada a `auth.users` em todas as tabelas.
  - [ ] Configurar Row Level Security (RLS) para que usuários só vejam seus próprios dados.

- [ ] **Integração de Dados (Refatoração)**
  - [ ] Substituir chamadas do Dexie.js pelas chamadas da API do Supabase nas Modais (AccountModal, CardModal, TransactionModal, CategoryModal).
  - [ ] Atualizar o store `useAppStore.ts` para buscar dados remoto em vez de locais.

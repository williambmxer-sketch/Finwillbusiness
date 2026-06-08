# System Overview

## Stack Tecnológico Atual
- **Frontend**: React 19 + TypeScript + Vite
- **Estilização**: Tailwind CSS v4, componentes Shadcn UI (`@base-ui/react`, `lucide-react`, `class-variance-authority`)
- **Estado Global**: Zustand
- **Formulários**: React Hook Form + Zod
- **Gráficos e Animações**: Recharts e Framer Motion
- **Persistência Local (Atual)**: Dexie.js (IndexedDB) para funcionamento offline-first.

## Stack Alvo (Próximos Passos)
- **Backend & Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth (E-mail/Senha, OAuth)
- **Sincronização**: Substituição ou integração do Dexie com o Supabase para persistência remota em tempo real.

## Estrutura de Diretórios (`src/`)
- `components/`: Componentes reutilizáveis (Modais, UI base).
  - `ui/`: Componentes base do sistema de design (Shadcn).
  - `views/`: Telas e visões completas da aplicação.
- `store/`: Gerenciamento de estado (ex: `useAppStore.ts`).
- `db/`: Conexões de banco de dados (atualmente Dexie, será refatorado para Supabase).
- `utils/`: Funções utilitárias.

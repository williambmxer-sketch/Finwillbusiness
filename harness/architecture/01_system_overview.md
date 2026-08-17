# Visão Geral do Sistema

## Stack efetiva

- **Frontend**: React 19 + TypeScript + Vite.
- **Estilos**: Tailwind CSS v4 e componentes próprios inspirados em Shadcn UI.
- **Estado global**: Zustand.
- **Gráficos e animações**: Recharts e Motion.
- **Persistência principal**: Supabase/PostgreSQL.
- **Autenticação**: Supabase Auth.
- **Offline**: fila parcial em `localStorage`, principalmente para inserções de transações.
- **Dexie**: legado/documentação histórica; não é a fonte de verdade atual.

## Fonte de verdade

O Supabase é a fonte de verdade dos dados persistidos. O frontend usa `src/services/api.ts` para mapear as colunas do banco para os modelos usados pela UI.

As contas mantêm um saldo materializado em `contas.saldo`. Esse saldo é atualizado pelos fluxos de lançamento, baixa, transferência, ajuste manual e pagamento de fatura. Como essas atualizações ainda são chamadas separadas no frontend, operações financeiras críticas devem evoluir para RPC/transação no backend.

## Modelo de caixa

- Transação pendente não é caixa realizado.
- Transação paga usa `data_pagamento` quando disponível; caso contrário, usa `data`.
- Compra de cartão é compromisso e não deve ser somada novamente como saída de conta.
- Pagamento de fatura é registrado como transação técnica com `observacoes` iniciando por `pagamento_fatura:`.
- Transferências são movimentos por conta, mas ficam fora dos totais agregados de receitas e despesas.

## Áreas principais

- `src/components/views/`: dashboard, extrato, contas, cartões, faturas, relatórios e planejamento.
- `src/components/`: modais de transações, contas, cartões, categorias e baixas.
- `src/services/`: API Supabase e sincronização offline.
- `src/store/`: estado de autenticação, dados e navegação.
- `src/utils/`: regras de ciclo de cartão, formatação e regras financeiras compartilhadas.
- `harness/tests/`: invariantes executáveis do domínio financeiro.

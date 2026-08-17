# Estado da Migração para Supabase

## Concluído

- [x] Cliente Supabase em `src/lib/supabase.ts`.
- [x] Autenticação por e-mail e senha.
- [x] Estado de sessão em `useAuthStore`.
- [x] Categorias, contas, cartões, transações e formas de pagamento via API Supabase.
- [x] Mapeadores entre o schema PT-BR do banco e os modelos do frontend.
- [x] Assinatura de mudanças via Realtime.
- [x] Fila offline parcial para transações.

## Pendências de infraestrutura

- [ ] Confirmar RLS em todas as tabelas com testes negativos entre usuários.
- [ ] Gerar tipos oficiais do Supabase e substituir `any` nos mapeadores.
- [ ] Criar RPC/transação para baixa de fatura, transferência e atualização de saldo.
- [ ] Revisar políticas de exclusão e integridade referencial.
- [ ] Documentar o schema real do banco junto ao código.

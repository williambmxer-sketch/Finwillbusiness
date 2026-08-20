# FinWill Business

Financeiro simples para MEI: fluxo de caixa, contas a pagar e receber, cartões,
clientes e fornecedores, planejamento, pró-labore, retiradas e acesso de sócios.
O sistema não emite NF-e, NFS-e ou NFC-e.

## Executar localmente

Requisitos: Node.js 20 ou superior e um projeto Supabase.

1. Instale as dependências com `npm install`.
2. Crie `.env.local` com:

   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
   ```

3. Aplique, em ordem, os arquivos de `supabase/migrations`.
4. Inicie com `npm run dev`.

Ao criar a primeira conta, o banco cria automaticamente a empresa e o vínculo de
proprietário. Em **Cadastros > Usuários e empresa**, uma empresa vazia pode carregar
a demonstração completa de forma explícita. O seed nunca roda automaticamente.

## Verificação

```bash
npm run lint
npm run test:financial
npm run build
```

O teste remoto de RLS e invariantes está em
`harness/tests/remote_business_invariants.sql`. Ele usa uma única transação e termina
com `ROLLBACK`, portanto não mantém usuários nem dados artificiais.

## Produção

Use `npm run build`; os arquivos estáticos são gerados em `dist`. Configure no
provedor de hospedagem as mesmas variáveis `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` usadas no ambiente local.

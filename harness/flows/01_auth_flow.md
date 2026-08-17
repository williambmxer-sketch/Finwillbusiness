# Fluxo de Autenticação (Supabase Auth)

## Login e cadastro

1. `AuthView` alterna entre login e cadastro.
2. O login chama `supabase.auth.signInWithPassword`.
3. O cadastro chama `supabase.auth.signUp` e envia `full_name` nos metadados.
4. Erros são apresentados na própria tela; o sucesso do cadastro usa confirmação do Supabase quando configurada.

## Gestão de sessão

- `App.tsx` chama `supabase.auth.getSession()` ao iniciar.
- `supabase.auth.onAuthStateChange()` mantém a sessão atualizada.
- `useAuthStore` expõe `session`, `user` e `signOut`.
- Sem sessão, o app renderiza `AuthView`; com sessão, carrega os dados do usuário e configura as assinaturas Realtime.

## Isolamento

O frontend envia o usuário autenticado nas inserções. Listagens, atualizações e exclusões dependem das políticas RLS do Supabase para restringir os dados ao usuário da sessão. O harness não considera seguro nenhum fallback que ignore esse escopo.

# Fluxo de Autenticação (Supabase Auth)

## 1. Cadastro (Sign Up)
- Usuário acessa `/register`.
- Preenche E-mail e Senha.
- Frontend valida com Zod + React Hook Form.
- Chama `supabase.auth.signUp()`.
- Criação inicial do perfil no banco via Trigger do Supabase (tabela `public.users`).

## 2. Login (Sign In)
- Usuário acessa `/login`.
- Preenche E-mail e Senha.
- Chama `supabase.auth.signInWithPassword()`.
- Supabase retorna sessão (JWT).
- Zustand salva o estado de autenticação.
- Usuário é redirecionado para o `/dashboard`.

## 3. Gestão de Sessão
- `onAuthStateChange` do Supabase monitora renovações de token e logout.
- Componentes privados são envolvidos por um `ProtectedRoute` que checa o estado no Zustand.
- Se sessão expirar, redireciona para `/login`.

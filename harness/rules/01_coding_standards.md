# Padrões de Código

## Tecnologias e Convenções
1. **Componentes React**: Usar Arrow Functions, `FC` não é estritamente necessário, focar em inferência do TS.
2. **Estilos**: Tailwind CSS com `clsx` e `tailwind-merge` (`cn` utility) para componentes UI (Shadcn UI padrão).
3. **Gerenciamento de Estado**: 
   - Global: Zustand (`src/store`).
   - Local/Forms: React Hook Form.
4. **Validação**: Zod para tipagem forte de esquemas (`z.infer<typeof schema>`).
5. **Backend/DB**: Tudo relacionado ao banco de dados passa pela camada Supabase.
   - Opcionalmente usar Types auto-gerados do Supabase CLI para manter tipagem.
6. **Imports**: Preferir imports absolutos ou aliases se configurado (ex: `@/components/...`).

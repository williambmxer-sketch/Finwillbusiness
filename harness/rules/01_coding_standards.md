# Padrões de Código

## Tecnologias e convenções

1. Componentes React podem usar funções comuns ou arrow functions, com inferência TypeScript.
2. Estilos usam Tailwind CSS; componentes reutilizáveis devem centralizar composição de classes.
3. Estado global usa Zustand; estado de formulário permanece local ao componente.
4. Acesso ao Supabase passa pela camada de API e pelos mapeadores em `src/services/api.ts`.
5. Regras financeiras compartilhadas devem ficar em `src/utils/` e ser reutilizadas por dashboard, relatórios, contas e faturas.
6. Valores monetários devem ser tratados com atenção a arredondamento e nunca depender de fórmulas duplicadas em várias telas.

## Mutação de dados

- Toda mutação deve respeitar o usuário autenticado.
- Operações destrutivas devem falhar de forma segura; nunca usar fallback sem filtro de usuário.
- Baixas devem atualizar `isPaid` e `paymentDate` de forma coerente.
- Ao desfazer uma baixa, `paymentDate` deve ser limpo e o efeito no saldo deve ser estornado.
- Movimentos técnicos devem usar marcadores documentados em `observacoes`.

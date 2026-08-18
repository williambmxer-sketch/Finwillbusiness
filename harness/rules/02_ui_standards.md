# Padrões de Interface (UI) e Layout

## Estrutura de Layout Base
A aplicação adota um conceito **Mobile-First focado em responsividade centralizada**. O layout deve se comportar como um aplicativo de celular mesmo quando aberto em telas desktop largas.

- **Contêiner Principal (Telas)**: Todas as visões da aplicação (`views/`) devem ser envolvidas num contêiner com a classe:
  `className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full"`
  - `max-w-lg mx-auto w-full`: Garante que o conteúdo não ultrapasse o limite de tamanho e fique sempre centralizado no meio da tela no desktop.
  
- **Componentes Fixos (Ex: Botão Flutuante - FAB, Menu Inferior)**:
  - Devem respeitar o mesmo limite visual do contêiner central.
  - Para o FAB (`+`), usamos um wrapper que acompanha o centro da tela:
    `<div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 pointer-events-none flex justify-end px-4">`
  - O elemento iterativo dentro do wrapper recebe `pointer-events-auto`.
  - O Menu Inferior de navegação também possui seu próprio limite `max-w-md mx-auto` dentro da barra fixada.

## Sistema de Design
- Utilizamos **Shadcn UI** (em `src/components/ui/`) para garantir consistência visual e acessibilidade.
- Qualquer novo componente primitivo (botões, inputs, cards) deve preferencialmente usar a base gerada pela CLI do Shadcn (`npx shadcn@latest add <componente>`).
- O utilitário `cn` (Tailwind Merge + Clsx) contido em `src/lib/utils.ts` é padrão para compor as classes dos componentes reutilizáveis.

## Atualizações da aplicação

- O PWA deve usar atualização em modo `prompt`: quando uma nova versão estiver disponível,
  exibir um modal não destrutivo com as ações `Atualizar agora` e `Depois`.
- `Atualizar agora` deve ativar o service worker pendente e recarregar a página; fechar o
  aviso não pode alterar dados nem interromper operações financeiras em andamento.

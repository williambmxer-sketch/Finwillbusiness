-- Vínculo opcional da forma de pagamento à conta que será debitada.
-- É aditivo: formas existentes permanecem com conta_id nulo.
alter table if exists public.formas_pagamento
  add column if not exists conta_id uuid references public.contas(id) on delete set null;

create index if not exists formas_pagamento_conta_id_idx
  on public.formas_pagamento(conta_id);

-- Permite manter contas de reserva/investimento fora dos seletores de rotina.
-- A conta continua existindo, com saldo e histórico, mas pode ser ocultada
-- para pagamentos, recebimentos ou ambos.
alter table public.contas
  add column if not exists mostrar_em_pagamentos boolean not null default true,
  add column if not exists mostrar_em_recebimentos boolean not null default true;

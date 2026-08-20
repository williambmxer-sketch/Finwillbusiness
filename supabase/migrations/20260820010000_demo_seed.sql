-- Dados demonstrativos seguros e opcionais do FinWill Business.
-- A função só atua após ação explícita do usuário, em uma organização
-- completamente vazia, e pode ser chamada repetidamente sem duplicar dados.

begin;

create or replace function public.ensure_business_demo_data()
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  user_id uuid := auth.uid();
  organization_id uuid := public.current_organization_id();
  income_services uuid;
  income_sales uuid;
  income_contribution uuid;
  expense_material uuid;
  expense_software uuid;
  expense_transport uuid;
  expense_utilities uuid;
  expense_taxes uuid;
  expense_prolabore uuid;
  expense_withdrawal uuid;
  expense_transfer uuid;
  account_business uuid;
  account_wallet uuid;
  account_reserve uuid;
  business_card uuid;
  client_studio uuid;
  client_market uuid;
  client_clinic uuid;
  supplier_software uuid;
  supplier_material uuid;
  supplier_services uuid;
  transfer_group uuid := gen_random_uuid();
  month_start date := date_trunc('month', current_date)::date;
  next_month date := (date_trunc('month', current_date) + interval '1 month')::date;
begin
  if user_id is null or organization_id is null then
    raise exception 'Usuário e empresa ativa são obrigatórios.' using errcode = '28000';
  end if;

  if not public.is_organization_editor(organization_id) then
    return false;
  end if;

  if exists (select 1 from public.contas where organizacao_id = organization_id)
    or exists (select 1 from public.transacoes where organizacao_id = organization_id)
    or exists (select 1 from public.categorias where organizacao_id = organization_id)
  then
    return false;
  end if;

  update public.organizacoes
    set nome = 'FinWill Negócios Demo',
        nome_fantasia = 'Ateliê Horizonte',
        atualizado_em = now()
    where id = organization_id
      and nome like 'Empresa de %';

  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Serviços prestados', 'BriefcaseBusiness', '#10b981', 'receita', true, true)
  returning id into income_services;
  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Vendas', 'ShoppingBag', '#22c55e', 'receita', true, true)
  returning id into income_sales;
  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Aporte do titular', 'CircleDollarSign', '#3b82f6', 'receita', false, true)
  returning id into income_contribution;

  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Materiais e insumos', 'Package', '#f97316', 'despesa', true, true)
  returning id into expense_material;
  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Sistemas e assinaturas', 'MonitorCog', '#8b5cf6', 'despesa', true, true)
  returning id into expense_software;
  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Transporte', 'Car', '#eab308', 'despesa', true, true)
  returning id into expense_transport;
  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Contas e serviços', 'ReceiptText', '#06b6d4', 'despesa', true, true)
  returning id into expense_utilities;
  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Impostos e obrigações', 'Landmark', '#ef4444', 'despesa', false, true)
  returning id into expense_taxes;
  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Pró-labore', 'HandCoins', '#7c3aed', 'despesa', false, true)
  returning id into expense_prolabore;
  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Retirada do titular', 'WalletCards', '#a855f7', 'despesa', false, true)
  returning id into expense_withdrawal;
  insert into public.categorias (organizacao_id, usuario_id, nome, icone, cor, tipo, mostrar_em_cartoes, mostrar_em_contas)
  values (organization_id, user_id, 'Transferência', 'ArrowRightLeft', '#3b82f6', 'despesa', false, false)
  returning id into expense_transfer;

  insert into public.contas (organizacao_id, usuario_id, nome, tipo, saldo, cor, icone)
  values (organization_id, user_id, 'Conta PJ', 'corrente', 6200, '#111827', 'Landmark')
  returning id into account_business;
  insert into public.contas (organizacao_id, usuario_id, nome, tipo, saldo, cor, icone)
  values (organization_id, user_id, 'Caixa e dinheiro', 'carteira', 420, '#059669', 'Wallet')
  returning id into account_wallet;
  insert into public.contas (organizacao_id, usuario_id, nome, tipo, saldo, cor, icone)
  values (organization_id, user_id, 'Reserva do negócio', 'poupança', 3500, '#2563eb', 'PiggyBank')
  returning id into account_reserve;

  insert into public.cartoes (organizacao_id, usuario_id, nome, bandeira, cor, limite_credito, dia_fechamento, dia_vencimento, banco, ultimos_quatro)
  values (organization_id, user_id, 'Cartão Empresarial', 'Mastercard', '#111827', 5000, 10, 17, 'Banco FinWill', '2026')
  returning id into business_card;

  insert into public.formas_pagamento (organizacao_id, usuario_id, nome, debitar_conta, conta_id)
  values
    (organization_id, user_id, 'Pix', true, account_business),
    (organization_id, user_id, 'Débito', true, account_business),
    (organization_id, user_id, 'Boleto', true, account_business),
    (organization_id, user_id, 'Dinheiro', true, account_wallet);

  insert into public.contatos (organizacao_id, usuario_id, nome, tipo, email, telefone, observacoes)
  values (organization_id, user_id, 'Estúdio Aurora', 'cliente', 'financeiro@estudioaurora.example', '(11) 99911-2200', 'Cliente mensal')
  returning id into client_studio;
  insert into public.contatos (organizacao_id, usuario_id, nome, tipo, email, telefone)
  values (organization_id, user_id, 'Mercado Vila Nova', 'cliente', 'contato@vilanova.example', '(11) 99810-7733')
  returning id into client_market;
  insert into public.contatos (organizacao_id, usuario_id, nome, tipo, email, telefone)
  values (organization_id, user_id, 'Clínica Bem Estar', 'cliente', 'administrativo@bemestar.example', '(11) 99771-4020')
  returning id into client_clinic;
  insert into public.contatos (organizacao_id, usuario_id, nome, tipo, email)
  values (organization_id, user_id, 'Nuvem Sistemas', 'fornecedor', 'cobranca@nuvemsistemas.example')
  returning id into supplier_software;
  insert into public.contatos (organizacao_id, usuario_id, nome, tipo, telefone)
  values (organization_id, user_id, 'Papelaria Central', 'fornecedor', '(11) 3333-1188')
  returning id into supplier_material;
  insert into public.contatos (organizacao_id, usuario_id, nome, tipo, email)
  values (organization_id, user_id, 'Conecta Telecom', 'fornecedor', 'financeiro@conecta.example')
  returning id into supplier_services;

  -- Receitas realizadas do mês atual.
  insert into public.transacoes (organizacao_id, usuario_id, descricao, valor, data, data_vencimento, tipo, categoria_id, conta_id, esta_pago, data_pagamento, natureza, contato_id)
  values
    (organization_id, user_id, 'Projeto de identidade visual', 3850, (month_start + 2)::timestamptz, (month_start + 2)::timestamptz, 'receita', income_services, account_business, true, (month_start + 2)::timestamptz, 'operacional', client_studio),
    (organization_id, user_id, 'Manutenção mensal de site', 980, (month_start + 7)::timestamptz, (month_start + 7)::timestamptz, 'receita', income_services, account_business, true, (month_start + 7)::timestamptz, 'operacional', client_market),
    (organization_id, user_id, 'Venda direta no balcão', 650, (month_start + 11)::timestamptz, (month_start + 11)::timestamptz, 'receita', income_sales, account_wallet, true, (month_start + 11)::timestamptz, 'operacional', null);

  -- Despesas realizadas.
  insert into public.transacoes (organizacao_id, usuario_id, descricao, valor, data, data_vencimento, tipo, categoria_id, conta_id, esta_pago, data_pagamento, natureza, contato_id, observacoes)
  values
    (organization_id, user_id, 'Licenças de software', 780, (month_start + 3)::timestamptz, (month_start + 3)::timestamptz, 'despesa', expense_software, account_business, true, (month_start + 3)::timestamptz, 'operacional', supplier_software, 'paymentMethod:Pix'),
    (organization_id, user_id, 'Combustível e deslocamentos', 380, (month_start + 8)::timestamptz, (month_start + 8)::timestamptz, 'despesa', expense_transport, account_business, true, (month_start + 8)::timestamptz, 'operacional', null, 'paymentMethod:Débito'),
    (organization_id, user_id, 'Internet empresarial', 120, (month_start + 9)::timestamptz, (month_start + 9)::timestamptz, 'despesa', expense_utilities, account_business, true, (month_start + 9)::timestamptz, 'operacional', supplier_services, 'paymentMethod:Pix'),
    (organization_id, user_id, 'Materiais de escritório', 90, (month_start + 12)::timestamptz, (month_start + 12)::timestamptz, 'despesa', expense_material, account_wallet, true, (month_start + 12)::timestamptz, 'operacional', supplier_material, 'paymentMethod:Dinheiro'),
    (organization_id, user_id, 'Obrigação mensal do negócio', 79, (month_start + 14)::timestamptz, (month_start + 14)::timestamptz, 'despesa', expense_taxes, account_business, true, (month_start + 14)::timestamptz, 'operacional', null, 'paymentMethod:Pix');

  -- Pró-labore, retirada e aporte ficam separados do resultado operacional.
  insert into public.transacoes (organizacao_id, usuario_id, descricao, valor, data, data_vencimento, tipo, categoria_id, conta_id, esta_pago, data_pagamento, natureza, beneficiario_usuario_id, observacoes)
  values
    (organization_id, user_id, 'Pró-labore do mês', 1800, (month_start + 5)::timestamptz, (month_start + 5)::timestamptz, 'despesa', expense_prolabore, account_business, true, (month_start + 5)::timestamptz, 'pro_labore', user_id, 'paymentMethod:Pix'),
    (organization_id, user_id, 'Retirada extra para uso pessoal', 350, (month_start + 13)::timestamptz, (month_start + 13)::timestamptz, 'despesa', expense_withdrawal, account_business, true, (month_start + 13)::timestamptz, 'retirada_extra', user_id, 'paymentMethod:Pix'),
    (organization_id, user_id, 'Aporte para reforço de caixa', 1000, (month_start + 1)::timestamptz, (month_start + 1)::timestamptz, 'receita', income_contribution, account_reserve, true, (month_start + 1)::timestamptz, 'aporte_socio', user_id, 'Aporte do titular');

  -- Transferência atômica representada por duas pontas auditáveis.
  insert into public.transacoes (organizacao_id, usuario_id, descricao, valor, data, data_vencimento, tipo, categoria_id, conta_id, esta_pago, data_pagamento, natureza, transacao_pai_id, observacoes)
  values
    (organization_id, user_id, 'Transferência para reserva', 500, (month_start + 15)::timestamptz, (month_start + 15)::timestamptz, 'despesa', expense_transfer, account_business, true, (month_start + 15)::timestamptz, 'transferencia', transfer_group, 'transferencia:' || transfer_group),
    (organization_id, user_id, 'Transferência da Conta PJ', 500, (month_start + 15)::timestamptz, (month_start + 15)::timestamptz, 'receita', income_contribution, account_reserve, true, (month_start + 15)::timestamptz, 'transferencia', transfer_group, 'transferencia:' || transfer_group);

  -- Contas em aberto, inclusive vencidas e futuras.
  insert into public.transacoes (organizacao_id, usuario_id, descricao, valor, data, data_vencimento, tipo, categoria_id, esta_pago, natureza, contato_id)
  values
    (organization_id, user_id, 'Criação de campanha digital', 2800, current_date::timestamptz, (current_date + 5)::timestamptz, 'receita', income_services, false, 'operacional', client_clinic),
    (organization_id, user_id, 'Parcela atrasada do projeto', 1450, (current_date - 12)::timestamptz, (current_date - 4)::timestamptz, 'receita', income_services, false, 'operacional', client_market),
    (organization_id, user_id, 'Pacote de artes mensais', 720, current_date::timestamptz, (current_date + 15)::timestamptz, 'receita', income_services, false, 'operacional', client_studio),
    (organization_id, user_id, 'Compra de materiais', 890, current_date::timestamptz, (current_date + 3)::timestamptz, 'despesa', expense_material, false, 'operacional', supplier_material),
    (organization_id, user_id, 'Assinatura anual vencida', 250, (current_date - 10)::timestamptz, (current_date - 2)::timestamptz, 'despesa', expense_software, false, 'operacional', supplier_software),
    (organization_id, user_id, 'Equipamento para o negócio', 1600, current_date::timestamptz, (current_date + 10)::timestamptz, 'despesa', expense_material, false, 'operacional', supplier_material);

  insert into public.transacoes (
    organizacao_id, usuario_id, descricao, valor, data, data_vencimento,
    tipo, categoria_id, esta_pago, natureza, beneficiario_usuario_id
  ) values (
    organization_id, user_id, 'Pró-labore próximo mês', 1800,
    next_month::timestamptz, (next_month + 4)::timestamptz,
    'despesa', expense_prolabore, false, 'pro_labore', user_id
  );

  -- Compras no cartão, ainda compondo a fatura.
  insert into public.transacoes (organizacao_id, usuario_id, descricao, valor, data, data_vencimento, tipo, categoria_id, cartao_id, esta_pago, natureza)
  values
    (organization_id, user_id, 'Hospedagem e domínio', 349, (current_date - 8)::timestamptz, (current_date + 18)::timestamptz, 'despesa', expense_software, business_card, false, 'operacional'),
    (organization_id, user_id, 'Material para atendimento', 189, (current_date - 5)::timestamptz, (current_date + 18)::timestamptz, 'despesa', expense_material, business_card, false, 'operacional'),
    (organization_id, user_id, 'Aplicativo de produtividade', 85, (current_date - 1)::timestamptz, (current_date + 18)::timestamptz, 'despesa', expense_software, business_card, false, 'operacional');

  -- Histórico dos dois meses anteriores para gráficos e relatórios.
  insert into public.transacoes (organizacao_id, usuario_id, descricao, valor, data, data_vencimento, tipo, categoria_id, conta_id, esta_pago, data_pagamento, natureza, contato_id, observacoes)
  values
    (organization_id, user_id, 'Projeto concluído - mês anterior', 3200, (month_start - interval '1 month' + interval '6 days'), (month_start - interval '1 month' + interval '6 days'), 'receita', income_services, account_business, true, (month_start - interval '1 month' + interval '6 days'), 'operacional', client_studio, null),
    (organization_id, user_id, 'Despesas do mês anterior', 1120, (month_start - interval '1 month' + interval '12 days'), (month_start - interval '1 month' + interval '12 days'), 'despesa', expense_material, account_business, true, (month_start - interval '1 month' + interval '12 days'), 'operacional', supplier_material, 'paymentMethod:Pix'),
    (organization_id, user_id, 'Serviços - dois meses atrás', 2750, (month_start - interval '2 months' + interval '8 days'), (month_start - interval '2 months' + interval '8 days'), 'receita', income_services, account_business, true, (month_start - interval '2 months' + interval '8 days'), 'operacional', client_market, null),
    (organization_id, user_id, 'Custos - dois meses atrás', 980, (month_start - interval '2 months' + interval '14 days'), (month_start - interval '2 months' + interval '14 days'), 'despesa', expense_utilities, account_business, true, (month_start - interval '2 months' + interval '14 days'), 'operacional', supplier_services, 'paymentMethod:Pix');

  insert into public.configuracoes_retirada (
    organizacao_id, beneficiario_usuario_id, descricao, valor, dia_vencimento,
    conta_id, categoria_id, proxima_competencia, ativo, criado_por
  ) values (
    organization_id, user_id, 'Pró-labore mensal', 1800, 5,
    account_business, expense_prolabore,
    (date_trunc('month', current_date) + interval '2 months')::date,
    true, user_id
  );

  insert into public.itens_planejamento (
    organizacao_id, usuario_id, descricao, valor, tipo, mes_inicio,
    duracao_meses, categoria_id, conta_id, ativo
  ) values
    (organization_id, user_id, 'Contrato mensal previsto', 1200, 'receita', next_month, 0, income_services, account_business, true),
    (organization_id, user_id, 'Campanha de divulgação', 450, 'despesa', next_month, 3, expense_software, account_business, true),
    (organization_id, user_id, 'Compra planejada de equipamento', 2400, 'despesa', (next_month + interval '1 month')::date, 4, expense_material, account_business, true),
    (organization_id, user_id, 'Novo cliente em negociação', 1800, 'receita', (next_month + interval '1 month')::date, 6, income_services, account_business, true);

  return true;
end;
$$;

grant execute on function public.ensure_business_demo_data() to authenticated;

commit;

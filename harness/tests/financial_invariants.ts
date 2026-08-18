import assert from 'node:assert/strict';
import { getCycleId, getInvoiceClosingDate } from '../../src/utils/cycleUtils';
import {
  getCashPeriodId,
  isCardCharge,
  isCashPaymentMethod,
  isRealizedCashFlow,
  splitAmount,
  sumRealizedCashFlow,
} from '../../src/utils/financialRules';
import { Transaction } from '../../src/db/db';

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'test-id',
  description: 'Teste',
  amount: 100,
  date: new Date('2026-01-10T12:00:00'),
  type: 'despesa',
  categoryId: 'category-id',
  isPaid: false,
  ...overrides,
});

const pending = transaction({ isPaid: false, accountId: 'account-id' });
assert.equal(isRealizedCashFlow(pending), false, 'pendência não pode entrar no caixa realizado');

const paidLater = transaction({
  isPaid: true,
  accountId: 'account-id',
  paymentDate: new Date('2026-02-03T12:00:00'),
});
assert.equal(getCashPeriodId(paidLater), '2026-02', 'o período deve usar a data efetiva do pagamento');
assert.equal(isRealizedCashFlow(paidLater), true, 'despesa paga em conta deve entrar no caixa realizado');

const cardCharge = transaction({ isPaid: true, cardId: 'card-id', paymentDate: new Date('2026-02-05T12:00:00') });
assert.equal(isCardCharge(cardCharge), true, 'compra de cartão deve ser compromisso até a baixa da fatura');
assert.equal(isRealizedCashFlow(cardCharge), false, 'compra de cartão não pode duplicar o pagamento da fatura');

const legacyPaidCardCharge = transaction({ isPaid: true, cardId: 'card-id' });
assert.equal(isRealizedCashFlow(legacyPaidCardCharge), true, 'dados antigos pagos sem paymentDate não podem desaparecer do relatório');

const invoicePayment = transaction({
  isPaid: true,
  accountId: 'account-id',
  notes: 'pagamento_fatura:card-id-2026-02',
  paymentDate: new Date('2026-02-05T12:00:00'),
});
assert.equal(isRealizedCashFlow(invoicePayment), true, 'pagamento de fatura deve ser caixa realizado');

const transfer = transaction({
  isPaid: true,
  accountId: 'account-id',
  notes: 'transferencia:group-id',
});
assert.equal(isRealizedCashFlow(transfer), false, 'transferência não pode inflar receitas ou despesas agregadas');

assert.equal(
  sumRealizedCashFlow([paidLater, cardCharge, invoicePayment]),
  200,
  'soma realizada deve ignorar compra de cartão e manter despesa paga + fatura'
);

assert.equal(
  getCycleId(new Date('2026-12-01T12:00:00'), 25, 5).cycleId,
  '2027-01',
  'ciclo de cartão deve atravessar corretamente a virada do ano'
);

assert.equal(
  getCycleId(new Date('2026-02-28T12:00:00'), 31, 31).dueDate.getDate(),
  31,
  'data de vencimento deve permanecer válida mesmo com dia 31'
);

const futureInvoiceClosing = getInvoiceClosingDate(new Date('2026-10-13T12:00:00'), 20, 13);
assert.deepEqual(
  [futureInvoiceClosing.getFullYear(), futureInvoiceClosing.getMonth() + 1, futureInvoiceClosing.getDate()],
  [2026, 9, 19],
  'fatura futura deve usar o fechamento do ciclo anterior ao vencimento'
);

assert.deepEqual(splitAmount(100, 3), [33.34, 33.33, 33.33], 'parcelamento deve fechar exatamente em centavos');

assert.equal(isCashPaymentMethod('Dinheiro'), true, 'Dinheiro deve ser reconhecido sem acento');
assert.equal(isCashPaymentMethod('DINHEIRO EM ESPÉCIE'), true, 'Dinheiro em espécie deve ser reconhecido');
assert.equal(isCashPaymentMethod('Dinheiro espécie'), true, 'variações de nome de dinheiro devem ser reconhecidas');
assert.equal(isCashPaymentMethod('Pix'), false, 'Pix não pode ser tratado como dinheiro');

console.log('Financial invariants: OK');

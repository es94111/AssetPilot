// tests/lib/recurringFxRequest.test.ts — stale FX lookup guard for recurring forms.
import assert from 'node:assert/strict';
import test from 'node:test';
import { RecurringFxRequestGuard } from '../../lib/recurringFxRequest.ts';

test('a delayed add-form request cannot overwrite a same-currency suggestion historical rate', () => {
  const guard = new RecurringFxRequestGuard();
  const oldRequest = guard.begin('USD');

  // Opening a suggestion form invalidates any outstanding lookup synchronously,
  // before React commits the new form state or its effects run.
  guard.invalidate();
  const historicalRate = '30.25';
  const suggestionContext = {
    currentCurrency: 'USD',
    preservedHistoricalCurrency: 'USD',
  };
  let formFxRate = historicalRate;
  const delayedResponseRate = '31.10';
  if (guard.canApply(oldRequest, suggestionContext)) formFxRate = delayedResponseRate;

  assert.equal(formFxRate, historicalRate, 'the delayed lookup must not overwrite the historical form fxRate');
});

test('the current request updates its matching currency when no historical rate is preserved', () => {
  const guard = new RecurringFxRequestGuard();
  const request = guard.begin('EUR');

  const currentResponseRate = '1.08';
  let formFxRate = '';
  if (guard.canApply(request, {
    currentCurrency: 'EUR',
    preservedHistoricalCurrency: null,
  })) formFxRate = currentResponseRate;

  assert.equal(formFxRate, currentResponseRate, 'valid response should update the form rate');
});

test('a current request cannot update a changed currency or preserved historical currency', () => {
  const guard = new RecurringFxRequestGuard();
  const request = guard.begin('USD');

  assert.equal(guard.canApply(request, {
    currentCurrency: 'EUR',
    preservedHistoricalCurrency: null,
  }), false);
  assert.equal(guard.canApply(request, {
    currentCurrency: 'USD',
    preservedHistoricalCurrency: 'USD',
  }), false);
});

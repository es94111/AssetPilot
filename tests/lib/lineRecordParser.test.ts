import assert from 'node:assert/strict';
import { __setNowMs } from '../../lib/userTime.ts';
import {
  parseLineDateInput,
  parseLineRecordCommand,
  parseLineRecordDetail,
} from '../../lib/lineRecordParser.ts';

const timezone = 'Asia/Taipei';
__setNowMs(Date.parse('2026-08-23T01:00:00.000Z'));

try {
  assert.deepEqual(
    parseLineRecordCommand('今天 支出 120 午餐', timezone),
    { type: 'expense', amount: 120, currency: 'TWD', date: '2026-08-23', note: '午餐' },
  );

  assert.deepEqual(
    parseLineRecordDetail('120 USD 午餐 昨天', 'expense', timezone),
    { type: 'expense', amount: 120, currency: 'USD', date: '2026-08-22', note: '午餐' },
  );

  assert.equal(parseLineDateInput('今天', timezone), '2026-08-23');
  assert.equal(parseLineDateInput('昨天', timezone), '2026-08-22');
  assert.equal(parseLineDateInput('2026/8/2', timezone), '2026-08-02');
  assert.equal(parseLineDateInput('2026-02-30', timezone), null);

  const invalidDate = parseLineRecordCommand('支出 120 午餐 2026-02-30', timezone);
  assert.ok(invalidDate);
  assert.equal(invalidDate.date, '');

  const noteWithLetters = parseLineRecordCommand('支出 10 abc', timezone, 'USD');
  assert.ok(noteWithLetters);
  assert.equal(noteWithLetters.currency, 'USD');
  assert.equal(noteWithLetters.note, 'abc');
} finally {
  __setNowMs(null);
}

console.log('line record parser tests passed');

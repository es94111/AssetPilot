import assert from 'node:assert/strict';
import {
  buildMainMenuFlex,
  buildQueryFlex,
  buildRecordFlex,
  buildRecordWizardStepFlex,
} from '../../lib/lineMessaging.ts';

type FlexNode = Record<string, unknown>;

function node(value: unknown): FlexNode {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as FlexNode;
}

function children(value: unknown): FlexNode[] {
  const items = node(value).contents;
  assert.ok(Array.isArray(items));
  return items.map(node);
}

const menu = buildMainMenuFlex('https://example.com', true);
const menuBubble = node(menu.contents);
assert.equal(node(menuBubble.header).backgroundColor, '#1d4ed8');
assert.match(JSON.stringify(menu), /action=record_wizard/);
assert.match(JSON.stringify(menu), /action=query_menu/);

const wizard = buildRecordWizardStepFlex(
  '新增記錄：金額',
  ['金額：120', '請直接輸入備註'],
  [{ label: '下一步', data: 'action=wizard&step=amount', displayText: '下一步', primary: true }],
);
const wizardBody = node(node(wizard.contents).body);
const wizardRows = children(wizardBody);
assert.ok(Array.isArray(wizardRows[0].contents));
assert.match(JSON.stringify(wizard), /action=wizard&step=amount/);
assert.match(JSON.stringify(wizard), /action=menu/);

const record = buildRecordFlex('已新增收支紀錄', ['金額：TWD 120', '備註：午餐']);
assert.match(JSON.stringify(record), /action=record&type=expense/);
assert.match(JSON.stringify(record), /金額/);

const query = buildQueryFlex('今天收支', ['收入：TWD 100', '淨額：TWD 100'], ['2026-08-23 ＋100｜午餐']);
assert.match(JSON.stringify(query), /摘要/);
assert.match(JSON.stringify(query), /最近明細/);
assert.match(JSON.stringify(query), /action=record&type=expense/);

console.log('line messaging display tests passed');

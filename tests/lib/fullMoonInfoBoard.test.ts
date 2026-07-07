const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  blankMonthsAfter,
  isFutureMonthIndex,
  visibleThroughMonthIndexForToday,
} = require('../../lib/fullMoonInfoBoardCutoff.ts') as typeof import('../../lib/fullMoonInfoBoardCutoff');

const repoRoot = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

assert.equal(visibleThroughMonthIndexForToday('2026-07-07'), 6);
assert.equal(visibleThroughMonthIndexForToday('2026-01-01'), 0);
assert.equal(visibleThroughMonthIndexForToday('bad-date'), 11);

assert.deepEqual(
  blankMonthsAfter([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 6),
  [1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 0, 0]
);

assert.equal(isFutureMonthIndex(6, 6), false);
assert.equal(isFutureMonthIndex(7, 6), true);

const infoBoardSource = readRepoFile('lib/fullMoonInfoBoard.ts');
assert.doesNotMatch(infoBoardSource, /monthEnd\(year,\s*11\)/);
assert.doesNotMatch(infoBoardSource, /`\$\{year\}-12-31`/);
assert.match(infoBoardSource, /monthEnd\(year,\s*visibleThroughMonthIndex\)/);
assert.match(infoBoardSource, /blankMonthsAfter\(/);

const pageSource = readRepoFile('app/finance/info-board/page.tsx');
assert.match(pageSource, /isFutureMonthIndex/);
assert.match(pageSource, /board\.visibleThroughMonthIndex/);
assert.match(pageSource, /rowTotal\(row,\s*section,\s*board\.visibleThroughMonthIndex\)/);
assert.match(pageSource, /sectionTotal\(section,\s*board\.visibleThroughMonthIndex\)/);
assert.match(pageSource, /change\(netWorth,\s*board\.visibleThroughMonthIndex\)/);
assert.match(pageSource, /growth\(netWorth,\s*board\.visibleThroughMonthIndex\)/);

console.log('fullMoonInfoBoard future-month cutoff: pass');

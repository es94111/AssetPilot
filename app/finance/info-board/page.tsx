import { Fragment } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  FULL_MOON_MONTHS,
  getFullMoonInfoBoardData,
  type BoardRow,
  type BoardSection,
  type BoardTone,
} from '@/lib/fullMoonInfoBoard';
import { isFutureMonthIndex } from '@/lib/fullMoonInfoBoardCutoff';
import { localeTag } from '@/lib/i18n/localeTag';
import { resolveLocale } from '@/lib/i18n/resolveLocale';
import { requireServerAuth } from '@/lib/serverAuth';

const toneStyles: Record<BoardTone, { bg: string; text: string; strongBg: string; strongText: string }> = {
  asset: { bg: '#beefe0', text: '#103c2a', strongBg: '#1a5d41', strongText: '#f8fffb' },
  income: { bg: '#beefe0', text: '#103c2a', strongBg: '#23885f', strongText: '#f8fffb' },
  debt: { bg: '#f8d6df', text: '#d4043a', strongBg: '#d4043a', strongText: '#fff8fb' },
  investment: { bg: '#fff2bf', text: '#6c5700', strongBg: '#f4c443', strongText: '#1a1d26' },
  expense: { bg: '#f8d6df', text: '#d4043a', strongBg: '#d4043a', strongText: '#fff8fb' },
};

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function monthlyTotals(section: BoardSection) {
  return FULL_MOON_MONTHS.map((_, index) => section.rows.reduce((total, row) => total + (row.values[index] || 0), 0));
}

function change(values: number[], endIndex = values.length - 1) {
  return (values[endIndex] || 0) - (values[0] || 0);
}

function growth(values: number[], endIndex = values.length - 1) {
  const start = values[0];
  if (!start) return null;
  return change(values, endIndex) / start;
}

function formatMoney(value: number, locale: string, blankZero = true) {
  if (blankZero && value === 0) return '';
  return Math.round(value).toLocaleString(localeTag(locale));
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

function rowTotal(row: BoardRow, section: BoardSection, visibleThroughMonthIndex: number) {
  return section.totalMode === 'change' ? change(row.values, visibleThroughMonthIndex) : sum(row.values);
}

function sectionTotal(section: BoardSection, visibleThroughMonthIndex: number) {
  const totals = monthlyTotals(section);
  return section.totalMode === 'change' ? change(totals, visibleThroughMonthIndex) : sum(totals);
}

function sectionPercent(section: BoardSection, visibleThroughMonthIndex: number) {
  if (section.totalMode === 'change') return growth(monthlyTotals(section), visibleThroughMonthIndex);
  return sectionTotal(section, visibleThroughMonthIndex) ? 1 : null;
}

function rowPercent(row: BoardRow, section: BoardSection, total: number, visibleThroughMonthIndex: number) {
  if (section.totalMode === 'change') return growth(row.values, visibleThroughMonthIndex);
  return total ? rowTotal(row, section, visibleThroughMonthIndex) / total : null;
}

export default async function InfoBoardPage() {
  const user = await requireServerAuth();
  const locale = await resolveLocale();
  const board = getFullMoonInfoBoardData(user.id);
  const sections = board.sections;
  const assetTotals = monthlyTotals(sections[0]);
  const incomeTotals = monthlyTotals(sections[1]);
  const debtTotals = monthlyTotals(sections[2]);
  const expenseTotals = monthlyTotals(sections[3]);
  const netWorth = FULL_MOON_MONTHS.map((_, index) => assetTotals[index] + incomeTotals[index] - debtTotals[index] - expenseTotals[index]);
  const monthlyGrowth = netWorth.map((value, index) => {
    if (index === 0 || !netWorth[index - 1]) return null;
    return (value - netWorth[index - 1]) / netWorth[index - 1];
  });
  const isFutureMonth = (index: number) => isFutureMonthIndex(index, board.visibleThroughMonthIndex);

  return (
    <AppLayout user={user}>
      <div className="space-y-5" style={{ letterSpacing: 0 }}>
        <div className="page-header">
          <h1>滿月資訊版</h1>
          <p>{board.year} 年度月表 · 依目前紀錄產生</p>
        </div>

        <section
          className="overflow-hidden rounded-lg border"
          style={{ background: 'var(--surface-glass)', borderColor: 'var(--glass-border)', boxShadow: 'var(--shadow)' }}
        >
          <div className="overflow-x-auto">
            <table
              aria-label="滿月資訊版年度月表"
              className="min-w-[1540px] border-collapse text-[12px] leading-tight"
              style={{ color: '#1a1d26', letterSpacing: 0 }}
            >
              <thead>
                <tr>
                  <th colSpan={3} className="border border-[#cfcfcf] bg-[#d8d8d8] px-3 py-2 text-left align-middle text-base font-bold text-[#595959]">
                    <span className="block">【滿月記帳表】</span>
                    <span className="block text-sm font-semibold">投資理財從關注自己的淨值開始</span>
                  </th>
                  <th colSpan={12} className="border border-[#cfcfcf] bg-[#3f3f3f] px-3 py-2 text-left align-middle text-lg font-bold text-[#f2f2f2]">
                    {board.year}年
                  </th>
                  <th className="w-[136px] border border-[#cfcfcf] bg-[#d8d8d8] px-2 py-2 text-left text-base font-bold">Total</th>
                  <th className="w-[84px] border border-[#cfcfcf] bg-[#d8d8d8] px-2 py-2 text-left text-base font-bold">%</th>
                </tr>
                <tr>
                  <th className="w-[112px] border border-[#cfcfcf] bg-[#7f7f7f] px-2 py-2 text-left font-bold text-[#f2f2f2]">分類</th>
                  <th className="w-[96px] border border-[#cfcfcf] bg-[#7f7f7f] px-2 py-2 text-left font-bold text-[#f2f2f2]">型態</th>
                  <th className="w-[178px] border border-[#cfcfcf] bg-[#7f7f7f] px-2 py-2 text-left font-bold text-[#f2f2f2]">項目</th>
                  {FULL_MOON_MONTHS.map(month => (
                    <th key={month} className="w-[86px] border border-[#cfcfcf] bg-[#7f7f7f] px-2 py-2 text-left font-bold text-[#d8d8d8]">
                      {month}
                    </th>
                  ))}
                  <th className="border border-[#cfcfcf] bg-[#d8d8d8] px-2 py-2 text-left font-bold">Total</th>
                  <th className="border border-[#cfcfcf] bg-[#d8d8d8] px-2 py-2 text-left font-bold">%</th>
                </tr>
              </thead>
              <tbody>
                {sections.map(section => {
                  const totals = monthlyTotals(section);
                  const total = sectionTotal(section, board.visibleThroughMonthIndex);
                  const sectionStyle = toneStyles[section.tone];

                  return (
                    <Fragment key={section.title}>
                      {section.rows.map((row, rowIndex) => {
                        const rowTone = row.tone || section.tone;
                        const style = toneStyles[rowTone];
                        const previousGroup = section.rows[rowIndex - 1]?.group;
                        const showGroup = row.group && row.group !== previousGroup;
                        const totalValue = rowTotal(row, section, board.visibleThroughMonthIndex);

                        return (
                          <tr key={`${section.title}-${row.group}-${row.item}`}>
                            <td className="h-7 border border-[#cfcfcf] px-2 py-1.5 align-top font-bold" style={{ background: style.bg, color: style.text }}>
                              {rowIndex === 0 ? section.title : ''}
                            </td>
                            <td className="h-7 border border-[#cfcfcf] px-2 py-1.5 align-top font-semibold" style={{ background: style.bg, color: style.text }}>
                              {showGroup ? row.group : ''}
                            </td>
                            <td className="h-7 border border-[#cfcfcf] px-2 py-1.5 align-top font-medium" style={{ background: style.bg, color: style.text }}>
                              {row.item}
                            </td>
                            {row.values.map((value, index) => (
                              <td key={`${row.item}-${FULL_MOON_MONTHS[index]}`} className="h-7 border border-[#cfcfcf] px-2 py-1.5 text-right align-middle tabular-nums" style={{ background: style.bg, color: style.text }}>
                                {formatMoney(value, locale)}
                              </td>
                            ))}
                            <td className="h-7 border border-[#cfcfcf] px-2 py-1.5 text-right align-middle font-semibold tabular-nums" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                              {formatMoney(totalValue, locale, false)}
                            </td>
                            <td className="h-7 border border-[#cfcfcf] px-2 py-1.5 text-right align-middle font-semibold tabular-nums" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                              {formatPercent(rowPercent(row, section, total, board.visibleThroughMonthIndex))}
                            </td>
                          </tr>
                        );
                      })}
                      <tr>
                        <td colSpan={3} className="h-8 border border-[#cfcfcf] px-2 py-1.5 font-bold" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                          {section.totalLabel}
                        </td>
                        {totals.map((value, index) => (
                          <td key={`${section.title}-total-${FULL_MOON_MONTHS[index]}`} className="h-8 border border-[#cfcfcf] px-2 py-1.5 text-right font-bold tabular-nums" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                            {isFutureMonth(index) ? '' : formatMoney(value, locale, false)}
                          </td>
                        ))}
                        <td className="h-8 border border-[#cfcfcf] px-2 py-1.5 text-right font-bold tabular-nums" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                          {formatMoney(total, locale, false)}
                        </td>
                        <td className="h-8 border border-[#cfcfcf] px-2 py-1.5 text-right font-bold tabular-nums" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                          {formatPercent(sectionPercent(section, board.visibleThroughMonthIndex))}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}

                <tr>
                  <td colSpan={3} className="h-12 border border-[#cfcfcf] bg-[#ffdb6a] px-2 py-2 align-top font-bold text-[#6c5700]">
                    個人淨值
                  </td>
                  {netWorth.map((value, index) => (
                    <td key={`net-${FULL_MOON_MONTHS[index]}`} className="h-12 border border-[#cfcfcf] bg-[#ffdb6a] px-2 py-2 text-right align-top font-bold tabular-nums text-[#6c5700]">
                      {isFutureMonth(index) ? '' : formatMoney(value, locale, false)}
                    </td>
                  ))}
                  <td className="h-12 border border-[#cfcfcf] bg-white px-2 py-2 text-right align-top font-bold tabular-nums">
                    {formatMoney(change(netWorth, board.visibleThroughMonthIndex), locale, false)}
                  </td>
                  <td className="h-12 border border-[#cfcfcf] bg-white px-2 py-2 text-right align-top font-bold tabular-nums">
                    {formatPercent(growth(netWorth, board.visibleThroughMonthIndex))}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="h-9 border border-[#cfcfcf] bg-[#fff2bf] px-2 py-2 font-bold text-[#6c5700]">
                    淨值月成長率(%)
                  </td>
                  {monthlyGrowth.map((value, index) => (
                    <td key={`growth-${FULL_MOON_MONTHS[index]}`} className="h-9 border border-[#cfcfcf] bg-[#fff2bf] px-2 py-2 text-right font-semibold tabular-nums text-[#6c5700]">
                      {isFutureMonth(index) || value === null ? '' : formatPercent(value)}
                    </td>
                  ))}
                  <td className="h-9 border border-[#cfcfcf] bg-white px-2 py-2" />
                  <td className="h-9 border border-[#cfcfcf] bg-white px-2 py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

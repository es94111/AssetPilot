import { Fragment } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { localeTag } from '@/lib/i18n/localeTag';
import { resolveLocale } from '@/lib/i18n/resolveLocale';
import { requireServerAuth } from '@/lib/serverAuth';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

type BoardTone = 'asset' | 'income' | 'debt' | 'investment' | 'expense';

type BoardRow = {
  group: string;
  item: string;
  values: number[];
  tone?: BoardTone;
};

type BoardSection = {
  title: string;
  totalLabel: string;
  totalMode: 'change' | 'sum';
  tone: BoardTone;
  rows: BoardRow[];
};

const sections: BoardSection[] = [
  {
    title: '資產市值',
    totalLabel: '資產總計',
    totalMode: 'change',
    tone: 'asset',
    rows: [
      { group: '動產', item: '台幣活存(A銀行)', values: [30000, 25000, 18500, 18500, 19000, 17000, 16500, 17800, 20000, 25000, 28000, 32000] },
      { group: '動產', item: '台幣定存(A銀行)', values: [10000, 10000, 10000, 10000, 10000, 10000, 20000, 20000, 15000, 16500, 18000, 18000] },
      { group: '動產', item: '外幣活存(C銀行)', values: [29300, 29700, 30100, 30100, 30100, 32000, 32000, 32000, 32000, 32000, 32000, 32000] },
      { group: '動產', item: '股票/ETF(D證券)', values: [237000, 259500, 302500, 302500, 330000, 350000, 350000, 350000, 370000, 380000, 390000, 390000] },
      { group: '動產', item: '基金(B銀行)', values: [50300, 49800, 52500, 55000, 52500, 52500, 52500, 52500, 52500, 55000, 56000, 57000] },
      { group: '動產', item: '儲蓄險(C人壽)', values: [55000, 58000, 58500, 58500, 58500, 58500, 58500, 58500, 58500, 60000, 61000, 62000] },
      { group: '不動產', item: '建案/社區名稱', values: [3025000, 3050000, 3075000, 3100000, 3125000, 3150000, 3175000, 3200000, 3225000, 3250000, 3275000, 3300000] },
    ],
  },
  {
    title: '收入',
    totalLabel: '收入總計',
    totalMode: 'sum',
    tone: 'income',
    rows: [
      { group: '', item: '每月固定薪資', values: [45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000] },
      { group: '', item: '獎金(年終獎金/紅利)', values: [30000, 3000, 0, 0, 3000, 0, 0, 0, 3000, 0, 0, 0] },
      { group: '', item: '利息/股利', values: [0, 0, 0, 5000, 0, 0, 8000, 0, 0, 0, 3400, 0] },
      { group: '', item: '其他收入1', values: [0, 0, 1000, 0, 0, 3500, 0, 0, 0, 0, 0, 0] },
      { group: '', item: '其他收入2', values: [0, 8500, 0, 10000, 7580, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
  {
    title: '負債',
    totalLabel: '負債總計',
    totalMode: 'sum',
    tone: 'debt',
    rows: [
      { group: '計劃', item: '房租/房貸+管理費', values: [20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20000] },
      { group: '計劃', item: '房貸(每月還本金額)', values: [25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000] },
      { group: '計劃', item: '房貸(每月利息)', values: [20000, 19958, 19917, 19875, 19833, 19792, 19750, 19708, 19667, 19625, 19583, 19542] },
      { group: '計劃', item: '水費(每雙月1次)', values: [0, 450, 0, 462, 0, 585, 0, 0, 0, 0, 0, 0] },
      { group: '計劃', item: '電費(每單月1次)', values: [1500, 0, 1400, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { group: '計劃', item: '天然瓦斯(每單月1次)', values: [450, 0, 390, 0, 520, 0, 480, 0, 0, 0, 0, 0] },
      { group: '非計劃', item: '營飲', values: [5200, 4800, 5100, 5300, 4900, 5000, 5400, 5200, 5100, 5000, 5300, 5200] },
      { group: '非計劃', item: '衣服鞋子', values: [0, 0, 3200, 0, 0, 1800, 0, 0, 2500, 0, 0, 0] },
      { group: '非計劃', item: '寵物', values: [1600, 1600, 1600, 1600, 1600, 1600, 1600, 1600, 1600, 1600, 1600, 1600] },
    ],
  },
  {
    title: '支出',
    totalLabel: '支出總計',
    totalMode: 'sum',
    tone: 'expense',
    rows: [
      { group: '投資', item: 'A銀行(基金)', tone: 'investment', values: [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000] },
      { group: '投資', item: 'B銀行(外幣)', tone: 'investment', values: [3000, 3000, 0, 3000, 0, 3000, 0, 3000, 0, 3000, 0, 3000] },
      { group: '投資', item: 'C銀行(定存)', tone: 'investment', values: [10000, 0, 0, 0, 10000, 0, 0, 0, 10000, 0, 0, 0] },
      { group: '消費', item: 'A銀行(信用卡)', tone: 'expense', values: [15600, 14200, 16800, 15100, 17400, 16200, 14900, 15800, 17100, 16300, 15500, 16000] },
      { group: '消費', item: 'B銀行(信用卡)', tone: 'expense', values: [8600, 9200, 7800, 8900, 9400, 8100, 8500, 9300, 8800, 9100, 8700, 9000] },
      { group: '消費', item: '房車', tone: 'expense', values: [3000, 0, 3200, 0, 3000, 0, 3300, 0, 3000, 0, 3100, 0] },
      { group: '消費', item: '大雄響宴會', tone: 'expense', values: [0, 5600, 0, 0, 0, 7200, 0, 0, 0, 6400, 0, 0] },
    ],
  },
];

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
  return MONTHS.map((_, index) => section.rows.reduce((total, row) => total + row.values[index], 0));
}

function change(values: number[]) {
  return values[values.length - 1] - values[0];
}

function growth(values: number[]) {
  const start = values[0];
  if (!start) return null;
  return change(values) / start;
}

function formatMoney(value: number, locale: string, blankZero = true) {
  if (blankZero && value === 0) return '';
  return Math.round(value).toLocaleString(localeTag(locale));
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

function rowTotal(row: BoardRow, section: BoardSection) {
  return section.totalMode === 'change' ? change(row.values) : sum(row.values);
}

function sectionTotal(section: BoardSection) {
  const totals = monthlyTotals(section);
  return section.totalMode === 'change' ? change(totals) : sum(totals);
}

function sectionPercent(section: BoardSection) {
  if (section.totalMode === 'change') return growth(monthlyTotals(section));
  return 1;
}

function rowPercent(row: BoardRow, section: BoardSection, total: number) {
  if (section.totalMode === 'change') return growth(row.values);
  return total ? rowTotal(row, section) / total : null;
}

export default async function InfoBoardPage() {
  const user = await requireServerAuth();
  const locale = await resolveLocale();
  const assetTotals = monthlyTotals(sections[0]);
  const incomeTotals = monthlyTotals(sections[1]);
  const debtTotals = monthlyTotals(sections[2]);
  const expenseTotals = monthlyTotals(sections[3]);
  const netWorth = MONTHS.map((_, index) => assetTotals[index] + incomeTotals[index] - debtTotals[index] - expenseTotals[index]);
  const monthlyGrowth = netWorth.map((value, index) => {
    if (index === 0 || !netWorth[index - 1]) return null;
    return (value - netWorth[index - 1]) / netWorth[index - 1];
  });

  return (
    <AppLayout user={user}>
      <div className="space-y-5" style={{ letterSpacing: 0 }}>
        <div className="page-header">
          <h1>滿月資訊版</h1>
          <p>2026 年度月表</p>
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
                    2026年
                  </th>
                  <th className="w-[136px] border border-[#cfcfcf] bg-[#d8d8d8] px-2 py-2 text-left text-base font-bold">Total</th>
                  <th className="w-[84px] border border-[#cfcfcf] bg-[#d8d8d8] px-2 py-2 text-left text-base font-bold">%</th>
                </tr>
                <tr>
                  <th className="w-[112px] border border-[#cfcfcf] bg-[#7f7f7f] px-2 py-2 text-left font-bold text-[#f2f2f2]">分類</th>
                  <th className="w-[96px] border border-[#cfcfcf] bg-[#7f7f7f] px-2 py-2 text-left font-bold text-[#f2f2f2]">型態</th>
                  <th className="w-[178px] border border-[#cfcfcf] bg-[#7f7f7f] px-2 py-2 text-left font-bold text-[#f2f2f2]">項目</th>
                  {MONTHS.map(month => (
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
                  const total = sectionTotal(section);
                  const sectionStyle = toneStyles[section.tone];

                  return (
                    <Fragment key={section.title}>
                      {section.rows.map((row, rowIndex) => {
                        const rowTone = row.tone || section.tone;
                        const style = toneStyles[rowTone];
                        const previousGroup = section.rows[rowIndex - 1]?.group;
                        const showGroup = row.group && row.group !== previousGroup;
                        const totalValue = rowTotal(row, section);

                        return (
                          <tr key={`${section.title}-${row.item}`}>
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
                              <td key={`${row.item}-${MONTHS[index]}`} className="h-7 border border-[#cfcfcf] px-2 py-1.5 text-right align-middle tabular-nums" style={{ background: style.bg, color: style.text }}>
                                {formatMoney(value, locale)}
                              </td>
                            ))}
                            <td className="h-7 border border-[#cfcfcf] px-2 py-1.5 text-right align-middle font-semibold tabular-nums" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                              {formatMoney(totalValue, locale, false)}
                            </td>
                            <td className="h-7 border border-[#cfcfcf] px-2 py-1.5 text-right align-middle font-semibold tabular-nums" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                              {formatPercent(rowPercent(row, section, total))}
                            </td>
                          </tr>
                        );
                      })}
                      <tr>
                        <td colSpan={3} className="h-8 border border-[#cfcfcf] px-2 py-1.5 font-bold" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                          {section.totalLabel}
                        </td>
                        {totals.map((value, index) => (
                          <td key={`${section.title}-total-${MONTHS[index]}`} className="h-8 border border-[#cfcfcf] px-2 py-1.5 text-right font-bold tabular-nums" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                            {formatMoney(value, locale, false)}
                          </td>
                        ))}
                        <td className="h-8 border border-[#cfcfcf] px-2 py-1.5 text-right font-bold tabular-nums" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                          {formatMoney(total, locale, false)}
                        </td>
                        <td className="h-8 border border-[#cfcfcf] px-2 py-1.5 text-right font-bold tabular-nums" style={{ background: sectionStyle.strongBg, color: sectionStyle.strongText }}>
                          {formatPercent(sectionPercent(section))}
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
                    <td key={`net-${MONTHS[index]}`} className="h-12 border border-[#cfcfcf] bg-[#ffdb6a] px-2 py-2 text-right align-top font-bold tabular-nums text-[#6c5700]">
                      {formatMoney(value, locale, false)}
                    </td>
                  ))}
                  <td className="h-12 border border-[#cfcfcf] bg-white px-2 py-2 text-right align-top font-bold tabular-nums">
                    {formatMoney(change(netWorth), locale, false)}
                  </td>
                  <td className="h-12 border border-[#cfcfcf] bg-white px-2 py-2 text-right align-top font-bold tabular-nums">
                    {formatPercent(growth(netWorth))}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="h-9 border border-[#cfcfcf] bg-[#fff2bf] px-2 py-2 font-bold text-[#6c5700]">
                    淨值月成長率(%)
                  </td>
                  {monthlyGrowth.map((value, index) => (
                    <td key={`growth-${MONTHS[index]}`} className="h-9 border border-[#cfcfcf] bg-[#fff2bf] px-2 py-2 text-right font-semibold tabular-nums text-[#6c5700]">
                      {value === null ? '' : formatPercent(value)}
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

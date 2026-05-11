import crypto from 'crypto';

export const LINE_MESSAGING_CHANNEL_SECRET = process.env.LINE_MESSAGING_CHANNEL_SECRET || process.env.LINE_CHANNEL_SECRET || '';
export const LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN || '';

const LINE_REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply';

export interface LineTextMessage {
  type: 'text';
  text: string;
}

export interface LineFlexMessage {
  type: 'flex';
  altText: string;
  contents: Record<string, unknown>;
}

export type LineReplyMessage = LineTextMessage | LineFlexMessage;

export function verifyLineSignature(body: string, signature: string | null): boolean {
  if (!LINE_MESSAGING_CHANNEL_SECRET || !signature) return false;
  const expected = crypto
    .createHmac('sha256', LINE_MESSAGING_CHANNEL_SECRET)
    .update(body)
    .digest('base64');

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function replyLineMessage(replyToken: string, messages: LineReplyMessage[]): Promise<void> {
  if (!LINE_MESSAGING_CHANNEL_ACCESS_TOKEN) {
    throw new Error('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not configured');
  }
  const res = await fetch(LINE_REPLY_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINE_MESSAGING_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LINE reply failed (${res.status}) ${detail}`);
  }
}

export function textMessage(text: string): LineTextMessage {
  return { type: 'text', text };
}

function button(label: string, text: string) {
  return {
    type: 'button',
    style: 'secondary',
    height: 'sm',
    action: { type: 'message', label, text },
  };
}

function postbackButton(label: string, data: string, displayText: string, style: 'primary' | 'secondary' = 'secondary') {
  return {
    type: 'button',
    style,
    height: 'sm',
    action: { type: 'postback', label, data, displayText },
  };
}

function uriButton(label: string, uri: string) {
  return {
    type: 'button',
    style: 'primary',
    height: 'sm',
    action: { type: 'uri', label, uri },
  };
}

export function buildMainMenuFlex(appUrl: string, linked: boolean): LineFlexMessage {
  const bindUrl = `${appUrl.replace(/\/$/, '')}/settings/account`;
  return {
    type: 'flex',
    altText: 'AssetPilot LINE 選單',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'AssetPilot', weight: 'bold', color: '#2563eb', size: 'sm' },
          { type: 'text', text: linked ? '今天要做什麼？' : '先綁定 LINE 帳號', weight: 'bold', size: 'xl', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: linked ? '選擇功能後，我會接著引導你輸入金額或查看紀錄。' : '綁定後即可用官方帳號新增收入、支出與查看收支紀錄。',
            wrap: true,
            size: 'sm',
            color: '#475569',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: linked
          ? [
              postbackButton('新增支出', 'action=record&type=expense', '新增支出', 'primary'),
              postbackButton('新增收入', 'action=record&type=income', '新增收入'),
              postbackButton('查看紀錄', 'action=query_menu', '查看紀錄'),
            ]
          : [uriButton('綁定 LINE 帳號', bindUrl)],
      },
    },
  };
}

export function buildRecordPromptFlex(type: 'income' | 'expense'): LineFlexMessage {
  const isIncome = type === 'income';
  const title = isIncome ? '新增收入' : '新增支出';
  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: title, weight: 'bold', size: 'lg' },
          {
            type: 'text',
            text: '請直接輸入金額與備註，我不會自動幫你送出範例文字。',
            wrap: true,
            size: 'sm',
            color: '#475569',
          },
          { type: 'text', text: '規則：金額 備註 日期（日期可省略）', wrap: true, size: 'sm', color: '#334155' },
          { type: 'text', text: isIncome ? '收入例：5000 薪資' : '支出例：120 午餐', wrap: true, size: 'xs', color: '#64748b' },
          { type: 'text', text: '指定日期例：120 午餐 2026-05-11', wrap: true, size: 'xs', color: '#64748b' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          postbackButton('回選單', 'action=menu', '選單'),
        ],
      },
    },
  };
}

export function buildQueryMenuFlex(): LineFlexMessage {
  return {
    type: 'flex',
    altText: '查看收支紀錄',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '查看收支紀錄', weight: 'bold', size: 'lg' },
          { type: 'text', text: '選擇要查詢的期間。', wrap: true, size: 'sm', color: '#475569' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          postbackButton('今天', 'action=query&period=today', '查詢 今天', 'primary'),
          postbackButton('昨天', 'action=query&period=yesterday', '查詢 昨天'),
          postbackButton('本月', 'action=query&period=month', '查詢 本月'),
        ],
      },
    },
  };
}

export function buildActionFlex(appUrl: string): LineFlexMessage {
  const bindUrl = `${appUrl.replace(/\/$/, '')}/settings/account`;
  return {
    type: 'flex',
    altText: 'AssetPilot LINE 記帳功能',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'AssetPilot', weight: 'bold', color: '#2563eb', size: 'sm' },
          { type: 'text', text: 'LINE 記帳', weight: 'bold', size: 'xl', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '綁定後可直接在官方帳號記錄與查詢收支。', wrap: true, size: 'sm', color: '#475569' },
          { type: 'text', text: '範例：支出 120 午餐、收入 5000 薪資、查詢 本月', wrap: true, size: 'sm', color: '#64748b' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          uriButton('綁定 LINE 帳號', bindUrl),
          postbackButton('新增支出', 'action=record&type=expense', '新增支出'),
          postbackButton('查看紀錄', 'action=query_menu', '查看紀錄'),
        ],
      },
    },
  };
}

export function buildRecordFlex(title: string, lines: string[]): LineFlexMessage {
  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: title, weight: 'bold', size: 'lg', wrap: true },
          ...lines.map((line) => ({ type: 'text', text: line, size: 'sm', color: '#475569', wrap: true })),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          postbackButton('新增支出', 'action=record&type=expense', '新增支出'),
          postbackButton('查看紀錄', 'action=query_menu', '查看紀錄'),
        ],
      },
    },
  };
}

export function buildQueryFlex(title: string, summary: string[], details: string[]): LineFlexMessage {
  const detailItems = details.length > 0
    ? details.map((line) => ({ type: 'text', text: line, size: 'xs', color: '#64748b', wrap: true }))
    : [{ type: 'text', text: '目前沒有符合條件的紀錄。', size: 'sm', color: '#64748b', wrap: true }];

  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: title, weight: 'bold', size: 'lg', wrap: true },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: summary.map((line) => ({ type: 'text', text: line, size: 'sm', color: '#334155', wrap: true })),
          },
          { type: 'separator', margin: 'sm' },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: detailItems,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          postbackButton('新增支出', 'action=record&type=expense', '新增支出'),
          postbackButton('選單', 'action=menu', '選單'),
        ],
      },
    },
  };
}

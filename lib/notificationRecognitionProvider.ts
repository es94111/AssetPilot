import https from 'node:https';
import net from 'node:net';
import { isBlockedIpAddress, validateWebhookUrl } from './apiTokenCore';
import { notificationMessages, type NotificationInput } from './notificationRecognitionCore';
import { resolveTargetAddresses } from './webhookDelivery';

export const GEMINI_NOTIFICATION_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const GEMINI_NOTIFICATION_MODEL = 'gemini-3.5-flash-lite';

export function normalizeNotificationEndpoint(value: unknown): string {
  try {
    if (typeof value !== 'string' || /[?#]/u.test(value)) throw new Error('invalid_url');
    const endpoint = new URL(validateWebhookUrl(value));
    const path = endpoint.pathname.replace(/\/+$/u, '');
    endpoint.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
    return endpoint.href;
  } catch {
    throw new Error('請輸入公開的 HTTPS API 網址，網址中請勿包含帳密、查詢參數或片段。');
  }
}

export class NotificationProviderError extends Error {
  constructor(readonly code: 'address' | 'network' | 'redirect' | 'credentials' | 'limited' | 'upstream' | 'response') {
    super(code);
  }
}

export interface NotificationProviderConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

export async function requestNotificationCompletion(
  config: NotificationProviderConfig,
  notice: NotificationInput,
  timezone: string,
  // Recheck consent after asynchronous DNS and immediately before egress.
  maySend: () => boolean,
): Promise<unknown> {
  const url = new URL(normalizeNotificationEndpoint(config.endpoint));
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await resolveTargetAddresses(hostname, 3_000);
  if (!addresses?.length) throw new NotificationProviderError('network');
  if (addresses.some(({ address }) => isBlockedIpAddress(address))) throw new NotificationProviderError('address');
  const selected = addresses.find(({ family }) => family === 4) ?? addresses[0];
  const body = JSON.stringify({ model: config.model, stream: false, messages: notificationMessages(notice, timezone) });
  if (!maySend()) return null;

  return new Promise((resolve, reject) => {
    const request = https.request({
      host: selected.address,
      family: selected.family,
      servername: net.isIP(hostname) ? undefined : hostname,
      port: url.port || 443,
      path: url.pathname,
      agent: false,
      method: 'POST',
      signal: AbortSignal.timeout(9_000),
      headers: {
        Host: url.host,
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        const code = status >= 300 && status < 400 ? 'redirect'
          : status === 401 || status === 403 ? 'credentials'
            : status === 429 ? 'limited' : 'upstream';
        reject(new NotificationProviderError(code));
        response.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 64 * 1024) {
          reject(new NotificationProviderError('response'));
          response.destroy();
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new NotificationProviderError('response'));
        }
      });
      response.on('error', () => reject(new NotificationProviderError('network')));
      response.on('close', () => {
        if (!response.complete) reject(new NotificationProviderError('network'));
      });
    });
    request.on('upgrade', (_response, socket) => {
      socket.destroy();
      reject(new NotificationProviderError('response'));
    });
    request.on('error', () => reject(new NotificationProviderError('network')));
    request.end(body);
  });
}

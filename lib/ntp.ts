import dgram from 'node:dgram';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const NTP_PORT = 123;
const NTP_PACKET_SIZE = 48;
const NTP_UNIX_EPOCH_SECONDS = 2_208_988_800;
const NTP_FRACTION_SCALE = 2 ** 32;
const DEFAULT_TIMEOUT_MS = 3000;

export const DEFAULT_NTP_HOSTS = [
  'tw.pool.ntp.org',
  'pool.ntp.org',
  'time.google.com',
  'time.cloudflare.com',
];

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b, c, d] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return a === 255 && b === 255 && c === 255 && d === 255;
}

function isValidFqdn(host: string): boolean {
  if (!host || host.length > 253) return false;
  if (host.endsWith('.')) host = host.slice(0, -1);
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal')) {
    return false;
  }

  const labels = host.split('.');
  if (labels.length < 2) return false;
  return labels.every(label =>
    label.length >= 1 &&
    label.length <= 63 &&
    /^[a-z0-9-]+$/i.test(label) &&
    !label.startsWith('-') &&
    !label.endsWith('-')
  );
}

export function validateNtpHost(host: string): string {
  const normalized = String(host || '').trim().toLowerCase();
  if (!normalized) throw new Error('NTP host 不可為空');
  if (normalized.includes(':') || normalized.includes('/') || normalized.includes('\\') || normalized.includes('@')) {
    throw new Error('NTP host 僅支援 IPv4 或 FQDN');
  }

  const ipType = net.isIP(normalized);
  if (ipType === 4) {
    if (isPrivateOrReservedIpv4(normalized)) throw new Error('NTP host 不可指向私有或保留 IPv4');
    return normalized;
  }
  if (ipType !== 0) throw new Error('NTP host 僅支援 IPv4 或 FQDN');
  if (!isValidFqdn(normalized)) throw new Error('NTP host 格式錯誤');
  return normalized;
}

export async function resolveHostToPublicIpv4(host: string): Promise<string> {
  const normalized = validateNtpHost(host);
  if (net.isIP(normalized) === 4) return normalized;

  const results = await lookup(normalized, { family: 4, all: true, verbatim: true });
  const addresses = [...new Set(results.map(result => result.address))];
  if (addresses.length === 0) throw new Error('NTP host 無 IPv4 DNS 紀錄');
  for (const address of addresses) {
    if (net.isIP(address) !== 4 || isPrivateOrReservedIpv4(address)) {
      throw new Error('NTP host 解析到私有或保留 IPv4');
    }
  }
  return addresses[0];
}

function readNtpTimestamp(packet: Buffer, offset: number): number | null {
  const seconds = packet.readUInt32BE(offset);
  const fraction = packet.readUInt32BE(offset + 4);
  if (seconds === 0 && fraction === 0) return null;
  return (seconds - NTP_UNIX_EPOCH_SECONDS) * 1000 + (fraction / NTP_FRACTION_SCALE) * 1000;
}

export type NtpQueryResult = {
  host: string;
  resolvedIp: string;
  ntpTime: number;
  ntpTimeIso: string;
  offsetMs: number;
  roundTripDelayMs: number;
  stratum: number;
};

export async function queryNtp(host: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<NtpQueryResult> {
  const normalizedHost = validateNtpHost(host);
  const resolvedIp = await resolveHostToPublicIpv4(normalizedHost);

  return await new Promise<NtpQueryResult>((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const packet = Buffer.alloc(NTP_PACKET_SIZE);
    packet[0] = 0x1b;
    let settled = false;
    let sentAt = 0;

    const finish = (err?: Error, result?: NtpQueryResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (err) reject(err);
      else resolve(result!);
    };

    const timer = setTimeout(() => finish(new Error('NTP 查詢逾時')), timeoutMs);
    socket.unref();

    socket.once('error', err => finish(err));
    socket.once('message', message => {
      const receivedAt = Date.now();
      try {
        if (message.length < NTP_PACKET_SIZE) throw new Error('NTP 回應長度不足');
        const mode = message[0] & 0x07;
        const leap = message[0] >> 6;
        const stratum = message[1];
        if (mode !== 4) throw new Error('NTP 回應模式錯誤');
        if (leap === 3 || stratum === 0) throw new Error('NTP 伺服器回應無效');

        const receiveTime = readNtpTimestamp(message, 32);
        const transmitTime = readNtpTimestamp(message, 40);
        if (transmitTime === null) throw new Error('NTP 回應缺少傳送時間');

        const serverReceiveTime = receiveTime ?? transmitTime;
        const roundTripDelayMs = Math.max(0, (receivedAt - sentAt) - (transmitTime - serverReceiveTime));
        const offsetMs = Math.round(((serverReceiveTime - sentAt) + (transmitTime - receivedAt)) / 2);
        const ntpTime = receivedAt + offsetMs;

        finish(undefined, {
          host: normalizedHost,
          resolvedIp,
          ntpTime,
          ntpTimeIso: new Date(ntpTime).toISOString(),
          offsetMs,
          roundTripDelayMs: Math.round(roundTripDelayMs),
          stratum,
        });
      } catch (e) {
        finish(e instanceof Error ? e : new Error(String(e)));
      }
    });

    sentAt = Date.now();
    socket.send(packet, 0, packet.length, NTP_PORT, resolvedIp, err => {
      if (err) finish(err);
    });
  });
}

export async function queryAnyNtp(hosts = DEFAULT_NTP_HOSTS): Promise<NtpQueryResult> {
  const errors: string[] = [];
  for (const host of hosts) {
    try {
      return await queryNtp(host);
    } catch (e) {
      errors.push(`${host}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`所有 NTP 伺服器查詢失敗：${errors.join('；')}`);
}

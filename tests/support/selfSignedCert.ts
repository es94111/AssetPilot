// tests/support/selfSignedCert.ts — 測試專用的自簽憑證產生器（issue #285）
//
// 為什麼要自己產生 DER 而不是把 PEM 憑證／私鑰簽進版控：
// 1. 簽入私鑰會觸發 gitleaks 等秘密掃描器的誤報（本檔產生的是一次性、只在測試
//    記憶體中存在的金鑰，不會落盤）。
// 2. 不依賴 openssl（CI runner 與本機的版本不一，且 LibreSSL 行為不同）。
// 3. 憑證有效期可依當下時間產生，不會因為簽入的憑證過期而讓測試某天突然失敗。
//
// 只實作 X.509 的最小子集（自簽、RSA、subjectAltName），供本機 https 測試伺服器使用。
import crypto from 'node:crypto';

function derLen(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let v = len;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLen(content.length), content]);
}

function seq(...items: Buffer[]): Buffer {
  return der(0x30, Buffer.concat(items));
}

function setOf(...items: Buffer[]): Buffer {
  return der(0x31, Buffer.concat(items));
}

function integer(value: number | bigint): Buffer {
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let bytes = Buffer.from(hex, 'hex');
  // 最高位為 1 時必須補 0x00，否則會被解讀為負數
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
  return der(0x02, bytes);
}

function oid(dotted: string): Buffer {
  const parts = dotted.split('.').map(Number);
  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (const part of parts.slice(2)) {
    const chunk: number[] = [];
    let v = part;
    do {
      chunk.unshift((v & 0x7f) | (chunk.length ? 0x80 : 0));
      v >>= 7;
    } while (v > 0);
    bytes.push(...chunk);
  }
  return der(0x06, Buffer.from(bytes));
}

function utf8(value: string): Buffer {
  return der(0x0c, Buffer.from(value, 'utf8'));
}

function utcTime(date: Date): Buffer {
  const text = date.toISOString().slice(2).replace(/[-:]|\.\d+Z$/g, '').replace('T', '') + 'Z';
  return der(0x17, Buffer.from(text, 'ascii'));
}

function bitString(buf: Buffer): Buffer {
  return der(0x03, Buffer.concat([Buffer.from([0]), buf]));
}

/** RDNSequence 形式的單一 CN；測試只用到 CN，不需要完整 DN 支援。 */
function commonNameName(cn: string): Buffer {
  return seq(setOf(seq(oid('2.5.4.3'), utf8(cn))));
}

function ipToBuffer(ip: string): Buffer {
  if (!ip.includes(':')) return Buffer.from(ip.split('.').map(Number));
  const [head, tail] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const groups = [
    ...headParts,
    ...new Array(8 - headParts.length - tailParts.length).fill('0'),
    ...tailParts,
  ].map((g) => Number.parseInt(g, 16));
  const buf = Buffer.alloc(16);
  groups.forEach((v, i) => buf.writeUInt16BE(v, i * 2));
  return buf;
}

export interface SelfSignedCertOptions {
  /** 憑證 CN；DNS 名稱未提供時，TLS 驗證會以此為主機名比對來源。 */
  commonName: string;
  dnsNames?: string[];
  /** SAN 的 IP 條目；測試中固定住的「假公開 IP」需要出現在此才過得了憑證驗證。 */
  ipAddresses?: string[];
  days?: number;
}

export interface SelfSignedCert {
  certPem: string;
  keyPem: string;
}

export function generateSelfSignedCert(options: SelfSignedCertOptions): SelfSignedCert {
  const { commonName, dnsNames = [], ipAddresses = [], days = 730 } = options;
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const spki = publicKey.export({ type: 'spki', format: 'der' });

  // sha256WithRSAEncryption：AlgorithmIdentifier 的 parameters 必須是 ASN.1 NULL
  const sha256Rsa = seq(oid('1.2.840.113549.1.1.11'), der(0x05, Buffer.alloc(0)));
  const altNames = [
    ...dnsNames.map((name) => der(0x82, Buffer.from(name, 'ascii'))), // dNSName
    ...ipAddresses.map((ip) => der(0x87, ipToBuffer(ip))), // iPAddress
  ];
  const now = new Date();
  const tbs = seq(
    der(0xa0, integer(2)), // version v3
    integer(BigInt('0x' + crypto.randomBytes(8).toString('hex'))), // 隨機序號
    sha256Rsa,
    commonNameName(commonName),
    seq(utcTime(new Date(now.getTime() - 60_000)), utcTime(new Date(now.getTime() + days * 86_400_000))),
    commonNameName(commonName),
    spki,
    ...(altNames.length > 0
      ? [der(0xa3, seq(seq(oid('2.5.29.17'), der(0x04, seq(...altNames)))))] // extensions/SAN
      : []),
  );
  const certDer = seq(tbs, sha256Rsa, bitString(crypto.sign('sha256', tbs, privateKey)));

  const toPem = (buffer: Buffer, label: string): string =>
    `-----BEGIN ${label}-----\n${buffer
      .toString('base64')
      .replace(/(.{64})/g, '$1\n')
      .trim()}\n-----END ${label}-----\n`;

  return {
    certPem: toPem(certDer, 'CERTIFICATE'),
    keyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

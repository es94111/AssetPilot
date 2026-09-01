import crypto from 'crypto';
import { registerTtlMapPrune } from './memoryStorePrune';

const APP_AUTH_TICKET_TTL_MS = 2 * 60 * 1000;

interface AppAuthTicketEntry {
  userId: string;
  issuedAt: number;
  // Random value the native app generates before opening the in-browser
  // passkey login page, threads through as a URL param so the page can bind
  // it into the ticket, and must present again (out-of-band from the ticket
  // itself, which travels through a custom-scheme deep link) to exchange the
  // ticket for a session. Without this, any holder of the ticket URI alone
  // (e.g. another app registered for the same custom scheme) could exchange
  // it from an unintended client (AUTHZ-VULN-07).
  deviceNonce: string | null;
}

const appAuthTickets = new Map<string, AppAuthTicketEntry>();
registerTtlMapPrune(
  appAuthTickets,
  (entry) => (Date.now() - entry.issuedAt) > APP_AUTH_TICKET_TTL_MS,
);

function pruneAppAuthTickets() {
  const now = Date.now();
  for (const [ticket, entry] of appAuthTickets.entries()) {
    if (now - entry.issuedAt > APP_AUTH_TICKET_TTL_MS) appAuthTickets.delete(ticket);
  }
}

export function issueAppAuthTicket(userId: string, deviceNonce?: string): string {
  pruneAppAuthTickets();
  const ticket = crypto.randomBytes(32).toString('base64url');
  appAuthTickets.set(ticket, {
    userId,
    issuedAt: Date.now(),
    deviceNonce: deviceNonce || null,
  });
  return ticket;
}

export function consumeAppAuthTicket(ticket: unknown, deviceNonce?: unknown): string | null {
  if (typeof ticket !== 'string' || !ticket) return null;
  pruneAppAuthTickets();
  const entry = appAuthTickets.get(ticket);
  if (!entry) return null;
  appAuthTickets.delete(ticket);
  if (entry.deviceNonce && entry.deviceNonce !== deviceNonce) return null;
  return entry.userId;
}

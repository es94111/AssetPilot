import crypto from 'crypto';

const APP_AUTH_TICKET_TTL_MS = 2 * 60 * 1000;
const appAuthTickets = new Map<string, { userId: string; issuedAt: number }>();

function pruneAppAuthTickets() {
  const now = Date.now();
  for (const [ticket, entry] of appAuthTickets.entries()) {
    if (now - entry.issuedAt > APP_AUTH_TICKET_TTL_MS) appAuthTickets.delete(ticket);
  }
}

export function issueAppAuthTicket(userId: string): string {
  pruneAppAuthTickets();
  const ticket = crypto.randomBytes(32).toString('base64url');
  appAuthTickets.set(ticket, { userId, issuedAt: Date.now() });
  return ticket;
}

export function consumeAppAuthTicket(ticket: unknown): string | null {
  if (typeof ticket !== 'string' || !ticket) return null;
  pruneAppAuthTickets();
  const entry = appAuthTickets.get(ticket);
  if (!entry) return null;
  appAuthTickets.delete(ticket);
  return entry.userId;
}

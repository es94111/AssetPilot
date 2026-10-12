import { NextResponse } from 'next/server';
import { TagError } from './transactionTags';

export function tagErrorResponse(e: unknown) {
  if (e instanceof TagError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  throw e;
}

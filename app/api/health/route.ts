export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  });
}

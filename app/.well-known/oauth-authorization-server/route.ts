import { NextRequest, NextResponse } from 'next/server';
import { getMcpOAuthUrls } from '@/lib/mcpOAuthCore';
import { createMcpAuthorizationServerMetadata } from '@/lib/mcpOAuthMetadata';

export async function GET(request: NextRequest) {
  const urls = getMcpOAuthUrls({ headers: request.headers, requestOrigin: request.nextUrl.origin });
  return NextResponse.json(createMcpAuthorizationServerMetadata(urls), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'MCP-Protocol-Version',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}

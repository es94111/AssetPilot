import { NextResponse } from "next/server";

export function lineIntegrationRetired() {
  return NextResponse.json(
    { error: "LINE 整合已停止提供", code: "line_integration_retired" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

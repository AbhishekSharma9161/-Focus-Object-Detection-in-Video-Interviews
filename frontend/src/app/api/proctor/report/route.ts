import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { report } = await req.json().catch(() => ({ report: null }));
  if (!report) return NextResponse.json({ error: "missing report" }, { status: 400 });
  const id = report?.id ?? `${Date.now()}-report`;
  return NextResponse.json({ id });
}




import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = `${Date.now()}-${(body?.candidateName ?? "candidate")}`;
  return NextResponse.json({ id });
}




import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "siren_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!code) {
      return NextResponse.json({ ok: false, error: "Code required" }, { status: 400 });
    }
    const res = await fetch(`${API_URL}/api/access/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data.error || "Invalid code" }, { status: 403 });
    }
    const out = NextResponse.json({ ok: true });
    out.cookies.set(COOKIE_NAME, "1", {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
    return out;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}

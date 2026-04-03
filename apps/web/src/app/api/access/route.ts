import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/apiUrl";

const COOKIE_NAME = "siren_access";

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
    // Session cookie: no maxAge so browser drops it when closed; user must re-enter code after restart
    out.cookies.set(COOKIE_NAME, "1", {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
    return out;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}

/** Clear access cookie so user must re-enter code (e.g. sign out from terminal). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { hapticLight } from "@/lib/haptics";

export default function AccessPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    hapticLight();
    setError(null);
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div
          className="w-full max-w-sm rounded-2xl border px-6 py-8"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <h1 className="font-heading font-bold text-xl mb-2" style={{ color: "var(--text-1)" }}>
            Enter access code
          </h1>
          <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
            The terminal is invite-only. Enter the code you received to continue.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Access code"
              className="w-full px-4 h-11 rounded-[8px] font-body text-sm border transition-colors focus:outline-none focus:border-[var(--accent)]"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-default)",
                color: "var(--text-1)",
              }}
              autoComplete="one-time-code"
            />
            {error && (
              <p className="font-body text-xs" style={{ color: "var(--down)" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full h-11 rounded-[8px] font-heading font-semibold text-sm uppercase tracking-[0.1em] transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--accent)", color: "var(--bg-void)" }}
            >
              {loading ? "Checking…" : "Continue"}
            </button>
          </form>
          <p className="font-body text-xs mt-6 text-center" style={{ color: "var(--text-2)" }}>
            Don’t have a code?{" "}
            <Link href="/waitlist" className="underline" style={{ color: "var(--accent)" }} onClick={() => hapticLight()}>
              Join the waitlist
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

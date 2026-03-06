"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { XCircle } from "lucide-react";
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
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "var(--bg-void)" }}>
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
          <form onSubmit={handleSubmit}>
            <div
              className="w-full rounded-[10px] border-2 overflow-hidden flex flex-col sm:flex-row"
              style={{ borderColor: "var(--border-default)" }}
            >
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Access code"
                className="flex-1 min-w-0 px-4 h-12 font-body text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-0 border-0 rounded-none"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-1)",
                }}
                autoComplete="one-time-code"
              />
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="h-12 px-6 font-heading font-semibold text-sm uppercase tracking-[0.1em] transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed border-0 rounded-none shrink-0"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                {loading ? "…" : "Go"}
              </button>
            </div>
          </form>
          <p className="font-body text-xs mt-6 text-center" style={{ color: "var(--text-2)" }}>
            Don’t have a code?{" "}
            <Link href="/waitlist" className="underline" style={{ color: "var(--accent)" }} onClick={() => hapticLight()}>
              Join the Waitlist
            </Link>
          </p>
        </div>
      </main>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => { hapticLight(); setError(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="w-full max-w-sm rounded-2xl border p-6 text-center"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--down)" }} />
              <h3 className="font-heading font-bold text-lg mb-2" style={{ color: "var(--text-1)" }}>
                Invalid code
              </h3>
              <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
                {error}
              </p>
              <button
                type="button"
                onClick={() => { hapticLight(); setError(null); }}
                className="w-full py-2.5 rounded-xl font-body text-sm font-medium border"
                style={{ background: "var(--bg-elevated)", color: "var(--text-1)", borderColor: "var(--border-default)" }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

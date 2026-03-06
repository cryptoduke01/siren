"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

const ACCESS_COOKIE = "siren_access";
const TERMINAL_PATHS = ["/", "/portfolio", "/trending", "/watchlist", "/onboarding"];

function hasAccessCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${ACCESS_COOKIE}=`));
}

function isAllowedPath(pathname: string): boolean {
  return pathname === "/waitlist" || pathname === "/admin" || pathname === "/access" || pathname === "/preview" || pathname.startsWith("/waitlist") || pathname.startsWith("/admin") || pathname.startsWith("/access") || pathname.startsWith("/preview");
}

function isTerminalPath(pathname: string): boolean {
  return pathname === "/" || TERMINAL_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<"checking" | "gated" | "allowed">("checking");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAllowedPath(pathname)) {
      setStatus("allowed");
      return;
    }
    if (!isTerminalPath(pathname)) {
      setStatus("allowed");
      return;
    }
    if (hasAccessCookie()) {
      setStatus("allowed");
      return;
    }
    setStatus("gated");
  }, [pathname]);

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
      setStatus("allowed");
      setCode("");
      window.location.reload();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (status === "checking") {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ background: "var(--bg-void)" }}
        aria-hidden="true"
      >
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (status === "gated") {
    return (
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-4 overflow-y-auto"
        style={{ background: "var(--bg-void)" }}
      >
        <div
          className="w-full max-w-sm rounded-2xl border px-6 py-8 flex-shrink-0"
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
              className="w-full px-4 h-12 rounded-[10px] font-body text-sm border-2 transition-colors focus:outline-none focus:border-[var(--accent)]"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-default)",
                color: "var(--text-1)",
              }}
              autoComplete="one-time-code"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full h-12 rounded-[10px] font-heading font-semibold text-sm uppercase tracking-[0.1em] transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-transparent"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              {loading ? "Checking…" : "Continue"}
            </button>
          </form>
          <p className="font-body text-xs mt-6 text-center" style={{ color: "var(--text-2)" }}>
            Don’t have a code?{" "}
            <Link href="/waitlist" className="underline" style={{ color: "var(--accent)" }} onClick={() => hapticLight()}>
              Join the Waitlist
            </Link>
          </p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[201] flex items-center justify-center px-4"
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

  return <>{children}</>;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { Footer } from "@/components/Footer";
import { useThemeStore } from "@/store/useThemeStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function WaitlistPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<"success" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const theme = useThemeStore((s) => s.theme);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    hapticLight();
    if (!email?.trim()) return;
    setLoading(true);
    setModal(null);
    setErrorMessage("");
    try {
      const res = await fetch(`${API_URL}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim().toLowerCase(),
          wallet: wallet.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(typeof data.error === "string" ? data.error : "Something went wrong. Please try again.");
        setModal("error");
        setLoading(false);
        return;
      }
      setModal("success");
      setName("");
      setEmail("");
      setWallet("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setModal("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 px-4 py-10 md:py-16">
        <div className="mx-auto w-full max-w-5xl grid gap-10 md:grid-cols-2 items-center">
          <section className="space-y-6">
            <div>
              <h1
                className="font-heading font-bold text-4xl md:text-[58px] leading-[1.03] mb-4"
                style={{ color: "var(--text-1)" }}
              >
                Join the Siren Waitlist
              </h1>
              <p
                className="font-body text-sm md:text-base max-w-xl"
                style={{ color: "var(--text-2)" }}
              >
                Be first to access the event-driven meme terminal — prediction markets, Bags launches,
                and MEV-safe swaps in one screen.
              </p>
            </div>
            <div className="rounded-xl overflow-hidden border transition-all duration-200" style={{ borderColor: "var(--border-subtle)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: "var(--bg-elevated)" }}>
                <span className="w-3 h-3 rounded-full" style={{ background: "var(--text-3)" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "var(--text-3)" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "var(--text-3)" }} />
              </div>
              <iframe
                src={`/preview?theme=${theme}`}
                title="Siren terminal preview"
                className="w-full border-0 bg-[var(--bg-void)]"
                style={{ minHeight: "280px", height: "280px" }}
              />
            </div>
            <ul className="space-y-3">
              {[
                "Live Kalshi market data routed through DFlow.",
                "Token surfacing that actually tracks real-world events.",
                "Creator tools via Bags with fee-sharing built in.",
              ].map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <span
                    className="mt-[6px] inline-block h-2 w-2 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                  <span className="font-body text-sm" style={{ color: "var(--text-1)" }}>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
                Join early builders and solvers already on the list.
              </p>
            </div>
          </section>

          <section className="space-y-6">
            <form
              onSubmit={handleSubmit}
              className="rounded-[10px] border px-6 py-7 md:px-8 md:py-8"
              style={{
                borderColor: "var(--border-subtle)",
                background: "var(--bg-surface)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
              }}
            >
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="waitlist-name"
                    className="block font-body text-xs font-medium mb-2"
                    style={{ color: "var(--text-2)" }}
                  >
                    Name
                  </label>
                  <input
                    id="waitlist-name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 h-10 rounded-[8px] font-body text-sm border transition-colors focus:outline-none"
                    style={{
                      background: "var(--bg-elevated)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-1)",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="waitlist-email"
                    className="block font-body text-xs font-medium mb-2"
                    style={{ color: "var(--text-2)" }}
                  >
                    Email *
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 h-10 rounded-[8px] font-body text-sm border transition-colors focus:outline-none"
                    style={{
                      background: "var(--bg-elevated)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-1)",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="waitlist-wallet"
                    className="block font-body text-xs font-medium mb-2"
                    style={{ color: "var(--text-2)" }}
                  >
                    Solana wallet (optional)
                  </label>
                  <input
                    id="waitlist-wallet"
                    type="text"
                    placeholder="Your wallet address"
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    className="w-full px-4 h-10 rounded-[8px] font-body text-sm border transition-colors focus:outline-none focus:border-[var(--accent)]"
                    style={{
                      background: "var(--bg-elevated)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-1)",
                    }}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email?.trim()}
                className="mt-6 w-full h-11 rounded-[8px] font-heading font-semibold text-xs md:text-sm uppercase tracking-[0.1em] transition-all duration-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--accent)", color: "var(--bg-void)" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining…
                  </>
                ) : (
                  "Join Waitlist"
                )}
              </button>
            </form>

            <p className="font-body text-xs text-center mt-2" style={{ color: "var(--text-2)" }}>
              Already have access?{" "}
              <Link href="/access" className="underline" style={{ color: "var(--accent)" }} onClick={() => hapticLight()}>
                Enter code
              </Link>
            </p>
          </section>
        </div>
      </main>
      <Footer />

      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => { hapticLight(); setModal(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="w-full max-w-sm rounded-2xl border p-6 text-center"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-subtle)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {modal === "success" ? (
                <>
                  <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--accent)" }} />
                  <h3 className="font-heading font-bold text-lg mb-2" style={{ color: "var(--text-1)" }}>
                    You are on the list
                  </h3>
                  <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
                    We will notify you when Siren is ready. Stay tuned.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--down)" }} />
                  <h3 className="font-heading font-bold text-lg mb-2" style={{ color: "var(--text-1)" }}>
                    Something went wrong
                  </h3>
                  <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
                    {errorMessage}
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={() => { hapticLight(); setModal(null); }}
                className="w-full py-2.5 rounded-xl font-body text-sm font-medium"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-1)",
                  border: "1px solid var(--border-default)",
                }}
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

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, ArrowRight, Wallet2, X } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
const ONBOARDING_COMPLETE_KEY = "siren-onboarding-complete";
const GUIDE_PENDING_KEY = "siren-terminal-guide-pending";
const GUIDE_SEEN_KEY = "siren-terminal-guide-seen";

const GUIDE_POINTS = [
  {
    icon: Radar,
    title: "Start with the market feed",
    body: "Siren now pushes nearer-term, more executable books to the top by default so you can scan what is actually in play first.",
  },
  {
    icon: ArrowRight,
    title: "Open a market before you size",
    body: "Click any market to read the route, pricing, and risk language before you buy YES or NO.",
  },
  {
    icon: Wallet2,
    title: "Use portfolio to manage exits",
    body: "Come back to portfolio when you want closes, post-trade context, and a cleaner read on what actually happened.",
  },
] as const;

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname !== "/terminal") return;
    const completedOnboarding = localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
    const pendingGuide = localStorage.getItem(GUIDE_PENDING_KEY) === "true";
    const seenGuide = localStorage.getItem(GUIDE_SEEN_KEY) === "true";
    if (!completedOnboarding || (!pendingGuide && seenGuide)) return;
    const timer = window.setTimeout(() => setIsOpen(true), 550);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const handleClose = () => {
    hapticLight();
    localStorage.setItem(GUIDE_SEEN_KEY, "true");
    localStorage.removeItem(GUIDE_PENDING_KEY);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ background: "rgba(6, 6, 9, 0.72)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.985 }}
          className="w-full max-w-lg"
        >
          <div
            className="rounded-[28px] border p-5 md:p-6"
            style={{
              background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, transparent), color-mix(in srgb, var(--bg-base) 95%, transparent))",
              borderColor: "var(--border-subtle)",
              boxShadow: "0 28px 72px -48px rgba(0,0,0,0.55)",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="siren-guide-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-[32rem]">
                <p className="font-heading text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--accent)" }}>
                  First run guide
                </p>
                <h2
                  id="siren-guide-title"
                  className="mt-2 font-heading text-[1.55rem] font-bold leading-[1.08] tracking-[-0.02em]"
                  style={{ color: "var(--text-1)" }}
                >
                  How to use Siren
                </h2>
                <p className="mt-3 font-body text-sm leading-[1.6]" style={{ color: "var(--text-2)" }}>
                  Siren is meant to shorten the jump from “interesting market” to “do I actually take this trade?” These are the three moves that matter most.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)", background: "var(--bg-surface)" }}
                aria-label="Close guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {GUIDE_POINTS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[20px] border px-4 py-4"
                  style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-surface) 92%, transparent)" }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl"
                      style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                    >
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-heading text-base font-bold leading-[1.08]" style={{ color: "var(--text-1)" }}>
                        {item.title}
                      </p>
                      <p className="mt-2 font-body text-sm leading-[1.6]" style={{ color: "var(--text-2)" }}>
                        {item.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-body text-xs leading-[1.5]" style={{ color: "var(--text-3)" }}>
                You can reopen this later from onboarding by running through the flow again.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl px-4 font-heading text-xs uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                Open the terminal
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Radar, ArrowRight, Wallet2, X } from "lucide-react";
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
  const [step, setStep] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname !== "/terminal") return;
    const completedOnboarding = localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
    const pendingGuide = localStorage.getItem(GUIDE_PENDING_KEY) === "true";
    const seenGuide = localStorage.getItem(GUIDE_SEEN_KEY) === "true";
    if (!completedOnboarding || (!pendingGuide && seenGuide)) return;
    const timer = window.setTimeout(() => {
      setStep(0);
      setIsOpen(true);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const handleClose = () => {
    hapticLight();
    localStorage.setItem(GUIDE_SEEN_KEY, "true");
    localStorage.removeItem(GUIDE_PENDING_KEY);
    setStep(0);
    setIsOpen(false);
  };

  const handleNext = () => {
    hapticLight();
    if (step >= GUIDE_POINTS.length - 1) {
      handleClose();
      return;
    }
    setStep((current) => current + 1);
  };

  const handleBack = () => {
    hapticLight();
    if (step <= 0) return;
    setStep((current) => current - 1);
  };

  if (!isOpen) return null;

  const current = GUIDE_POINTS[step];

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
          className="w-full max-w-xl"
        >
          <div
            className="rounded-[30px] border p-6 md:p-7"
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
              <div className="max-w-[34rem]">
                <p className="font-heading text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--accent)" }}>
                  First run guide
                </p>
                <h2
                  id="siren-guide-title"
                  className="mt-2 font-heading text-[1.75rem] font-bold leading-[1.08] tracking-[-0.02em] md:text-[1.95rem]"
                  style={{ color: "var(--text-1)" }}
                >
                  How to use Siren
                </h2>
                <p className="mt-3 max-w-[31rem] font-body text-sm leading-[1.65] md:text-[15px]" style={{ color: "var(--text-2)" }}>
                  Siren is meant to shorten the jump from “interesting market” to “do I actually take this trade?” Walk through the three moves once, then the terminal will feel a lot more obvious.
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

            <div className="mt-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.title}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="rounded-[24px] border p-5 md:p-6"
                  style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-surface) 92%, transparent)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                    >
                      <current.icon className="h-5 w-5" />
                    </div>
                    <span
                      className="rounded-full border px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.12em]"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)", background: "var(--bg-base)" }}
                    >
                      {step + 1} / {GUIDE_POINTS.length}
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="font-heading text-[1.2rem] font-bold leading-[1.08] tracking-[-0.02em] md:text-[1.35rem]" style={{ color: "var(--text-1)" }}>
                      {current.title}
                    </p>
                    <p className="mt-3 max-w-[30rem] font-body text-sm leading-[1.7] md:text-[15px]" style={{ color: "var(--text-2)" }}>
                      {current.body}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2">
              {GUIDE_POINTS.map((item, index) => {
                const active = index === step;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setStep(index);
                    }}
                    className="h-2.5 rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    style={{
                      width: active ? "28px" : "10px",
                      background: active ? "var(--accent)" : "color-mix(in srgb, var(--border-subtle) 90%, var(--bg-surface))",
                    }}
                    aria-label={`Go to guide step ${index + 1}`}
                  />
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-body text-xs leading-[1.55]" style={{ color: "var(--text-3)" }}>
                  You can reopen this later from onboarding by running through the flow again.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-2 font-body text-xs transition-colors hover:text-[var(--text-1)]"
                  style={{ color: "var(--text-3)" }}
                >
                  Skip guide
                </button>
              </div>

              <div className="flex items-center gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={step === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 font-heading text-xs uppercase tracking-[0.12em] transition-colors disabled:opacity-40"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)", background: "var(--bg-surface)" }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 font-heading text-xs uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  {step === GUIDE_POINTS.length - 1 ? "Open the terminal" : "Next step"}
                  {step < GUIDE_POINTS.length - 1 && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

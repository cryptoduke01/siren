"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { hapticLight } from "@/lib/haptics";

const ONBOARDING_KEY = "siren-onboarding-seen";

const STEPS = [
  {
    title: "Welcome to Siren",
    body: "Your event-driven meme token terminal. Connect prediction markets with tokens in one place.",
  },
  {
    title: "Market feed",
    body: "Browse prediction markets on the left. Click one to see probability and velocity. Filter by Politics, Crypto, Sports, and more.",
  },
  {
    title: "Token surface",
    body: "Tokens here match your selected market or show trending picks. Click Buy to trade via Jupiter.",
  },
  {
    title: "Connect wallet",
    body: "Use Phantom, Solflare, or Torus to connect. Then trade markets (YES/NO) and tokens from the same panel.",
  },
];

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/waitlist" || pathname === "/access") return;
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      const t = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  const handleClose = () => {
    hapticLight();
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsOpen(false);
  };

  const handleNext = () => {
    hapticLight();
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else handleClose();
  };

  const handleBack = () => {
    hapticLight();
    if (step > 0) setStep((s) => s - 1);
  };

  if (!isOpen) return null;

  const current = STEPS[step];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ background: "var(--bg-base)" }}
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md flex flex-col"
        >
          <div className="rounded-lg border p-6" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <h2 className="font-heading font-bold text-lg text-[var(--text-primary)] mb-3">{current.title}</h2>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">{current.body}</p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: i === step ? "var(--accent-primary)" : "var(--border)",
                      opacity: i === step ? 1 : 0.5,
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-3 py-2 text-sm font-heading font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-2 rounded-md text-sm font-heading font-bold text-[var(--bg-base)]"
                  style={{ background: "var(--accent-primary)" }}
                >
                  {step < STEPS.length - 1 ? "Next" : "Get started"}
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="mt-4 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            Skip tutorial
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

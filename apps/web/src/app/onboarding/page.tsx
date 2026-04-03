"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import {
  Rocket,
  TrendingUp,
  BarChart3,
  Zap,
  Shield,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { hapticLight } from "@/lib/haptics";
import { motion } from "framer-motion";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

const HERO_BULLETS = [
  "Live Kalshi + Polymarket prediction market signals",
  "Solana meme tokens matched to market movement",
  "Execute before CT reacts",
];

const FEATURES = [
  {
    icon: BarChart3,
    title: "Prediction markets",
    description:
      "Browse Kalshi markets with live probability, volume, and velocity. Politics, crypto, sports—organized by category.",
  },
  {
    icon: Zap,
    title: "Event-driven tokens",
    description:
      "Tap a market to surface meme tokens tied to that event. Bags, Pump, Bonk—matched by keywords and DexScreener.",
  },
  {
    icon: TrendingUp,
    title: "Trade both",
    description:
      "Buy YES or NO on markets via DFlow. Swap tokens via Jupiter with MEV protection. One terminal, prediction + meme.",
  },
  {
    icon: Rocket,
    title: "Launch tokens",
    description:
      "No matching token? Launch one via Bags—social links, metadata, fee share. Track launches from your portfolio.",
  },
  {
    icon: Shield,
    title: "Portfolio & PnL",
    description:
      "SOL balances, token holdings, prediction positions, Bags fee earnings. Share or download your PnL card.",
  },
];

/** Privy is the only login path in production (embedded Solana wallet). */
function OnboardingPrivyLogin() {
  const { connected, walletSessionStatus } = useSirenWallet();
  const { login, ready } = usePrivy();
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (connected && walletSessionStatus === "ready") router.replace("/");
  }, [connected, walletSessionStatus, router]);

  const handlePrivyLogin = async () => {
    hapticLight();
    setLoginError(null);
    try {
      await login();
    } catch (e) {
      console.error("[Siren] Privy login failed", e);
      setLoginError(e instanceof Error ? e.message : "Could not start login. Try again.");
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-4 w-full">
      {walletSessionStatus === "privy-loading" || walletSessionStatus === "embedded-provisioning" ? (
        <div
          className="flex items-center justify-center gap-2 rounded-lg border px-3 py-3 font-label text-[12px]"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-2)" }}
        >
          <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: "var(--accent)" }} />
          {walletSessionStatus === "privy-loading" ? "Initializing…" : "Creating your Solana wallet…"}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void handlePrivyLogin()}
        disabled={!ready || walletSessionStatus === "privy-loading"}
        className="w-full px-6 py-3.5 rounded-lg font-heading font-semibold text-sm uppercase tracking-[0.12em] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
      >
        {!ready ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </span>
        ) : (
          "Log in with email or social"
        )}
      </button>
      <p className="font-body text-[16px] text-center" style={{ color: "var(--text-2)" }}>
        Email, Google, GitHub, or X
      </p>
      {loginError && (
        <p className="font-body text-[13px] text-center" style={{ color: "var(--down)" }}>
          {loginError}
        </p>
      )}
      <p className="font-body text-[12px] text-center leading-relaxed" style={{ color: "var(--text-3)" }}>
        Uses an embedded Solana wallet after you sign in. No browser extension required.
      </p>
    </div>
  );
}

function OnboardingPrivyMissing() {
  return (
    <div className="flex flex-col gap-3 text-center">
      <p className="font-body text-[15px]" style={{ color: "var(--text-2)" }}>
        Sign-in uses Privy. Add your app ID to enable login.
      </p>
      <p className="font-mono text-[11px] break-all" style={{ color: "var(--text-3)" }}>
        NEXT_PUBLIC_PRIVY_APP_ID
      </p>
    </div>
  );
}

export default function OnboardingPage() {
  const { connected, walletSessionStatus } = useSirenWallet();
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (connected && walletSessionStatus === "ready") {
      try {
        localStorage.setItem("siren-onboarding-complete", "true");
      } catch {
        /* ignore */
      }
      router.replace("/");
    }
  }, [connected, walletSessionStatus, router]);

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "var(--bg-void)" }}>
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-[minmax(0,55%)_minmax(0,45%)] lg:min-h-[100dvh]">
        {/* Left: story (desktop) / mobile: logo + headline first */}
        <section className="flex flex-col justify-center px-5 pt-10 pb-8 md:px-10 lg:py-16 lg:pl-14 lg:pr-10 order-1">
          <img
            src="/brand/logo.svg"
            alt="Siren"
            className="h-9 md:h-10 w-auto mx-auto lg:mx-0 mb-8 lg:mb-10"
          />
          <h1
            className="font-heading font-bold tracking-tight text-center lg:text-left max-w-xl mx-auto lg:mx-0 mb-6"
            style={{ color: "var(--text-1)", lineHeight: 1.12, fontSize: "clamp(2rem, 5vw, 3rem)" }}
          >
            Trade the signal. Not the noise.
          </h1>
          <ul className="space-y-3 max-w-xl mx-auto lg:mx-0 mb-8 hidden lg:block">
            {HERO_BULLETS.map((line) => (
              <li key={line} className="flex items-start gap-3 font-body text-[16px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--up)" }} aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p
            className="font-label text-[12px] uppercase tracking-[0.14em] text-center lg:text-left mb-2 lg:mb-0"
            style={{ color: "var(--text-3)" }}
          >
            Social proof
          </p>
          <p className="font-body text-[16px] text-center lg:text-left" style={{ color: "var(--text-2)" }}>
            55+ traders on the waitlist
          </p>
        </section>

        {/* Right: connect card */}
        <section className="flex flex-col justify-center px-5 pb-10 md:px-10 lg:py-16 lg:pr-14 lg:pl-6 order-2">
          <div
            className="w-full max-w-md mx-auto p-8 md:p-10"
            style={{
              borderRadius: "8px",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border-default)",
              background: "linear-gradient(165deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
              boxShadow: "0 1px 0 0 var(--border-subtle), 0 12px 40px rgba(0,0,0,0.25)",
            }}
          >
            <p className="font-label text-[12px] uppercase tracking-[0.16em] mb-6" style={{ color: "var(--accent)" }}>
              Get started
            </p>
            {PRIVY_APP_ID ? <OnboardingPrivyLogin /> : <OnboardingPrivyMissing />}
            <Link
              href="/"
              onClick={() => hapticLight()}
              className="mt-6 inline-flex items-center justify-center gap-2 w-full font-body text-sm font-medium"
              style={{ color: "var(--text-3)" }}
            >
              Skip to terminal
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>

        {/* Mobile: bullets below card */}
        <section className="lg:hidden order-3 px-5 pb-12 md:px-10">
          <ul className="space-y-3 max-w-xl mx-auto">
            {HERO_BULLETS.map((line) => (
              <li key={line} className="flex items-start gap-3 font-body text-[16px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--up)" }} aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Feature grid — full width */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="order-4 px-5 pb-16 md:px-10 lg:col-span-2 lg:px-14"
        >
          <h2
            className="font-heading font-semibold text-sm uppercase tracking-wider mb-6 text-center"
            style={{ color: "var(--text-3)" }}
          >
            What you can do
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {FEATURES.slice(0, showMore ? undefined : 3).map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
                className="rounded-xl border p-5 transition-all duration-200 hover:border-[var(--border-active)]"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-surface)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{
                    background: "var(--accent-dim)",
                    color: "var(--accent)",
                  }}
                >
                  <f.icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <p className="font-heading font-semibold text-sm mb-1.5" style={{ color: "var(--text-1)" }}>
                  {f.title}
                </p>
                <p className="font-body text-[15px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {f.description}
                </p>
              </motion.div>
            ))}
          </div>
          {!showMore && FEATURES.length > 3 && (
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setShowMore(true);
              }}
              className="mt-4 w-full max-w-md mx-auto block py-2.5 rounded-xl font-body text-xs font-medium flex items-center justify-center gap-1"
              style={{
                color: "var(--text-3)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Show {FEATURES.length - 3} more
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="order-5 px-5 pb-12 text-center max-w-3xl mx-auto lg:col-span-2 lg:px-14"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 text-left">
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
              <p className="font-heading text-xs mb-1" style={{ color: "var(--text-1)" }}>
                Execution
              </p>
              <p className="font-body text-[15px]" style={{ color: "var(--text-2)" }}>
                Token swaps route through Jupiter with MEV-aware paths and explicit slippage controls.
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
              <p className="font-heading text-xs mb-1" style={{ color: "var(--text-1)" }}>
                Market intelligence
              </p>
              <p className="font-body text-[15px]" style={{ color: "var(--text-2)" }}>
                Track Kalshi probabilities and velocity while seeing the token surface react in real time.
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
              <p className="font-heading text-xs mb-1" style={{ color: "var(--text-1)" }}>
                Launch + portfolio
              </p>
              <p className="font-body text-[15px]" style={{ color: "var(--text-2)" }}>
                Launch through Bags and monitor balances, positions, and fee earnings from one account view.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 border mb-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
            <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
              Solana · DFlow · Jupiter · Bags
            </p>
          </div>
          <a
            href="https://docs.onsiren.xyz"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticLight()}
            className="font-body text-xs underline"
            style={{ color: "var(--text-3)" }}
          >
            Read the docs
          </a>
        </motion.section>
      </main>
    </div>
  );
}

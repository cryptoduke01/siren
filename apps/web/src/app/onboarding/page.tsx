"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { TopBar } from "@/components/TopBar";
import {
  Rocket,
  TrendingUp,
  BarChart3,
  Zap,
  Shield,
  ArrowRight,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { hapticLight } from "@/lib/haptics";
import { WalletModal } from "@/components/WalletModal";
import { motion } from "framer-motion";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

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

function OnboardingWithBoth() {
  const { connected } = useSirenWallet();
  const { login, ready } = usePrivy();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (connected) router.replace("/");
  }, [connected, router]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      <button
        type="button"
        onClick={() => {
          hapticLight();
          setModalOpen(true);
        }}
        className="w-full px-8 py-4 rounded-xl font-heading font-semibold text-sm uppercase tracking-[0.12em] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
      >
        Connect Solana wallet
      </button>
      <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
        Phantom, Backpack, Solflare, Coinbase, Torus
      </p>
      <span className="font-body text-xs" style={{ color: "var(--text-3)" }}>
        or
      </span>
      <button
        type="button"
        onClick={() => {
          hapticLight();
          login();
        }}
        disabled={!ready}
        className="w-full px-8 py-4 rounded-xl font-heading font-semibold text-sm uppercase tracking-[0.12em] transition-all duration-200 border disabled:opacity-50 hover:border-[var(--border-active)] active:scale-[0.98]"
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-1)",
          background: "var(--bg-surface)",
        }}
      >
        {ready ? "Log in with email or social" : "Loading…"}
      </button>
      <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
        Email, Google, GitHub, or X
      </p>
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function OnboardingWithAdapter() {
  const { connected } = useSirenWallet();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (connected) router.replace("/");
  }, [connected, router]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      <button
        type="button"
        onClick={() => {
          hapticLight();
          setModalOpen(true);
        }}
        className="w-full px-8 py-4 rounded-xl font-heading font-semibold text-sm uppercase tracking-[0.12em] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
      >
        Connect wallet
      </button>
      <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
        Phantom, Solflare, Backpack, or Torus
      </p>
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

export default function OnboardingPage() {
  const { connected } = useSirenWallet();
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (connected) {
      try {
        localStorage.setItem("siren-onboarding-complete", "true");
      } catch {}
      router.replace("/");
    }
  }, [connected, router]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-void)" }}
    >
      <TopBar />
      <main className="flex-1 flex flex-col items-center px-4 py-12 md:py-16">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-2xl text-center mb-12"
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{
              background: "var(--accent-dim)",
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              boxShadow: "0 0 32px color-mix(in srgb, var(--accent) 12%, transparent)",
            }}
          >
            <Sparkles className="w-8 h-8" style={{ color: "var(--accent)" }} />
          </div>
          <h1
            className="font-heading font-bold text-3xl md:text-4xl md:text-5xl mb-4 tracking-tight"
            style={{ color: "var(--text-1)", lineHeight: 1.15 }}
          >
            Event-driven meme token terminal
          </h1>
          <p
            className="font-body text-base md:text-lg max-w-xl mx-auto mb-2"
            style={{ color: "var(--text-2)", lineHeight: 1.6 }}
          >
            Watch Kalshi prediction markets in real time. Surface Bags tokens tied to those events. Trade both from one terminal.
          </p>
          <p
            className="font-body text-sm"
            style={{ color: "var(--text-3)" }}
          >
            Solana · DFlow · Jupiter · Bags
          </p>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full max-w-xl mb-14"
        >
          <div
            className="rounded-2xl border p-8 md:p-10"
            style={{
              borderColor: "var(--border-subtle)",
              background: "linear-gradient(165deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
              boxShadow: "0 1px 0 0 var(--border-subtle), 0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <p
              className="font-body text-xs uppercase tracking-wider mb-6"
              style={{ color: "var(--accent)" }}
            >
              Get started
            </p>
            {PRIVY_APP_ID ? <OnboardingWithBoth /> : <OnboardingWithAdapter />}
            <Link
              href="/"
              onClick={() => hapticLight()}
              className="mt-6 inline-flex items-center gap-2 font-body text-sm font-medium"
              style={{ color: "var(--text-3)" }}
            >
              Skip to terminal
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </motion.section>

        {/* Feature cards */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="w-full max-w-4xl"
        >
          <h2
            className="font-heading font-semibold text-sm uppercase tracking-wider mb-6 text-center"
            style={{ color: "var(--text-3)" }}
          >
            What you can do
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.slice(0, showMore ? undefined : 3).map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 + i * 0.05 }}
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
                <p
                  className="font-heading font-semibold text-sm mb-1.5"
                  style={{ color: "var(--text-1)" }}
                >
                  {f.title}
                </p>
                <p
                  className="font-body text-xs leading-relaxed"
                  style={{ color: "var(--text-2)" }}
                >
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
              className="mt-4 w-full py-2.5 rounded-xl font-body text-xs font-medium flex items-center justify-center gap-1"
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

        {/* Docs link */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-14 text-center"
        >
          <a
            href="https://docs.onsiren.xyz"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticLight()}
            className="font-body text-xs underline"
            style={{ color: "var(--text-3)" }}
          >
            Read the docs →
          </a>
        </motion.section>
      </main>
    </div>
  );
}

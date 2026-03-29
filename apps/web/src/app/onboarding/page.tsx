"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { TopBar } from "@/components/TopBar";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Loader2,
  Rocket,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { hapticLight } from "@/lib/haptics";
import { motion } from "framer-motion";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

const FEATURES = [
  {
    icon: BarChart3,
    title: "Dual signal rail",
    description:
      "Track Kalshi and Polymarket in parallel, then rank the sharpest probability moves in one live Siren feed.",
  },
  {
    icon: Zap,
    title: "Instant token matching",
    description:
      "Surface Solana meme tokens from event language automatically through DexScreener and Siren's keyword mapping layer.",
  },
  {
    icon: TrendingUp,
    title: "Single execution surface",
    description:
      "React to a signal, inspect the linked tokens, and move into Jupiter execution without tab-hopping across tools.",
  },
  {
    icon: Rocket,
    title: "Privy embedded wallets",
    description:
      "Social login creates Siren-managed Solana and EVM wallets automatically, so users can onboard without extensions.",
  },
  {
    icon: Shield,
    title: "Portfolio + launch loop",
    description:
      "Stay inside one account surface for balances, launches, positions, and the next narrative worth trading.",
  },
];

function PrivyAccessCard() {
  const { connected, authenticated, isReady } = useSirenWallet();
  const { login, ready } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (connected) router.replace("/");
  }, [connected, router]);

  const provisioning = authenticated && !connected;
  const canOpenPrivy = Boolean(PRIVY_APP_ID) && ready && !provisioning;

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        className="rounded-2xl border p-6"
        style={{
          borderColor: "var(--border-subtle)",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 92%, transparent), var(--bg-elevated))",
        }}
      >
        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
          Social access
        </p>
        <h2 className="mt-3 font-heading text-2xl font-bold" style={{ color: "var(--text-1)" }}>
          Sign in with Privy
        </h2>
        <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
          Continue with Google, GitHub, or X. Siren will create your Solana and EVM wallets automatically after login.
        </p>

        <button
          type="button"
          onClick={() => {
            if (!canOpenPrivy) return;
            hapticLight();
            login();
          }}
          disabled={!canOpenPrivy}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {provisioning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating wallets
            </>
          ) : PRIVY_APP_ID ? (
            ready ? "Open Privy" : "Loading Privy"
          ) : (
            "Privy not configured"
          )}
        </button>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {["Google", "GitHub", "X"].map((provider) => (
            <span
              key={provider}
              className="rounded-full border px-3 py-1 font-body text-[11px]"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-2)" }}
            >
              {provider}
            </span>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
            Embedded wallets provisioned on signup:
          </p>
          <p className="mt-1 font-body text-xs" style={{ color: "var(--text-2)" }}>
            Solana for trading, plus Base / Ethereum / Polygon for the broader Privy account rail.
          </p>
        </div>
      </div>

      <Link
        href="https://docs.onsiren.xyz"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => hapticLight()}
        className="inline-flex items-center gap-2 font-body text-sm"
        style={{ color: "var(--text-3)" }}
      >
        Read the docs
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>

      {!isReady && authenticated && (
        <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
          Finalizing your Siren wallets before terminal access.
        </p>
      )}
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
      } catch {
        /* ignore localStorage availability */
      }
      router.replace("/");
    }
  }, [connected, router]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 px-4 py-12 md:py-16">
        <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.1fr)_420px]">
          <div>
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <img src="/brand/logo.svg" alt="Siren" className="h-10 w-auto md:h-12" />
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                <p className="font-body text-xs" style={{ color: "var(--text-3)" }}>
                  Kalshi + Polymarket signals · Solana execution · Privy onboarding
                </p>
              </div>
              <h1
                className="mt-6 font-heading text-4xl font-bold tracking-tight md:text-5xl"
                style={{ color: "var(--text-1)", lineHeight: 1.06 }}
              >
                Event-driven meme token trading terminal
              </h1>
              <p
                className="mt-5 max-w-2xl font-body text-base leading-relaxed md:text-lg"
                style={{ color: "var(--text-2)" }}
              >
                Siren watches prediction market moves, maps them to live Solana meme tokens, and keeps the trading flow clean.
                Kalshi and Polymarket now run in parallel through the same terminal.
              </p>
            </motion.section>

            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className="mt-10"
            >
              <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                What Siren does
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {FEATURES.slice(0, showMore ? undefined : 4).map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.18 + index * 0.05 }}
                    className="rounded-2xl border p-5"
                    style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-2xl"
                      style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                    >
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                      {feature.title}
                    </p>
                    <p className="mt-2 font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                      {feature.description}
                    </p>
                  </motion.div>
                ))}
              </div>
              {!showMore && FEATURES.length > 4 && (
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setShowMore(true);
                  }}
                  className="mt-4 rounded-xl border px-4 py-2.5 font-body text-xs font-medium"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-2)" }}
                >
                  Show {FEATURES.length - 4} more
                </button>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.28 }}
              className="mt-10 grid gap-3 md:grid-cols-3"
            >
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <p className="font-heading text-xs" style={{ color: "var(--text-1)" }}>Signal sources</p>
                <p className="mt-2 font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                  Kalshi and Polymarket are labeled separately, then ranked in one live feed by move size.
                </p>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <p className="font-heading text-xs" style={{ color: "var(--text-1)" }}>Wallet rail</p>
                <p className="mt-2 font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                  Privy social auth creates the Solana and EVM wallets Siren needs without asking users to bring one first.
                </p>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <p className="font-heading text-xs" style={{ color: "var(--text-1)" }}>Execution</p>
                <p className="mt-2 font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                  Token discovery stays on Solana so users can move directly into Jupiter routing from the same narrative.
                </p>
              </div>
            </motion.section>
          </div>

          <motion.aside
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:sticky lg:top-20"
          >
            <PrivyAccessCard />
          </motion.aside>
        </div>
      </main>
    </div>
  );
}

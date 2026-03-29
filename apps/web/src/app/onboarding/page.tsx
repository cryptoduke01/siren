"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Globe2,
  Loader2,
  Rocket,
  Shield,
  Sparkles,
  TrendingUp,
  Wallet2,
  Zap,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { hapticLight } from "@/lib/haptics";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

const SIGNAL_STACK = [
  { label: "KALSHI", tone: "var(--kalshi)" },
  { label: "POLYMARKET", tone: "var(--polymarket)" },
  { label: "DEX MATCHING", tone: "var(--accent)" },
  { label: "JUPITER FLOW", tone: "var(--text-1)" },
];

const HERO_STATS = [
  { value: "02", label: "prediction venues running live" },
  { value: "SOL", label: "execution stays on one fast rail" },
  { value: "EVM", label: "Base, Ethereum, Polygon wallets provisioned" },
];

const PIPELINE_STEPS: Array<{
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
}> = [
  {
    icon: BarChart3,
    eyebrow: "Source",
    title: "Narratives move in prediction markets first",
    description:
      "Siren watches Kalshi and Polymarket in parallel, tags which venue moved, and ranks the sharpest shifts before they flatten out.",
    accent: "var(--kalshi)",
  },
  {
    icon: Zap,
    eyebrow: "Match",
    title: "Event language becomes token context",
    description:
      "Question text is turned into live keyword rails, DexScreener candidates, and signal-linked token surfaces without leaving the terminal.",
    accent: "var(--accent)",
  },
  {
    icon: TrendingUp,
    eyebrow: "Trade",
    title: "Execution lands in one clean flow",
    description:
      "Once the narrative is hot, Siren keeps the next step obvious: inspect matched tokens, route on Jupiter, and stay inside the same interface.",
    accent: "var(--polymarket)",
  },
];

const FEATURE_CARDS: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}> = [
  {
    icon: Sparkles,
    title: "A terminal built around narrative velocity",
    description:
      "Not another wallet-first landing page. Siren is designed around signals, context, and speed, so the first thing you feel is momentum.",
    accent: "var(--accent)",
  },
  {
    icon: Wallet2,
    title: "Social-only access, no wallet ceremony",
    description:
      "Google, GitHub, or X gets a trader in instantly. Privy handles the wallet layer after login, so onboarding feels like entering software, not setting up plumbing.",
    accent: "var(--text-1)",
  },
  {
    icon: Globe2,
    title: "Solana-native execution with a broader account rail",
    description:
      "Siren keeps trading focused on Solana while still minting Base, Ethereum, and Polygon wallets behind the same Privy identity.",
    accent: "var(--polymarket)",
  },
  {
    icon: Shield,
    title: "One screen, lower friction, clearer intent",
    description:
      "Signal source badges, shared ranking logic, and embedded wallets reduce the noise between seeing a move and acting on it.",
    accent: "var(--kalshi)",
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
    <div className="relative overflow-hidden rounded-[32px] border p-6 md:p-7" style={{ borderColor: "var(--border-default)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 95%, transparent), color-mix(in srgb, var(--bg-surface) 92%, transparent))" }}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, transparent), transparent 78%), radial-gradient(circle at top right, color-mix(in srgb, var(--polymarket) 18%, transparent), transparent 46%)",
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-body text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--accent)" }}>
              Mission Access
            </p>
            <h2 className="mt-3 max-w-sm font-heading text-[2rem] font-semibold leading-[0.95]" style={{ color: "var(--text-1)" }}>
              Enter Siren through a social rail, not a wallet maze.
            </h2>
          </div>
          <div
            className="rounded-full border px-3 py-1 font-body text-[11px]"
            style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", color: "var(--text-2)" }}
          >
            Privy embedded
          </div>
        </div>

        <p className="mt-4 max-w-md font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
          Continue with Google, GitHub, or X. Siren provisions the Solana wallet for execution and the EVM wallet set for the wider account rail after login.
        </p>

        <div className="mt-6 rounded-[24px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-surface) 94%, transparent)" }}>
          <div className="flex flex-wrap gap-2">
            {["Google", "GitHub", "X"].map((provider) => (
              <span
                key={provider}
                className="rounded-full border px-3 py-1 font-body text-[11px]"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
              >
                {provider}
              </span>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-void)" }}>
              <p className="font-body text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
                Solana
              </p>
              <p className="mt-2 font-heading text-sm" style={{ color: "var(--text-1)" }}>
                Primary execution wallet
              </p>
            </div>
            <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-void)" }}>
              <p className="font-body text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
                EVM rail
              </p>
              <p className="mt-2 font-heading text-sm" style={{ color: "var(--text-1)" }}>
                Base, Ethereum, Polygon
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!canOpenPrivy) return;
            hapticLight();
            login();
          }}
          disabled={!canOpenPrivy}
          className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-heading text-sm font-semibold uppercase tracking-[0.16em] transition-transform duration-200 hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "linear-gradient(90deg, color-mix(in srgb, var(--accent) 92%, white 8%), var(--accent))",
            color: "var(--accent-text)",
            boxShadow: "0 18px 48px color-mix(in srgb, var(--accent) 18%, transparent)",
          }}
        >
          {provisioning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Provisioning Wallets
            </>
          ) : PRIVY_APP_ID ? (
            ready ? "Open Privy" : "Loading Privy"
          ) : (
            "Privy not configured"
          )}
        </button>

        <div className="mt-6 rounded-[24px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-void) 88%, transparent), color-mix(in srgb, var(--bg-surface) 86%, transparent))" }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <p className="font-body text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
              Access flow
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {[
              "Choose Google, GitHub, or X",
              "Privy creates your Siren wallet set",
              "Land in the terminal ready to trade",
            ].map((item, index) => (
              <div key={item} className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-body text-[10px]"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
                >
                  0{index + 1}
                </div>
                <p className="font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
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
            <p className="text-right font-body text-[11px]" style={{ color: "var(--text-3)" }}>
              Finalizing Siren wallet access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const { connected } = useSirenWallet();
  const router = useRouter();

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
    <div className="flex min-h-screen flex-col overflow-hidden" style={{ background: "var(--bg-void)" }}>
      <TopBar />

      <main className="relative flex-1 px-4 py-8 md:px-6 md:py-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-[-8%] top-16 h-72 w-72 rounded-full blur-3xl"
            style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)" }}
          />
          <div
            className="absolute right-[-4%] top-28 h-80 w-80 rounded-full blur-3xl"
            style={{ background: "color-mix(in srgb, var(--polymarket) 14%, transparent)" }}
          />
          <div
            className="absolute bottom-[-8%] left-[20%] h-72 w-72 rounded-full blur-3xl"
            style={{ background: "color-mix(in srgb, var(--kalshi) 12%, transparent)" }}
          />
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.1fr)_420px] xl:gap-12">
          <div className="space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="relative overflow-hidden rounded-[34px] border p-6 md:p-8"
              style={{
                borderColor: "var(--border-default)",
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--bg-surface) 95%, transparent), color-mix(in srgb, var(--bg-elevated) 92%, transparent))",
              }}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-40"
                style={{
                  background:
                    "linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%), radial-gradient(circle at top right, color-mix(in srgb, var(--polymarket) 14%, transparent), transparent 48%)",
                }}
              />

              <div className="relative">
                <img src="/brand/logo.svg" alt="Siren" className="h-10 w-auto md:h-12" />

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-void) 76%, transparent)" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                    <p className="font-body text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                      Signal cockpit
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-void) 76%, transparent)" }}>
                    <Rocket className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                    <p className="font-body text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                      Privy-powered entry
                    </p>
                  </div>
                </div>

                <h1
                  className="mt-8 max-w-4xl font-heading text-[clamp(3.3rem,8vw,6.2rem)] font-semibold tracking-[-0.05em]"
                  style={{ color: "var(--text-1)", lineHeight: 0.9 }}
                >
                  Trade the narrative before the chart catches up.
                </h1>

                <p
                  className="mt-6 max-w-3xl font-body text-base leading-relaxed md:text-[1.15rem]"
                  style={{ color: "var(--text-2)" }}
                >
                  Siren watches event markets for meaningful movement, maps those shifts to live Solana meme tokens, and keeps the path from signal to execution brutally short.
                  Kalshi and Polymarket now run together inside the same terminal.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  {SIGNAL_STACK.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-full border px-4 py-2 font-body text-[11px] uppercase tracking-[0.18em]"
                      style={{
                        borderColor: "color-mix(in srgb, var(--border-default) 78%, transparent)",
                        background: "color-mix(in srgb, var(--bg-void) 80%, transparent)",
                        color: item.tone,
                      }}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {HERO_STATS.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[24px] border p-4"
                      style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-void) 84%, transparent)" }}
                    >
                      <p className="font-heading text-2xl font-semibold" style={{ color: "var(--text-1)" }}>
                        {item.value}
                      </p>
                      <p className="mt-2 max-w-[16rem] font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]"
            >
              <div
                className="rounded-[32px] border p-6 md:p-7"
                style={{
                  borderColor: "var(--border-default)",
                  background:
                    "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 94%, transparent), color-mix(in srgb, var(--bg-elevated) 92%, transparent))",
                }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  <p className="font-body text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-3)" }}>
                    Signal Flow
                  </p>
                </div>
                <h2 className="mt-4 max-w-2xl font-heading text-3xl font-semibold leading-tight" style={{ color: "var(--text-1)" }}>
                  One story, three moves: detect, map, execute.
                </h2>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {PIPELINE_STEPS.map((step, index) => (
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, delay: 0.14 + index * 0.06 }}
                      className="rounded-[26px] border p-5"
                      style={{
                        borderColor: "var(--border-subtle)",
                        background: "color-mix(in srgb, var(--bg-void) 76%, transparent)",
                      }}
                    >
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-2xl"
                        style={{
                          background: `color-mix(in srgb, ${step.accent} 18%, transparent)`,
                          color: step.accent,
                        }}
                      >
                        <step.icon className="h-5 w-5" />
                      </div>
                      <p className="mt-4 font-body text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
                        {step.eyebrow}
                      </p>
                      <p className="mt-2 font-heading text-lg leading-tight" style={{ color: "var(--text-1)" }}>
                        {step.title}
                      </p>
                      <p className="mt-3 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                        {step.description}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div
                className="rounded-[32px] border p-6 md:p-7"
                style={{
                  borderColor: "var(--border-default)",
                  background:
                    "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 92%, transparent), color-mix(in srgb, var(--bg-void) 88%, transparent))",
                }}
              >
                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-3)" }}>
                  What changes now
                </p>
                <div className="mt-5 space-y-4">
                  {[
                    {
                      title: "Both venues run at once",
                      body: "Kalshi stays intact. Polymarket joins the exact same signal pipeline, feed, token matching path, and execution surface.",
                    },
                    {
                      title: "Wallet creation happens after intent",
                      body: "Users choose a social identity first. Siren creates the wallet layer afterwards, which feels lighter and faster than asking for extensions up front.",
                    },
                    {
                      title: "The interface stays source-aware",
                      body: "Signals stay blended in one live stream, but every move still carries its badge, venue health, and source context.",
                    },
                  ].map((item, index) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.22 + index * 0.07 }}
                      className="rounded-[24px] border p-4"
                      style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-surface) 88%, transparent)" }}
                    >
                      <p className="font-heading text-base" style={{ color: "var(--text-1)" }}>
                        {item.title}
                      </p>
                      <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                        {item.body}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.16 }}
              className="grid gap-4 md:grid-cols-2"
            >
              {FEATURE_CARDS.map((card, index) => (
                <div
                  key={card.title}
                  className={`rounded-[28px] border p-6 ${index === 0 ? "md:col-span-2" : ""}`}
                  style={{
                    borderColor: "var(--border-default)",
                    background:
                      index === 0
                        ? "linear-gradient(135deg, color-mix(in srgb, var(--bg-surface) 92%, transparent), color-mix(in srgb, var(--bg-elevated) 88%, transparent))"
                        : "color-mix(in srgb, var(--bg-surface) 94%, transparent)",
                  }}
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{
                      background: `color-mix(in srgb, ${card.accent} 16%, transparent)`,
                      color: card.accent,
                    }}
                  >
                    <card.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 max-w-xl font-heading text-xl leading-tight" style={{ color: "var(--text-1)" }}>
                    {card.title}
                  </p>
                  <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                    {card.description}
                  </p>
                </div>
              ))}
            </motion.section>
          </div>

          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="lg:sticky lg:top-20 lg:self-start"
          >
            <PrivyAccessCard />
          </motion.aside>
        </div>
      </main>
    </div>
  );
}

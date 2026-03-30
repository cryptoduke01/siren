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
  { label: "TOKEN MATCH", tone: "var(--accent)" },
  { label: "JUPITER", tone: "var(--text-1)" },
];

const HERO_STATS = [
  { value: "02", label: "live market sources" },
  { value: "SOL", label: "built-in Solana trading wallet" },
  { value: "BASE", label: "Base, Ethereum, and Polygon address ready" },
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
    title: "See the move first",
    description:
      "Siren watches Kalshi and Polymarket at the same time and highlights the biggest moves first.",
    accent: "var(--kalshi)",
  },
  {
    icon: Zap,
    eyebrow: "Match",
    title: "Find the tokens that fit",
    description:
      "Each market question is turned into token ideas so you can move from the event to the trade without leaving the page.",
    accent: "var(--accent)",
  },
  {
    icon: TrendingUp,
    eyebrow: "Trade",
    title: "Act from one screen",
    description:
      "When something starts moving, Siren keeps the next step simple: review the token list, trade, and keep your place.",
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
    title: "Built for speed, not setup screens",
    description:
      "You land in the product fast, see what is moving, and get straight to the parts that matter.",
    accent: "var(--accent)",
  },
  {
    icon: Wallet2,
    title: "Log in with social, get wallets automatically",
    description:
      "Use Google, GitHub, or X. Siren creates the wallets for you after login, so there is nothing extra to install first.",
    accent: "var(--text-1)",
  },
  {
    icon: Globe2,
    title: "Trade on Solana, keep a Base address ready",
    description:
      "Siren keeps the trading flow on Solana while also giving you a Base, Ethereum, and Polygon address under the same account.",
    accent: "var(--polymarket)",
  },
  {
    icon: Shield,
    title: "Clear source labels and fewer clicks",
    description:
      "Every market clearly shows where it came from, and the path from signal to action stays short.",
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
              Log in
            </p>
            <h2 className="mt-3 max-w-sm font-heading text-[2rem] font-semibold leading-[0.95]" style={{ color: "var(--text-1)" }}>
              Log in fast. Siren builds the wallets for you.
            </h2>
          </div>
          <div
            className="rounded-full border px-3 py-1 font-body text-[11px]"
            style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", color: "var(--text-2)" }}
          >
            Social login
          </div>
        </div>

        <p className="mt-4 max-w-md font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
          Continue with Google, GitHub, or X. After login, Siren creates your built-in Solana wallet and your Base-compatible EVM wallet automatically.
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
                Base + EVM
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
              Getting wallets ready
            </>
          ) : PRIVY_APP_ID ? (
            ready ? "Log in" : "Loading login"
          ) : (
            "Login unavailable"
          )}
        </button>

        <div className="mt-6 rounded-[24px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-void) 88%, transparent), color-mix(in srgb, var(--bg-surface) 86%, transparent))" }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <p className="font-body text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
              How it works
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {[
              "Choose Google, GitHub, or X",
              "Siren creates your wallets for you",
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
              Finishing your wallet setup.
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

      <main className="relative flex-1 px-4 py-4 md:px-6 md:py-10">
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

        <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_420px] xl:gap-12">
          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="order-1 lg:sticky lg:top-20 lg:order-2 lg:self-start"
          >
            <PrivyAccessCard />
          </motion.aside>

          <div className="order-2 space-y-5 lg:order-1 lg:space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="relative overflow-hidden rounded-[28px] border p-5 md:rounded-[34px] md:p-8"
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
                      Live markets
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-void) 76%, transparent)" }}>
                    <Rocket className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                    <p className="font-body text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                      Social login
                    </p>
                  </div>
                </div>

                <h1
                  className="mt-6 max-w-4xl font-heading text-[clamp(2.6rem,8vw,5.8rem)] font-semibold tracking-[-0.05em]"
                  style={{ color: "var(--text-1)", lineHeight: 0.9 }}
                >
                  See the move.
                  <br />
                  Find the token.
                  <br />
                  Trade faster.
                </h1>

                <p
                  className="mt-4 max-w-3xl font-body text-sm leading-relaxed md:mt-6 md:text-[1.1rem]"
                  style={{ color: "var(--text-2)" }}
                >
                  Siren watches Kalshi and Polymarket, turns those moves into token ideas, and keeps the path from signal to trade short and simple.
                </p>

                <div className="mt-6 flex flex-wrap gap-2 md:mt-8 md:gap-3">
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

                <div className="mt-6 grid gap-3 sm:grid-cols-3 md:mt-8">
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
              className="hidden gap-6 xl:grid xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]"
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
                    How Siren works
                  </p>
                </div>
                <h2 className="mt-4 max-w-2xl font-heading text-3xl font-semibold leading-tight" style={{ color: "var(--text-1)" }}>
                  See what moved, understand it, then act.
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
                  What you get
                </p>
                <div className="mt-5 space-y-4">
                  {[
                    {
                      title: "Both sources in one feed",
                      body: "Kalshi and Polymarket show up together, and every card tells you which one moved.",
                    },
                    {
                      title: "Login first, wallets second",
                      body: "You choose Google, GitHub, or X first. Siren creates the wallets after that, so the start feels fast.",
                    },
                    {
                      title: "Clear labels everywhere",
                      body: "You can always see which market moved, which tokens match it, and what to do next.",
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
              className="hidden gap-4 md:grid md:grid-cols-2"
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

        </div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight, Eye, Layers3, ShieldAlert, Sun, Moon, Radar, Wallet2, LineChart, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useThemeStore } from "@/store/useThemeStore";
import { hapticLight } from "@/lib/haptics";

function LandingHeader() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ borderColor: "color-mix(in srgb, var(--border-subtle) 70%, transparent)", background: "color-mix(in srgb, var(--bg-base) 84%, transparent)" }}>
      <div className="mx-auto flex w-full max-w-[1220px] items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/" onClick={() => hapticLight()} className="flex items-center gap-3">
          <img src="/brand/logo.svg" alt="Siren" className="h-8 w-auto" style={{ filter: theme === "light" ? "brightness(0.08)" : "none" }} />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {[
            { href: "#why", label: "Why Siren" },
            { href: "#product", label: "Product" },
            { href: "#venues", label: "Venues" },
            { href: "/terminal", label: "Terminal" },
          ].map((item) =>
            item.href.startsWith("#") ? (
              <a
                key={item.label}
                href={item.href}
                onClick={() => hapticLight()}
                className="font-body text-sm font-medium transition-colors"
                style={{ color: "var(--text-2)" }}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => hapticLight()}
                className="font-body text-sm font-medium transition-colors"
                style={{ color: "var(--text-2)" }}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              toggleTheme();
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)", background: "var(--bg-surface)" }}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            href="/onboarding"
            onClick={() => hapticLight()}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl px-4 font-heading text-xs font-semibold uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            Sign Up
          </Link>
        </div>
      </div>
    </header>
  );
}

function ProofPanel() {
  return (
    <div
      className="rounded-[32px] border p-4 md:p-5"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 95%, transparent), color-mix(in srgb, var(--bg-base) 100%, transparent))",
        boxShadow: "0 42px 120px -72px rgba(0,0,0,0.7)",
      }}
    >
      <div
        className="rounded-[24px] border p-4 md:p-5"
        style={{
          borderColor: "var(--border-subtle)",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, var(--bg-surface)), var(--bg-base))",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-body text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
              Execution Briefing
            </p>
            <h3 className="mt-2 font-heading text-xl font-semibold tracking-[-0.05em]" style={{ color: "var(--text-1)" }}>
              Will Gavin Newsom win the 2028 Democratic nomination?
            </h3>
          </div>
          <span
            className="rounded-full px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ background: "color-mix(in srgb, var(--up) 12%, transparent)", color: "var(--up)" }}
          >
            Route Live
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["Route Confidence", "Good", "A clean route exists, but size should stay disciplined."],
            ["Suggested Clip", "$25", "Start smaller and layer only if the route stays healthy."],
            ["Resolution Risk", "Watch", "Liquidity can thin sharply into the final window."],
            ["Likely Failure Mode", "Thin Depth", "If it fails, try again later or reduce size."],
          ].map(([label, value, body]) => (
            <div
              key={label}
              className="rounded-[18px] border p-4"
              style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-surface) 86%, transparent)" }}
            >
              <p className="font-body text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--text-3)" }}>
                {label}
              </p>
              <p className="mt-2 font-heading text-lg font-semibold" style={{ color: "var(--text-1)" }}>
                {value}
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ["Execution Before Entry", "Know whether the trade clears before you click."],
          ["Clear Failure Reasons", "Get actionable explanations instead of cryptic route errors."],
          ["Portfolio Context", "See how size, concentration, and resolution risk fit together."],
        ].map(([title, body]) => (
          <div
            key={title}
            className="rounded-[20px] border p-4"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
          >
            <p className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
              {title}
            </p>
            <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              {body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-[24px] border p-5 md:p-6"
      style={{
        borderColor: "var(--border-subtle)",
        background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, transparent), color-mix(in srgb, var(--bg-base) 96%, transparent))",
      }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 font-heading text-xl font-semibold tracking-[-0.04em]" style={{ color: "var(--text-1)" }}>
        {title}
      </h3>
      <p className="mt-3 font-body text-sm leading-relaxed md:text-base" style={{ color: "var(--text-2)" }}>
        {body}
      </p>
    </div>
  );
}

export function PublicLandingPage() {
  const { theme } = useThemeStore();

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "radial-gradient(circle at top, color-mix(in srgb, var(--accent) 9%, transparent), transparent 28%), var(--bg-void)" }}>
      <LandingHeader />

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-[1220px] gap-12 px-4 pb-10 pt-12 md:px-6 md:pb-14 md:pt-16 lg:grid-cols-[minmax(0,1.02fr)_minmax(430px,0.98fr)] lg:items-center lg:gap-14">
          <div className="max-w-2xl">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
              Execution And Risk Intelligence
            </p>
            <h1
              className="mt-4 font-heading font-bold tracking-[-0.065em]"
              style={{ color: "var(--text-1)", fontSize: "clamp(3rem, 8vw, 6.4rem)", lineHeight: 0.92 }}
            >
              Trade Prediction Markets With Execution Clarity.
            </h1>
            <p className="mt-6 max-w-xl font-body text-base leading-relaxed md:text-lg" style={{ color: "var(--text-2)" }}>
              Siren helps traders understand whether a market is actually tradeable, how risky the route is, and what to do next before size goes in. Browse first. Sign up only when Siren has earned it.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/terminal"
                onClick={() => hapticLight()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                Open Terminal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/onboarding"
                onClick={() => hapticLight()}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--bg-hover)]"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)", background: "var(--bg-surface)" }}
              >
                Sign Up To Trade
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ["Kalshi + Polymarket", "Live books from the venues traders actually watch."],
                ["Execution Signals", "Route quality, sizing guidance, and realistic failure context."],
                ["Portfolio Awareness", "Concentration, resolution timing, and post-trade clarity."],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-[22px] border p-4"
                  style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-surface) 96%, transparent)" }}
                >
                  <p className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                    {title}
                  </p>
                  <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:justify-self-end">
            <ProofPanel />
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1220px] px-4 pb-8 md:px-6">
          <div
            className="rounded-[30px] border p-6 md:p-8"
            style={{
              borderColor: "var(--border-subtle)",
              background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 96%, transparent), color-mix(in srgb, var(--bg-base) 94%, transparent))",
            }}
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(330px,0.72fr)] lg:items-center">
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                  See Siren Before You Sign Up
                </p>
                <h2 className="mt-3 font-heading text-[clamp(2rem,4vw,3.3rem)] font-bold tracking-[-0.055em]" style={{ color: "var(--text-1)", lineHeight: 0.95 }}>
                  Browse First.
                  <br />
                  Sign Up When It Matters.
                </h2>
                <p className="mt-4 max-w-2xl font-body text-base leading-relaxed md:text-lg" style={{ color: "var(--text-2)" }}>
                  Open the terminal without handing over your details. Create your Siren account only when you want synced portfolio history, execution tracking, and wallet-aware trading actions.
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  ["Live Market Browser", "Browse current prediction books without crossing a sign-up wall."],
                  ["Execution Context", "See route quality, suggested sizing, and failure risk before you commit."],
                  ["Account Layer Later", "Sign up only when you want tracking, synced history, and portfolio tools."],
                ].map(([title, body]) => (
                  <div
                    key={title}
                    className="rounded-[22px] border p-4"
                    style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
                        style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                          {title}
                        </p>
                        <p className="mt-1.5 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                          {body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="why" className="mx-auto w-full max-w-[1220px] px-4 py-8 md:px-6 md:py-10">
          <div className="max-w-2xl">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
              Why Siren Exists
            </p>
            <h2 className="mt-3 font-heading text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.055em]" style={{ color: "var(--text-1)", lineHeight: 0.96 }}>
              Venues show the market.
              <br />
              Siren shows whether the trade makes sense.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <SectionCard
              icon={Eye}
              title="Execution Feasibility"
              body="See whether a route is live, thin, or likely to fail before you burn time, confidence, or gas trying to force it."
            />
            <SectionCard
              icon={ShieldAlert}
              title="Risk Guardrails"
              body="Surface concentration, resolution-window risk, and route fragility in plain language traders can actually act on."
            />
            <SectionCard
              icon={Layers3}
              title="Post-Trade Clarity"
              body="When a trade fills, fails, or only partially clears, Siren explains what happened so you can size better the next time."
            />
          </div>
        </section>

        <section id="product" className="mx-auto w-full max-w-[1220px] px-4 py-8 md:px-6 md:py-12">
          <div
            className="rounded-[34px] border p-6 md:p-8"
            style={{ borderColor: "var(--border-subtle)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, transparent), var(--bg-base))" }}
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                  What Siren Adds
                </p>
                <h2 className="mt-3 font-heading text-[clamp(1.9rem,4vw,2.9rem)] font-bold tracking-[-0.05em]" style={{ color: "var(--text-1)", lineHeight: 0.98 }}>
                  The layer between a market idea and a real execution decision.
                </h2>
                <p className="mt-4 max-w-xl font-body text-sm leading-relaxed md:text-base" style={{ color: "var(--text-2)" }}>
                  Siren does not replace Kalshi or Polymarket. It sits above them and answers the questions traders actually ask before and after a trade.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: "Before The Trade",
                    title: "Feasibility Read",
                    body: "Route confidence, thin-book risk, and a suggested starting size before you click.",
                  },
                  {
                    label: "At The Click",
                    title: "Route Explanation",
                    body: "If a path fails, Siren turns the error into something specific and actionable.",
                  },
                  {
                    label: "After The Attempt",
                    title: "Execution Report",
                    body: "Attempted, advised, filled, and failed are tied together so traders actually learn.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[22px] border p-5"
                    style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                  >
                    <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
                      {item.label}
                    </p>
                    <h3 className="mt-3 font-heading text-lg font-semibold tracking-[-0.04em]" style={{ color: "var(--text-1)" }}>
                      {item.title}
                    </h3>
                    <p className="mt-3 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="venues" className="mx-auto w-full max-w-[1220px] px-4 py-8 md:px-6 md:py-10">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
            <div
              className="rounded-[28px] border p-6"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <p className="font-body text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                Built Above Venues
              </p>
              <h2 className="mt-3 font-heading text-[clamp(1.8rem,4vw,2.8rem)] font-bold tracking-[-0.05em]" style={{ color: "var(--text-1)", lineHeight: 0.98 }}>
                Venues provide the book.
                <br />
                Siren provides the judgment.
              </h2>
              <p className="mt-4 font-body text-sm leading-relaxed md:text-base" style={{ color: "var(--text-2)" }}>
                Keep the venue open if you want. Siren’s job is to tell you what looks executable, what looks dangerous, and what the route is likely to do under stress.
              </p>
            </div>

            <div
              className="rounded-[28px] border p-5 md:p-6"
              style={{ borderColor: "var(--border-subtle)", background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, transparent), var(--bg-base))" }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["Venue Shows", "Price, event title, and the current book."],
                  ["Siren Adds", "Route confidence, sizing hints, resolution pressure, and failure reasons."],
                  ["Venue Strength", "Market ownership, settlement rules, and actual liquidity."],
                  ["Siren Strength", "Decision support before size goes in and after the attempt comes back."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[20px] border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                    <p className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                      {title}
                    </p>
                    <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1220px] px-4 pb-14 pt-8 md:px-6 md:pb-16 md:pt-10">
          <div
            className="rounded-[34px] border px-6 py-8 text-center md:px-10 md:py-10"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border-subtle))",
              background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, var(--bg-surface)), color-mix(in srgb, var(--bg-base) 98%, transparent))",
            }}
          >
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
              Browse First
            </p>
            <h2 className="mt-3 font-heading text-[clamp(2rem,5vw,3.3rem)] font-bold tracking-[-0.06em]" style={{ color: "var(--text-1)", lineHeight: 0.96 }}>
              See Siren before you hand over anything.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl font-body text-sm leading-relaxed md:text-base" style={{ color: "var(--text-2)" }}>
              Open the live terminal, inspect markets, and decide if the product earns your sign-up. When you are ready, Siren unlocks wallet-aware routing, portfolio sync, and execution tracking.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/terminal"
                onClick={() => hapticLight()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                Open Terminal
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/onboarding"
                onClick={() => hapticLight()}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--bg-hover)]"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)", background: "var(--bg-surface)" }}
              >
                Sign Up To Trade
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t" style={{ borderColor: "color-mix(in srgb, var(--border-subtle) 70%, transparent)", background: "var(--bg-base)" }}>
        <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <img src="/brand/mark.svg" alt="" className="h-6 w-auto" style={{ filter: theme === "light" ? "brightness(0.2)" : "none" }} />
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              Execution And Risk Intelligence For Prediction Markets.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: "var(--text-2)" }}>
            <Link href="/terminal" onClick={() => hapticLight()}>Terminal</Link>
            <Link href="/leaderboard" onClick={() => hapticLight()}>Ranks</Link>
            <a href="https://docs.onsiren.xyz" target="_blank" rel="noopener noreferrer" onClick={() => hapticLight()}>Docs</a>
            <Link href="/terms" onClick={() => hapticLight()}>Terms</Link>
            <Link href="/privacy" onClick={() => hapticLight()}>Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

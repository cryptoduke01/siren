"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  LineChart,
  Moon,
  Radar,
  ShieldAlert,
  Sun,
} from "lucide-react";
import { useThemeStore } from "@/store/useThemeStore";
import { hapticLight } from "@/lib/haptics";

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <img src="/brand/mark.svg" alt="" className={compact ? "h-7 w-7 flex-none" : "h-8 w-8 flex-none"} />
      <span
        className="font-heading font-semibold uppercase tracking-[-0.04em]"
        style={{
          color: "var(--text-1)",
          fontSize: compact ? "1.55rem" : "1.8rem",
          lineHeight: 1,
        }}
      >
        Siren
      </span>
    </span>
  );
}

function LandingHeader() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-xl"
      style={{
        borderColor: "color-mix(in srgb, var(--border-subtle) 70%, transparent)",
        background: "color-mix(in srgb, var(--bg-base) 84%, transparent)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/" onClick={() => hapticLight()} className="flex items-center gap-3">
          <BrandLockup />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
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
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-2)",
              background: "var(--bg-surface)",
            }}
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

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-body text-[11px] font-semibold uppercase tracking-[0.3em]"
      style={{ color: "color-mix(in srgb, var(--text-3) 90%, transparent)" }}
    >
      {children}
    </p>
  );
}

function ProofPanel() {
  return (
    <div
      className="w-full max-w-[620px] rounded-[28px] border p-4"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 95%, transparent), color-mix(in srgb, var(--bg-base) 100%, transparent))",
        boxShadow: "0 32px 84px -64px rgba(0,0,0,0.55)",
      }}
    >
      <div
        className="rounded-[24px] border p-5"
        style={{
          borderColor: "var(--border-subtle)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, var(--bg-surface)), var(--bg-base))",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="max-w-[28rem]">
            <SectionEyebrow>Execution Briefing</SectionEyebrow>
            <h3
              className="mt-3 max-w-[18ch] font-heading text-[1.32rem] font-bold tracking-[-0.035em] md:text-[1.48rem]"
              style={{ color: "var(--text-1)", lineHeight: 1.12 }}
            >
              Will Gavin Newsom win the 2028 Democratic nomination?
            </h3>
          </div>
          <span
            className="rounded-full px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{
              background: "color-mix(in srgb, var(--up) 12%, transparent)",
              color: "var(--up)",
            }}
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
              style={{
                borderColor: "var(--border-default)",
                background: "color-mix(in srgb, var(--bg-surface) 88%, transparent)",
              }}
            >
              <p
                className="font-body text-[11px] font-semibold uppercase tracking-[0.24em]"
                style={{ color: "color-mix(in srgb, var(--text-3) 88%, transparent)" }}
              >
                {label}
              </p>
              <p
                className="mt-2.5 font-mono text-[1.55rem] font-semibold tabular-nums"
                style={{ color: "var(--text-1)" }}
              >
                {value}
              </p>
              <p
                className="mt-2.5 font-body text-[0.96rem] leading-[1.62]"
                style={{ color: "color-mix(in srgb, var(--text-1) 88%, var(--text-2))" }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-[22px] border p-7"
      style={{
        borderColor: "var(--border-default)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, transparent), color-mix(in srgb, var(--bg-base) 96%, transparent))",
      }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 font-body text-[1.2rem] font-semibold" style={{ color: "var(--text-1)" }}>
        {title}
      </h3>
      <p
        className="mt-3 font-body text-[1rem] leading-[1.72]"
        style={{ color: "color-mix(in srgb, var(--text-1) 90%, var(--text-2))" }}
      >
        {body}
      </p>
    </div>
  );
}

export function PublicLandingPage() {
  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{
        background:
          "radial-gradient(circle at top, color-mix(in srgb, var(--accent) 9%, transparent), transparent 28%), var(--bg-void)",
      }}
    >
      <LandingHeader />

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-[1200px] gap-12 px-4 pb-12 pt-12 md:px-6 md:pb-16 md:pt-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.82fr)] lg:items-center lg:gap-16">
          <div className="max-w-[31rem]">
            <SectionEyebrow>Execution And Risk Intelligence</SectionEyebrow>
            <h1
              className="mt-4 font-heading font-bold tracking-[-0.052em]"
              style={{
                color: "var(--text-1)",
                fontSize: "clamp(3rem, 6vw, 4.95rem)",
                lineHeight: 1.01,
                letterSpacing: "-0.045em",
              }}
            >
              Trade Prediction Markets
              <br />
              With Execution
              <br />
              Clarity
            </h1>
            <p
              className="mt-8 max-w-[29rem] font-body text-[1.08rem] leading-[1.82] md:text-[1.14rem]"
              style={{ color: "color-mix(in srgb, var(--text-1) 92%, var(--text-2))" }}
            >
              Siren tells traders whether a market looks executable, how fragile the route is, and what to do next before size goes in.
            </p>

            <div className="mt-9 flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/terminal"
                onClick={() => hapticLight()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
                style={{ background: "#00FF85", color: "#060609" }}
              >
                Open Terminal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://docs.onsiren.xyz"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => hapticLight()}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-1)",
                  background: "transparent",
                }}
              >
                Read Docs
              </a>
            </div>
          </div>

          <div className="lg:justify-self-end lg:self-center">
            <ProofPanel />
          </div>
        </section>

        <section id="why" className="mx-auto w-full max-w-[1240px] px-4 py-12 md:px-6 md:py-20">
          <div className="max-w-[44rem]">
            <SectionEyebrow>Why Siren Exists</SectionEyebrow>
            <h2
              className="mt-4 max-w-[42rem] font-heading font-bold tracking-[-0.038em]"
              style={{
                color: "var(--text-1)",
                fontSize: "clamp(2rem, 3.7vw, 2.9rem)",
                lineHeight: 1.08,
              }}
            >
              Venues show the market.
              <br />
              Siren shows whether the trade makes sense.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <FeatureCard
              icon={Radar}
              title="Execution Feasibility"
              body="See whether a route is live, thin, or likely to fail before you commit."
            />
            <FeatureCard
              icon={ShieldAlert}
              title="Risk Guardrails"
              body="Surface concentration, timing risk, and route fragility in language traders can actually act on."
            />
            <FeatureCard
              icon={LineChart}
              title="Post-Trade Clarity"
              body="When a trade fills, fails, or only partially clears, Siren explains what happened next."
            />
          </div>
        </section>

        <section id="venues" className="mx-auto w-full max-w-[1240px] px-4 py-12 md:px-6 md:py-20">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
            <div
              className="rounded-[28px] border p-7 md:p-8"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <SectionEyebrow>Built Above Venues</SectionEyebrow>
              <h2
                className="mt-4 font-heading font-bold tracking-[-0.038em]"
                style={{
                  color: "var(--text-1)",
                  fontSize: "clamp(1.95rem, 3.6vw, 2.75rem)",
                  lineHeight: 1.08,
                }}
              >
                Venues provide the book.
                <br />
                Siren provides the judgment.
              </h2>
              <p
                className="mt-5 max-w-[29rem] font-body text-base leading-[1.76]"
                style={{ color: "color-mix(in srgb, var(--text-1) 90%, var(--text-2))" }}
              >
                Keep the venue open if you want. Siren’s job is to tell you what looks executable, what looks dangerous, and what the route is likely to do under stress.
              </p>
            </div>

            <div
              className="rounded-[28px] border p-5 md:p-6"
              style={{
                borderColor: "var(--border-subtle)",
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, transparent), var(--bg-base))",
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["Venue Shows", "Price, event title, and the current book."],
                  ["Siren Adds", "Route confidence, sizing hints, resolution pressure, and failure reasons."],
                  ["Venue Strength", "Market ownership, settlement rules, and actual liquidity."],
                  ["Siren Strength", "Decision support before size goes in and after the attempt comes back."],
                ].map(([title, body]) => (
                  <div
                    key={title}
                    className="rounded-[20px] border p-5"
                    style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
                  >
                    <p
                      className="font-body text-[12px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "#00FF85" }}
                    >
                      {title}
                    </p>
                    <p className="mt-3 font-body text-[0.96rem] leading-[1.68]" style={{ color: "color-mix(in srgb, var(--text-1) 78%, var(--text-2))" }}>
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-12 md:px-6 md:pb-20 md:pt-20">
          <div
            className="rounded-[36px] border px-6 py-14 text-center md:px-10 md:py-20"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border-subtle))",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, var(--bg-surface)), color-mix(in srgb, var(--bg-base) 98%, transparent))",
            }}
          >
            <SectionEyebrow>Browse First</SectionEyebrow>
            <h2
              className="mx-auto mt-4 max-w-[58rem] font-heading font-bold tracking-[-0.06em]"
              style={{
                color: "var(--text-1)",
                fontSize: "clamp(2.1rem, 5vw, 4.1rem)",
                lineHeight: 0.95,
              }}
            >
              See Siren before you hand over anything.
            </h2>
            <p
              className="mx-auto mt-5 max-w-3xl font-body text-base leading-[1.72]"
              style={{ color: "color-mix(in srgb, var(--text-1) 90%, var(--text-2))" }}
            >
              Open the live terminal, inspect markets, and decide if the product earns your sign-up. When you are ready, Siren unlocks wallet-aware routing, portfolio sync, and execution tracking.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Link
                href="/terminal"
                onClick={() => hapticLight()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110"
                style={{ background: "#00FF85", color: "#060609" }}
              >
                Open Terminal
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a
                href="https://docs.onsiren.xyz"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => hapticLight()}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--bg-hover)]"
                style={{ borderColor: "var(--border-default)", color: "var(--text-1)", background: "transparent" }}
              >
                Read Docs
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="border-t"
        style={{
          borderColor: "color-mix(in srgb, var(--border-subtle) 70%, transparent)",
          background: "var(--bg-base)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <BrandLockup compact />
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              Execution And Risk Intelligence For Prediction Markets.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: "var(--text-2)" }}>
            <Link href="/terminal" onClick={() => hapticLight()}>
              Terminal
            </Link>
            <Link href="/leaderboard" onClick={() => hapticLight()}>
              Ranks
            </Link>
            <a
              href="https://docs.onsiren.xyz"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => hapticLight()}
            >
              Docs
            </a>
            <Link href="/terms" onClick={() => hapticLight()}>
              Terms
            </Link>
            <Link href="/privacy" onClick={() => hapticLight()}>
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

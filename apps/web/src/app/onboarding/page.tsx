"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { ArrowRight, Loader2, Radar, ShieldCheck, Wallet2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { hapticLight } from "@/lib/haptics";
import { API_URL } from "@/lib/apiUrl";
import { getWalletAuthHeaders } from "@/lib/requestAuth";
import { Footer } from "@/components/Footer";
import { useThemeStore } from "@/store/useThemeStore";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function OnboardingPage() {
  const { connected, walletSessionStatus, publicKey, signMessage } = useSirenWallet();
  const { login, ready, logout } = usePrivy();
  const { theme } = useThemeStore();
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [connectStalled, setConnectStalled] = useState(false);
  const [connectRequested, setConnectRequested] = useState(false);

  const walletKey = publicKey?.toBase58() ?? null;
  const showProfileStep = connected && walletSessionStatus === "ready";
  const isInitializing =
    walletSessionStatus === "privy-loading" || walletSessionStatus === "embedded-provisioning";
  const statusLabel =
    walletSessionStatus === "privy-loading"
      ? "Initializing…"
      : walletSessionStatus === "embedded-provisioning"
        ? "Creating wallet…"
        : null;

  const finishAndGo = useCallback(() => {
    try {
      localStorage.setItem("siren-onboarding-complete", "true");
    } catch {
      /* ignore */
    }
    router.replace("/");
  }, [router]);

  const handleSaveUsernameAndContinue = useCallback(async () => {
    hapticLight();
    const clean = usernameDraft.trim().replace(/[^a-zA-Z0-9_.\-]/g, "");
    if (clean.length >= 2 && walletKey) {
      setUsernameSaving(true);
      try {
        const res = await fetch(`${API_URL}/api/users/username`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await getWalletAuthHeaders({ wallet: walletKey, signMessage, scope: "write" })),
          },
          body: JSON.stringify({ wallet: walletKey, username: clean }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoginError(typeof payload?.error === "string" ? payload.error : "Could not save username.");
          setUsernameSaving(false);
          return;
        }
      } catch {
        setLoginError("Network error saving username.");
        setUsernameSaving(false);
        return;
      }
      setUsernameSaving(false);
    }
    finishAndGo();
  }, [usernameDraft, walletKey, finishAndGo, signMessage]);

  useEffect(() => {
    if (!showProfileStep) return;
    try {
      if (localStorage.getItem("siren-onboarding-complete") === "true") {
        router.replace("/");
      }
    } catch {
      /* ignore */
    }
  }, [showProfileStep, router]);

  useEffect(() => {
    if (!isInitializing) {
      setConnectStalled(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setConnectStalled(true);
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [isInitializing]);

  const handleLogin = async () => {
    hapticLight();
    setLoginError(null);
    setConnectStalled(false);
    setConnectRequested(true);
    try {
      await login();
    } catch (e) {
      console.error("[Siren] Privy login failed", e);
      setLoginError(e instanceof Error ? e.message : "Could not start sign up. Try again.");
    }
  };

  const handleResetLogin = async () => {
    hapticLight();
    setConnectStalled(false);
    setLoginError(null);
    setConnectRequested(false);
    try {
      await logout();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--bg-void)" }}>
      <main className="flex flex-1 items-center px-5 py-8 md:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-6xl">
          {!showProfileStep ? (
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:items-center">
              <section className="max-w-2xl">
                <img
                  src="/brand/logo.svg"
                  alt="Siren"
                  className="h-8 w-auto md:h-10"
                  style={{ filter: theme === "light" ? "brightness(0.08)" : "none" }}
                />

                <p className="mt-8 font-body text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                  Welcome To Siren
                </p>
                <h1
                  className="mt-3 font-heading font-bold tracking-[-0.06em]"
                  style={{ color: "var(--text-1)", fontSize: "clamp(2.2rem, 7vw, 4.4rem)", lineHeight: 0.92 }}
                >
                  See The Market.
                  <br />
                  Read The Risk.
                  <br />
                  Trade When Ready.
                </h1>
                <p className="mt-5 max-w-xl font-body text-base leading-relaxed md:text-lg" style={{ color: "var(--text-2)" }}>
                  Siren is the execution and risk intelligence layer for prediction markets. Browse live books first, understand what looks tradeable, then sign up only when you want portfolio sync, execution history, and wallet routing.
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: Radar,
                      title: "Live Market View",
                      body: "Open Kalshi and Polymarket books without handing over your info first.",
                    },
                    {
                      icon: ShieldCheck,
                      title: "Execution Read",
                      body: "See whether a trade looks thin, crowded, or risky before you size up.",
                    },
                    {
                      icon: Wallet2,
                      title: "Sign Up Later",
                      body: "Create an account only when you want routing, tracking, and a synced portfolio.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[22px] border p-4"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-2xl"
                        style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                      >
                        <item.icon className="h-4 w-4" />
                      </div>
                      <p className="mt-4 font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                        {item.title}
                      </p>
                      <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      finishAndGo();
                    }}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    Open Terminal
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  {PRIVY_APP_ID ? (
                    <button
                      type="button"
                      onClick={() => void handleLogin()}
                      disabled={!ready || isInitializing}
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-150 hover:bg-[var(--bg-elevated)] active:scale-[0.98] disabled:opacity-50"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)", background: "var(--bg-surface)" }}
                    >
                      {connectRequested && isInitializing ? "Starting Sign Up…" : "Sign Up To Trade"}
                    </button>
                  ) : null}
                </div>

                {connectRequested && isInitializing && (
                  <div
                    className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-2 font-body text-xs"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: "var(--bg-surface)",
                      color: "var(--text-2)",
                    }}
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: "var(--accent)" }} />
                    {statusLabel ?? "Starting Sign Up…"}
                  </div>
                )}

                {connectRequested && connectStalled && (
                  <div
                    className="mt-4 max-w-xl rounded-[22px] border px-4 py-4"
                    style={{
                      borderColor: "color-mix(in srgb, var(--yellow) 35%, transparent)",
                      background: "color-mix(in srgb, var(--yellow) 8%, var(--bg-surface))",
                    }}
                  >
                    <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                      Sign Up Is Taking Longer Than It Should.
                    </p>
                    <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                      Reset the login flow and try again, or open the terminal now and keep browsing without an account.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleResetLogin()}
                        className="rounded-full border px-3 py-2 font-body text-xs font-semibold"
                        style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)", background: "var(--bg-surface)" }}
                      >
                        Reset Sign Up
                      </button>
                      <button
                        type="button"
                        onClick={() => finishAndGo()}
                        className="rounded-full border px-3 py-2 font-body text-xs font-semibold"
                        style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, var(--bg-surface))" }}
                      >
                        Keep Browsing
                      </button>
                    </div>
                  </div>
                )}

                {loginError && (
                  <p className="mt-3 font-body text-sm" style={{ color: "var(--down)" }}>
                    {loginError}
                  </p>
                )}
              </section>

              <section className="lg:justify-self-end">
                <div
                  className="overflow-hidden rounded-[30px] border p-3"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 97%, transparent), color-mix(in srgb, var(--bg-base) 92%, transparent))",
                    boxShadow: "0 32px 80px -56px rgba(0,0,0,0.48)",
                  }}
                >
                  <div className="rounded-[24px] border p-3 md:p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}>
                    <img
                      src="/brand/mockup-browser.png"
                      alt="Siren market explorer preview"
                      className="w-full rounded-[18px] border object-cover"
                      style={{ borderColor: "var(--border-subtle)" }}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {[
                      ["Execution Before Entry", "See what looks tradeable before you commit."],
                      ["Current Books First", "Siren prioritizes live, current books over dead listings."],
                      ["Portfolio When You Need It", "Sign up later to unlock tracking and wallet-aware actions."],
                    ].map(([title, body]) => (
                      <div
                        key={title}
                        className="rounded-[20px] border p-4"
                        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                      >
                        <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                          {title}
                        </p>
                        <p className="mt-2 font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                          {body}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="mx-auto max-w-md rounded-[30px] border p-6 text-center" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
              <img
                src="/brand/logo.svg"
                alt="Siren"
                className="mx-auto h-8 w-auto"
                style={{ filter: theme === "light" ? "brightness(0.08)" : "none" }}
              />
              <h1
                className="mt-8 font-heading font-bold tracking-tight"
                style={{ color: "var(--text-1)", fontSize: "clamp(1.5rem, 4vw, 2rem)", lineHeight: 1.06 }}
              >
                You Are In.
              </h1>
              <p className="mt-3 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                Add a handle if you want one. It shows on share cards and your portfolio, and you can change it later.
              </p>
              <label className="sr-only" htmlFor="onboarding-username">
                Username
              </label>
              <input
                id="onboarding-username"
                type="text"
                value={usernameDraft}
                onChange={(e) => setUsernameDraft(e.target.value.replace(/[^a-zA-Z0-9_.\-]/g, "").slice(0, 20))}
                placeholder="Choose a username (optional)"
                className="mt-5 w-full rounded-2xl border px-4 py-3 font-body text-sm text-left outline-none"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-base)",
                  color: "var(--text-1)",
                }}
                autoComplete="username"
              />
              {loginError && (
                <p className="mt-3 w-full text-left font-body text-xs" style={{ color: "var(--down)" }}>
                  {loginError}
                </p>
              )}
              <button
                type="button"
                disabled={usernameSaving}
                onClick={() => void handleSaveUsernameAndContinue()}
                className="mt-4 w-full rounded-2xl py-3.5 font-heading text-sm font-semibold uppercase tracking-[0.1em] transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                {usernameSaving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Enter Siren"}
              </button>
              <button
                type="button"
                disabled={usernameSaving}
                onClick={() => {
                  hapticLight();
                  setLoginError(null);
                  finishAndGo();
                }}
                className="mt-4 font-body text-sm"
                style={{ color: "var(--text-3)" }}
              >
                Skip This For Now
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

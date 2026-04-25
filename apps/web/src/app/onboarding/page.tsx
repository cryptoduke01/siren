"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Radar, ShieldCheck, Wallet2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { Footer } from "@/components/Footer";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { hapticLight } from "@/lib/haptics";
import { API_URL } from "@/lib/apiUrl";
import { getWalletAuthHeaders } from "@/lib/requestAuth";
import { useThemeStore } from "@/store/useThemeStore";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function OnboardingPage() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { connected, walletSessionStatus, publicKey, signMessage } = useSirenWallet();
  const { login, ready, logout } = usePrivy();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [connectStalled, setConnectStalled] = useState(false);
  const [connectRequested, setConnectRequested] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const walletKey = publicKey?.toBase58() ?? null;
  const showProfileStep = connected && walletSessionStatus === "ready";
  const isInitializing =
    walletSessionStatus === "privy-loading" || walletSessionStatus === "embedded-provisioning";
  const signUpHint = !PRIVY_APP_ID
    ? "Sign up is not configured on this deployment yet."
    : !ready
      ? "Sign up is still loading. If you click now, we will tell you what is blocking it."
      : null;

  const finishAndGo = useCallback(() => {
    try {
      localStorage.setItem("siren-onboarding-complete", "true");
    } catch {
      /* ignore */
    }
    router.replace("/terminal");
  }, [router]);

  useEffect(() => {
    if (!showProfileStep) return;
    try {
      if (localStorage.getItem("siren-onboarding-complete") === "true") {
        router.replace("/terminal");
      }
    } catch {
      /* ignore */
    }
  }, [router, showProfileStep]);

  useEffect(() => {
    if (!isInitializing) {
      setConnectStalled(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setConnectStalled(true);
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [isInitializing]);

  const handleLogin = async () => {
    hapticLight();
    setLoginError(null);
    setConnectStalled(false);
    if (!PRIVY_APP_ID) {
      setLoginError("Sign up is not configured on this deployment yet. Add NEXT_PUBLIC_PRIVY_APP_ID and reload.");
      return;
    }
    if (!ready) {
      setLoginError("Sign up is still loading. Give it a second and try again.");
      return;
    }
    if (isInitializing) {
      setConnectRequested(true);
      setLoginError("Sign up is already starting. If nothing appears, reset and try again.");
      return;
    }
    setConnectRequested(true);
    try {
      await login();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Could not start sign up.");
    }
  };

  const handleResetLogin = async () => {
    hapticLight();
    setConnectStalled(false);
    setConnectRequested(false);
    setLoginError(null);
    try {
      await logout();
    } catch {
      /* ignore */
    }
  };

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
  }, [finishAndGo, signMessage, usernameDraft, walletKey]);

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--bg-void)" }}>
      <main className="flex flex-1 items-center px-4 py-8 md:px-6 md:py-10">
        <div className="mx-auto w-full max-w-6xl">
          {!showProfileStep ? (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.82fr)] lg:items-center">
              <section className="max-w-2xl">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 font-body text-sm transition-colors"
                  style={{ color: "var(--text-2)" }}
                  onClick={() => hapticLight()}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back To Landing
                </Link>

                <img
                  src="/brand/logo.svg"
                  alt="Siren"
                  className="mt-8 h-9 w-auto md:h-10"
                  style={{ filter: theme === "light" ? "brightness(0.08)" : "none" }}
                />
                <p className="mt-8 font-body text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                  Welcome To Siren
                </p>
                <h1
                  className="mt-3 font-heading font-bold tracking-[-0.06em]"
                  style={{ color: "var(--text-1)", fontSize: "clamp(2.2rem, 6vw, 4.3rem)", lineHeight: 0.92 }}
                >
                  Get The Tools
                  <br />
                  Behind Better
                  <br />
                  Prediction Trades.
                </h1>
                <p className="mt-5 max-w-xl font-body text-base leading-relaxed md:text-lg" style={{ color: "var(--text-2)" }}>
                  You can browse live books first. Sign up only when you want synced portfolio history, execution tracking, and trading actions tied to your Siren account.
                </p>

                <div
                  className="mt-7 rounded-[28px] border p-5 md:p-6"
                  style={{
                    borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 96%, transparent), color-mix(in srgb, var(--bg-base) 95%, transparent))",
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {["Kalshi", "Polymarket", "Execution Clarity", "Risk Context"].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.14em]"
                        style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)", background: "var(--bg-surface)" }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        icon: Wallet2,
                        title: "Portfolio Sync",
                        body: "Track positions, trade outcomes, and post-trade reports in one place.",
                      },
                      {
                        icon: Radar,
                        title: "Execution Tracking",
                        body: "See which routes worked, which failed, and how Siren advised the trade.",
                      },
                      {
                        icon: ShieldCheck,
                        title: "Trading Identity",
                        body: "Unlock wallet-aware routing and proof checks when you want to trade inside Siren.",
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
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href="/terminal"
                    onClick={() => hapticLight()}
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl border px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em]"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)", background: "var(--bg-surface)" }}
                  >
                    Browse Terminal First
                  </Link>
                  <p className="font-body text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
                    Sign up stays optional until you want the account layer.
                  </p>
                </div>
              </section>

              <section
                className="rounded-[30px] border p-5 md:p-6"
                style={{
                  borderColor: "color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
                  background:
                    "linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, transparent), color-mix(in srgb, var(--bg-base) 96%, transparent))",
                }}
              >
                <div className="rounded-[24px] border p-5" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                    >
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-heading text-lg font-semibold" style={{ color: "var(--text-1)" }}>
                        Create Your Siren Account
                      </p>
                      <p className="mt-1 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                        Email, Google, or GitHub. Siren handles the account setup from there.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {[
                      "Browse markets before you sign up.",
                      "Sign up only when you want trading actions or portfolio tracking.",
                      "If sign up stalls, you can reset and keep browsing.",
                    ].map((line) => (
                      <div
                        key={line}
                        className="flex items-start gap-3 rounded-2xl border px-4 py-3"
                        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)" }}
                      >
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                        <p className="font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                          {line}
                        </p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleLogin()}
                    disabled={connectRequested && isInitializing}
                    className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    {connectRequested && isInitializing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Starting Sign Up…
                      </>
                    ) : (
                      <>
                        Sign Up To Trade
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {signUpHint && !loginError && (
                    <p className="mt-3 font-body text-sm" style={{ color: "var(--text-3)" }}>
                      {signUpHint}
                    </p>
                  )}

                  {connectStalled && (
                    <div
                      className="mt-4 rounded-[20px] border px-4 py-4"
                      style={{
                        borderColor: "color-mix(in srgb, var(--yellow) 35%, transparent)",
                        background: "color-mix(in srgb, var(--yellow) 8%, var(--bg-surface))",
                      }}
                    >
                      <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                        Sign Up Is Taking Longer Than Normal.
                      </p>
                      <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                        Reset the flow and try again, or keep browsing and come back when you are ready.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleResetLogin()}
                        className="mt-4 rounded-full border px-3 py-2 font-body text-xs font-semibold"
                        style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)", background: "var(--bg-surface)" }}
                      >
                        Reset Sign Up
                      </button>
                    </div>
                  )}

                  {loginError && (
                    <p className="mt-4 font-body text-sm" style={{ color: "var(--down)" }}>
                      {loginError}
                    </p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div
              className="mx-auto max-w-md rounded-[30px] border p-6 text-center"
              style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <img
                src="/brand/logo.svg"
                alt="Siren"
                className="mx-auto h-8 w-auto"
                style={{ filter: theme === "light" ? "brightness(0.08)" : "none" }}
              />
              <h1
                className="mt-8 font-heading font-bold tracking-[-0.05em]"
                style={{ color: "var(--text-1)", fontSize: "clamp(1.5rem, 4vw, 2rem)", lineHeight: 1.04 }}
              >
                You Are In.
              </h1>
              <p className="mt-3 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                Add a handle if you want one. It shows on your portfolio and share cards, and you can change it later.
              </p>
              <label htmlFor="onboarding-username" className="sr-only">
                Username
              </label>
              <input
                id="onboarding-username"
                type="text"
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value.replace(/[^a-zA-Z0-9_.\-]/g, "").slice(0, 20))}
                placeholder="Choose a username (optional)"
                className="mt-5 w-full rounded-2xl border px-4 py-3 font-body text-sm outline-none"
                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-base)", color: "var(--text-1)" }}
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
                className="mt-4 w-full rounded-2xl py-3.5 font-heading text-sm font-semibold uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { Loader2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { hapticLight } from "@/lib/haptics";
import { API_URL } from "@/lib/apiUrl";
import { getWalletAuthHeaders } from "@/lib/requestAuth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function OnboardingPage() {
  const { connected, walletSessionStatus, publicKey, signMessage } = useSirenWallet();
  const { login, ready, logout } = usePrivy();
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
      setLoginError(e instanceof Error ? e.message : "Could not start login. Try again.");
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
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-5"
      style={{ background: "var(--bg-void)" }}
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <img
          src="/brand/logo.svg"
          alt="Siren"
          className="h-8 w-auto mb-10"
        />

        {!showProfileStep ? (
          <>
            <h1
              className="font-heading font-bold tracking-tight mb-3"
              style={{ color: "var(--text-1)", fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.08 }}
            >
              See Siren Before You Connect.
            </h1>

            <p className="font-body text-sm mb-7 leading-relaxed" style={{ color: "var(--text-2)" }}>
              Browse live prediction markets first. Connect only when you want wallet routing, portfolio sync, or execution history.
            </p>

            <div className="mb-7 flex w-full flex-wrap justify-center gap-2">
              {["Live Markets", "Execution Context", "No Sign-In Wall"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border px-3 py-1.5 font-body text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "color-mix(in srgb, var(--bg-elevated) 90%, transparent)",
                    color: "var(--text-2)",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                finishAndGo();
              }}
              className="w-full py-3.5 rounded-lg font-heading font-semibold text-sm uppercase tracking-[0.1em] transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              Open Terminal
            </button>

            <p className="font-body text-[11px] mt-3 mb-5 leading-relaxed" style={{ color: "var(--text-2)" }}>
              Sign in stays optional until you actually need wallet features.
            </p>

            {PRIVY_APP_ID ? (
              <>
                {connectRequested && isInitializing && (
                  <div
                    className="flex items-center justify-center gap-2 w-full rounded-lg border px-3 py-2.5 mb-4 font-label text-[11px]"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-2)",
                    }}
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: "var(--accent)" }} />
                    {statusLabel ?? "Connecting…"}
                  </div>
                )}

                {connectRequested && connectStalled && (
                  <div
                    className="mb-4 w-full rounded-[18px] border px-4 py-3.5 text-left"
                    style={{
                      borderColor: "color-mix(in srgb, var(--yellow) 35%, transparent)",
                      background: "color-mix(in srgb, var(--yellow) 8%, var(--bg-elevated))",
                    }}
                  >
                    <p className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                      Wallet setup is taking too long.
                    </p>
                    <p className="mt-1 font-body text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                      Close the login flow and try again, or keep browsing Siren without connecting first.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleResetLogin()}
                        className="rounded-full border px-3 py-2 font-body text-xs font-semibold"
                        style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)", background: "var(--bg-surface)" }}
                      >
                        Reset Login
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

                <button
                  type="button"
                  onClick={() => void handleLogin()}
                  disabled={!ready || isInitializing}
                  className="w-full py-3.5 rounded-lg border font-heading font-semibold text-sm uppercase tracking-[0.1em] transition-all duration-150 hover:bg-[var(--bg-elevated)] active:scale-[0.98] disabled:opacity-50"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                >
                  {connectRequested && isInitializing ? "Connecting…" : "Connect"}
                </button>

                {loginError && (
                  <p className="font-body text-xs mt-3" style={{ color: "var(--down)" }}>
                    {loginError}
                  </p>
                )}
              </>
            ) : (
              <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
                Privy app ID not configured.
              </p>
            )}
          </>
        ) : (
          <>
            <h1
              className="font-heading font-bold tracking-tight mb-3"
              style={{ color: "var(--text-1)", fontSize: "clamp(1.35rem, 4vw, 1.75rem)", lineHeight: 1.15 }}
            >
              You Are In.
            </h1>
            <p className="font-body text-sm mb-6" style={{ color: "var(--text-3)" }}>
              Username is optional. It shows on share cards and your portfolio. You can add or change it later in portfolio or skip now.
            </p>
            <label className="sr-only" htmlFor="onboarding-username">
              Username (optional)
            </label>
            <input
              id="onboarding-username"
              type="text"
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value.replace(/[^a-zA-Z0-9_.\-]/g, "").slice(0, 20))}
              placeholder="username (optional)"
              className="w-full rounded-lg border px-3 py-2.5 font-body text-sm text-left outline-none mb-3"
              style={{
                borderColor: "var(--border-subtle)",
                background: "var(--bg-elevated)",
                color: "var(--text-1)",
              }}
              autoComplete="username"
            />
            {loginError && (
              <p className="font-body text-xs mb-3 w-full text-left" style={{ color: "var(--down)" }}>
                {loginError}
              </p>
            )}
            <button
              type="button"
              disabled={usernameSaving}
              onClick={() => void handleSaveUsernameAndContinue()}
              className="w-full py-3.5 rounded-lg font-heading font-semibold text-sm uppercase tracking-[0.1em] transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              {usernameSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Continue"}
            </button>
            <button
              type="button"
              disabled={usernameSaving}
              onClick={() => { hapticLight(); setLoginError(null); finishAndGo(); }}
              className="mt-3 font-sub text-xs"
              style={{ color: "var(--text-3)" }}
            >
              Skip For Now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

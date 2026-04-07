"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { ArrowRight, Loader2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { hapticLight } from "@/lib/haptics";
import { API_URL } from "@/lib/apiUrl";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function OnboardingPage() {
  const { connected, walletSessionStatus, publicKey } = useSirenWallet();
  const { login, ready } = usePrivy();
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const walletKey = publicKey?.toBase58() ?? null;
  const showProfileStep = connected && walletSessionStatus === "ready";

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
          headers: { "Content-Type": "application/json" },
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
  }, [usernameDraft, walletKey, finishAndGo]);

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

  const handleLogin = async () => {
    hapticLight();
    setLoginError(null);
    try {
      await login();
    } catch (e) {
      console.error("[Siren] Privy login failed", e);
      setLoginError(e instanceof Error ? e.message : "Could not start login. Try again.");
    }
  };

  const isInitializing =
    walletSessionStatus === "privy-loading" || walletSessionStatus === "embedded-provisioning";
  const statusLabel =
    walletSessionStatus === "privy-loading"
      ? "Initializing…"
      : walletSessionStatus === "embedded-provisioning"
        ? "Creating wallet…"
        : null;

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
              style={{ color: "var(--text-1)", fontSize: "clamp(1.5rem, 4vw, 2rem)", lineHeight: 1.15 }}
            >
              Trade the signal.
            </h1>

            <p className="font-body text-sm mb-10" style={{ color: "var(--text-3)" }}>
              Prediction markets + meme tokens. One terminal.
            </p>

            {PRIVY_APP_ID ? (
              <>
                {isInitializing && (
                  <div
                    className="flex items-center justify-center gap-2 w-full rounded-lg border px-3 py-2.5 mb-4 font-label text-[11px]"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-2)",
                    }}
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: "var(--accent)" }} />
                    {statusLabel}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void handleLogin()}
                  disabled={!ready || isInitializing}
                  className="w-full py-3.5 rounded-lg font-heading font-semibold text-sm uppercase tracking-[0.1em] transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  {!ready ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </button>

                {loginError && (
                  <p className="font-body text-xs mt-3" style={{ color: "var(--down)" }}>
                    {loginError}
                  </p>
                )}

                <p className="font-body text-[11px] mt-4 leading-relaxed" style={{ color: "var(--text-3)" }}>
                  Email, Google, or GitHub. Embedded Solana wallet, no extension needed.
                </p>
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
              You are in.
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
              Skip for now
            </button>
          </>
        )}

        <Link
          href="/"
          onClick={() => hapticLight()}
          className="mt-8 inline-flex items-center gap-1.5 font-body text-xs font-medium"
          style={{ color: "var(--text-3)" }}
        >
          Skip to terminal
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <footer className="absolute bottom-5 left-0 right-0 text-center">
        <p className="font-body text-[10px]" style={{ color: "var(--text-3)", opacity: 0.5 }}>
          onsiren.xyz
        </p>
      </footer>
    </div>
  );
}

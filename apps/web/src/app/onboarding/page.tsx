"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { ArrowRight, Loader2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { hapticLight } from "@/lib/haptics";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function OnboardingPage() {
  const { connected, walletSessionStatus } = useSirenWallet();
  const { login, ready } = usePrivy();
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (connected && walletSessionStatus === "ready") {
      try {
        localStorage.setItem("siren-onboarding-complete", "true");
      } catch {
        /* ignore */
      }
      router.replace("/");
    }
  }, [connected, walletSessionStatus, router]);

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
              Email, Google, GitHub, or X — embedded Solana wallet, no extension needed.
            </p>
          </>
        ) : (
          <p className="font-body text-sm" style={{ color: "var(--text-3)" }}>
            Privy app ID not configured.
          </p>
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

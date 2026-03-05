"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { TopBar } from "@/components/TopBar";
import { WalletModal } from "@/components/WalletModal";
import { Rocket } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { useWalletTypeStore } from "@/store/useWalletTypeStore";

function SocialButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-body text-sm font-medium transition-all duration-150 opacity-90 hover:opacity-100"
      style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-1)" }}
    >
      {icon}
      {label}
    </button>
  );
}

export default function OnboardingPage() {
  const { connected } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const { setWalletType } = useWalletTypeStore();

  useEffect(() => {
    if (connected) {
      router.replace("/");
    }
  }, [connected, router]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: "var(--accent-dim)" }}>
            <Rocket className="w-6 h-6" style={{ color: "var(--accent)" }} />
          </div>
          <h1 className="font-heading font-bold text-3xl mb-3" style={{ color: "var(--text-1)" }}>
            Event-Driven Meme Terminal
          </h1>
          <p className="font-body text-sm mb-1" style={{ color: "var(--text-2)" }}>
            Connect your wallet to browse prediction markets, surface tokens tied to real-world events, and launch new Bags tokens.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 mb-10">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setWalletType(null);
              setModalOpen(true);
            }}
            className="px-8 py-3 rounded-xl font-heading font-semibold text-sm uppercase tracking-[0.12em] transition-all duration-150"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            Connect wallet
          </button>
          <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
            You can disconnect anytime from the top bar once connected.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
            <p className="font-heading text-xs mb-1" style={{ color: "var(--text-1)" }}>Terminal</p>
            <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
              Browse Kalshi markets with live probabilities and velocity. Tap a market to see linked tokens.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
            <p className="font-heading text-xs mb-1" style={{ color: "var(--text-1)" }}>Portfolio</p>
            <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
              See your SOL balances, tokens, prediction positions, and Bags fee earnings in one place.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
            <p className="font-heading text-xs mb-1" style={{ color: "var(--text-1)" }}>Launch</p>
            <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
              Launch new tokens with Bags, including social links, and track them from your portfolio.
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
            Sign in with (coming soon)
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <SocialButton
              label="Twitter"
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              }
              onClick={() => hapticLight()}
            />
            <SocialButton
              label="Google"
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              }
              onClick={() => hapticLight()}
            />
            <SocialButton
              label="GitHub"
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              }
              onClick={() => hapticLight()}
            />
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href="/"
            className="font-body text-xs underline"
            style={{ color: "var(--text-2)" }}
          >
            Skip to terminal →
          </Link>
        </div>
      </main>
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

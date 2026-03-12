"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { TopBar } from "@/components/TopBar";
import { Rocket } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { hapticLight } from "@/lib/haptics";
import { WalletModal } from "@/components/WalletModal";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

function OnboardingWithBoth() {
  const { connected } = useSirenWallet();
  const { login, ready } = usePrivy();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (connected) router.replace("/");
  }, [connected, router]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xs">
      <button
        type="button"
        onClick={() => { hapticLight(); setModalOpen(true); }}
        className="w-full px-8 py-3 rounded-xl font-heading font-semibold text-sm uppercase tracking-[0.12em] transition-all duration-150"
        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
      >
        Connect Solana wallet
      </button>
      <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
        Phantom, Backpack, Solflare, Coinbase, Torus
      </p>
      <span className="font-body text-xs" style={{ color: "var(--text-3)" }}>or</span>
      <button
        type="button"
        onClick={() => { hapticLight(); login(); }}
        disabled={!ready}
        className="w-full px-8 py-3 rounded-xl font-heading font-semibold text-sm uppercase tracking-[0.12em] transition-all duration-150 border disabled:opacity-50"
        style={{ borderColor: "var(--border)", color: "var(--text-1)" }}
      >
        {ready ? "Log in with email or social" : "Loading..."}
      </button>
      <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
        Email, Google, GitHub, or X
      </p>
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function OnboardingWithAdapter() {
  const { connected } = useSirenWallet();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (connected) router.replace("/");
  }, [connected, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => { hapticLight(); setModalOpen(true); }}
        className="px-8 py-3 rounded-xl font-heading font-semibold text-sm uppercase tracking-[0.12em] transition-all duration-150"
        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
      >
        Connect wallet
      </button>
      <p className="font-body text-xs" style={{ color: "var(--text-2)" }}>
        Connect Phantom, Solflare, or Torus.
      </p>
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

export default function OnboardingPage() {
  const { connected } = useSirenWallet();
  const router = useRouter();

  useEffect(() => {
    if (connected) router.replace("/");
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
          {PRIVY_APP_ID ? <OnboardingWithBoth /> : <OnboardingWithAdapter />}
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
        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href="/"
            className="font-body text-xs underline"
            style={{ color: "var(--text-2)" }}
            onClick={() => hapticLight()}
          >
            Skip to terminal →
          </Link>
        </div>
      </main>
    </div>
  );
}

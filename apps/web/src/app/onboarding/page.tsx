\"use client\";

import { useEffect, useState } from \"react\";
import Link from \"next/link\";
import { useRouter } from \"next/navigation\";
import { useWallet } from \"@solana/wallet-adapter-react\";
import { TopBar } from \"@/components/TopBar\";
import { WalletModal } from \"@/components/WalletModal\";
import { Rocket } from \"lucide-react\";
import { hapticLight } from \"@/lib/haptics\";
import { useWalletTypeStore } from \"@/store/useWalletTypeStore\";

export default function OnboardingPage() {
  const { connected } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const { setWalletType } = useWalletTypeStore();

  useEffect(() => {
    if (connected) {
      router.replace(\"/\");
    }
  }, [connected, router]);

  return (
    <div className=\"min-h-screen flex flex-col\" style={{ background: \"var(--bg-void)\" }}>
      <TopBar />
      <main className=\"flex-1 flex flex-col items-center justify-center px-4 py-10\">
        <div className=\"w-full max-w-xl text-center mb-8\">
          <div className=\"inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4\" style={{ background: \"var(--accent-dim)\" }}>
            <Rocket className=\"w-6 h-6\" style={{ color: \"var(--accent)\" }} />
          </div>
          <h1 className=\"font-heading font-bold text-3xl mb-3\" style={{ color: \"var(--text-1)\" }}>
            Siren — Event-Driven Meme Terminal
          </h1>
          <p className=\"font-body text-sm\" style={{ color: \"var(--text-3)\" }}>
            Connect your wallet to browse prediction markets, surface tokens tied to real-world events, and launch new Bags tokens.
          </p>
        </div>
        <div className=\"flex flex-col items-center gap-4 mb-10\">
          <button
            type=\"button\"
            onClick={() => {
              hapticLight();
              setWalletType(null);
              setModalOpen(true);
            }}
            className=\"px-8 py-3 rounded-xl font-heading font-semibold text-sm uppercase tracking-[0.12em] transition-all duration-150\"
            style={{ background: \"var(--accent)\", color: \"var(--accent-text)\" }}
          >
            Connect wallet
          </button>
          <p className=\"font-body text-xs\" style={{ color: \"var(--text-3)\" }}>
            You can disconnect anytime from the top bar once connected.
          </p>
        </div>
        <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl\">
          <div className=\"rounded-2xl border p-4\" style={{ borderColor: \"var(--border-subtle)\", background: \"var(--bg-surface)\" }}>
            <p className=\"font-heading text-xs mb-1\" style={{ color: \"var(--text-2)\" }}>Terminal</p>
            <p className=\"font-body text-xs\" style={{ color: \"var(--text-3)\" }}>
              Browse Kalshi markets with live probabilities and velocity. Tap a market to see linked tokens.
            </p>
          </div>
          <div className=\"rounded-2xl border p-4\" style={{ borderColor: \"var(--border-subtle)\", background: \"var(--bg-surface)\" }}>
            <p className=\"font-heading text-xs mb-1\" style={{ color: \"var(--text-2)\" }}>Portfolio</p>
            <p className=\"font-body text-xs\" style={{ color: \"var(--text-3)\" }}>
              See your SOL balances, tokens, prediction positions, and Bags fee earnings in one place.
            </p>
          </div>
          <div className=\"rounded-2xl border p-4\" style={{ borderColor: \"var(--border-subtle)\", background: \"var(--bg-surface)\" }}>
            <p className=\"font-heading text-xs mb-1\" style={{ color: \"var(--text-2)\" }}>Launch</p>
            <p className=\"font-body text-xs\" style={{ color: \"var(--text-3)\" }}>
              Launch new tokens with Bags, including social links, and track them from your portfolio.
            </p>
          </div>
        </div>
        <div className=\"mt-8 flex flex-col items-center gap-2\">
          <p className=\"font-body text-[11px]\" style={{ color: \"var(--text-3)\" }}>
            Social sign-in (Twitter / Google / Email) coming soon.
          </p>
          <Link
            href=\"/\"
            className=\"font-body text-[11px] underline\"
            style={{ color: \"var(--text-3)\" }}
          >
            Skip to terminal →
          </Link>
        </div>
      </main>
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}


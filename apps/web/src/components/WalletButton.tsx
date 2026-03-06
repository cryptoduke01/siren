"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModal } from "./WalletModal";
import { useWalletTypeStore } from "@/store/useWalletTypeStore";
import { hapticLight } from "@/lib/haptics";

export function WalletButton() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setWalletType } = useWalletTypeStore();
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isWaitlist = pathname === "/waitlist";

  const short = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  const handleDisconnect = () => {
    hapticLight();
    setWalletType(null);
    disconnect();
  };

  if (connected && publicKey) {
    return (
      <button
        onClick={handleDisconnect}
        title="Log out"
        className="font-mono text-xs px-3 py-2 rounded-[6px] transition-all duration-[120ms] ease hover:border-[var(--border-active)] flex items-center gap-2"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          color: "var(--text-2)",
        }}
      >
        <span>{short}</span>
        {isWaitlist && <span className="font-body font-medium uppercase tracking-wider" style={{ color: "var(--text-1)" }}>Log out</span>}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          hapticLight();
          router.push("/onboarding");
        }}
        className="font-mono text-xs px-3 py-2 rounded-[6px] transition-all duration-[120ms] ease hover:border-[var(--border-active)]"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          color: "var(--text-2)",
        }}
      >
        Sign up
      </button>
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

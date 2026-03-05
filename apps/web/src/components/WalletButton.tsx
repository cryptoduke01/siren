"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModal } from "./WalletModal";
import { useWalletTypeStore } from "@/store/useWalletTypeStore";
import { hapticLight } from "@/lib/haptics";

export function WalletButton() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setWalletType } = useWalletTypeStore();
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

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
        title="Click to disconnect"
        className="font-mono text-xs px-3 py-2 rounded-[6px] transition-all duration-[120ms] ease hover:border-[var(--border-active)]"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          color: "var(--text-2)",
        }}
      >
        {short}
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

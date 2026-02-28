"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModal } from "./WalletModal";
import { useWalletTypeStore } from "@/store/useWalletTypeStore";
import { hapticLight } from "@/lib/haptics";

export function WalletButton() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setWalletType } = useWalletTypeStore();
  const [modalOpen, setModalOpen] = useState(false);

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
      <div className="flex items-center gap-2">
        <button
          onClick={handleDisconnect}
          title="Click to disconnect"
          className="px-3 py-2 rounded-md font-mono text-xs text-[var(--text-primary)] border transition-colors duration-100 hover:bg-[var(--bg-hover)]"
          style={{ borderColor: "var(--border-active)" }}
        >
          {short}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          hapticLight();
          setModalOpen(true);
        }}
        className="px-3 py-2 rounded-md font-heading font-semibold text-xs uppercase tracking-[0.06em] border transition-colors duration-100 text-[var(--text-primary)] hover:border-[var(--border-active)] hover:bg-[var(--bg-hover)]"
        style={{ borderColor: "var(--border-active)" }}
      >
        Connect
      </button>
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

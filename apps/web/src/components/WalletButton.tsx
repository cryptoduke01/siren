"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { WalletModal } from "./WalletModal";
import { useWalletTypeStore } from "@/store/useWalletTypeStore";
import { hapticLight } from "@/lib/haptics";

export function WalletButton() {
  const { connected, publicKey, disconnect } = useSirenWallet();
  const { setWalletType } = useWalletTypeStore();
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isWaitlist = pathname === "/waitlist";

  const short = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  useEffect(() => {
    if (!connected || !publicKey) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    fetch(`${apiUrl}/api/users/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: publicKey.toBase58(), signupSource: "wallet" }),
    }).catch(() => {});
  }, [connected, publicKey]);

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

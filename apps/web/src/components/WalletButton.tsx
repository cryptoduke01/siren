"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { WalletModal } from "./WalletModal";
import { useWalletTypeStore } from "@/store/useWalletTypeStore";
import { hapticLight } from "@/lib/haptics";
import { ChevronDown, Copy, LogOut } from "lucide-react";

export function WalletButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const { connected, publicKey, disconnect } = useSirenWallet();
  const { setWalletType } = useWalletTypeStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const short = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;
  const fullAddress = publicKey?.toBase58() ?? "";

  useEffect(() => {
    if (!connected || !publicKey) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    fetch(`${apiUrl}/api/users/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: publicKey.toBase58(), signupSource: "wallet" }),
    }).catch(() => {});
  }, [connected, publicKey]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [dropdownOpen]);

  const handleDisconnect = () => {
    hapticLight();
    setDropdownOpen(false);
    setWalletType(null);
    disconnect();
  };

  const handleCopyAddress = () => {
    hapticLight();
    if (fullAddress) navigator.clipboard.writeText(fullAddress);
    setDropdownOpen(false);
  };

  if (connected && publicKey) {
    return (
      <div className={`relative ${fullWidth ? "w-full" : ""}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => { hapticLight(); setDropdownOpen((o) => !o); }}
        className={`font-body text-xs px-3 py-2 rounded-[6px] transition-all duration-[120ms] ease hover:border-[var(--border-active)] flex items-center gap-1.5 ${fullWidth ? "w-full justify-between" : ""}`}
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-2)" }}
        >
          <span>{short}</span>
          <ChevronDown className="w-3.5 h-3.5" style={{ opacity: dropdownOpen ? 0.7 : 0.5 }} />
        </button>
        {dropdownOpen && (
          <div
            className={`absolute top-full mt-1 py-1 rounded-lg border min-w-[160px] z-50 ${fullWidth ? "left-0 right-0 w-full" : "right-0"}`}
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
          >
            <button type="button" onClick={handleCopyAddress} className="w-full flex items-center gap-2 px-3 py-2 text-left font-body text-xs hover:bg-[var(--bg-elevated)]" style={{ color: "var(--text-1)" }}>
              <Copy className="w-3.5 h-3.5" /> Copy address
            </button>
            <button type="button" onClick={handleDisconnect} className="w-full flex items-center gap-2 px-3 py-2 text-left font-body text-xs hover:bg-[var(--bg-elevated)]" style={{ color: "var(--down)" }}>
              <LogOut className="w-3.5 h-3.5" /> Log out
            </button>
          </div>
        )}
      </div>
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
        className={`font-body text-xs px-3 py-2 rounded-[6px] transition-all duration-[120ms] ease hover:border-[var(--border-active)] ${fullWidth ? "w-full" : ""}`}
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

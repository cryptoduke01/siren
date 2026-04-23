"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useWalletTypeStore } from "@/store/useWalletTypeStore";
import { hapticLight } from "@/lib/haptics";
import { ChevronDown, Copy, LogOut, KeyRound, EyeOff } from "lucide-react";
import { API_URL } from "@/lib/apiUrl";
import { getWalletAuthHeaders } from "@/lib/requestAuth";

export function WalletButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const { connected, publicKey, evmAddress, disconnect, canExportPrivateKey, exportPrivateKey, signMessage } = useSirenWallet();
  const { setWalletType } = useWalletTypeStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [pkError, setPkError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const short = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;
  const fullAddress = publicKey?.toBase58() ?? "";

  useEffect(() => {
    if (!connected || !publicKey) return;
    const wallet = publicKey.toBase58();
    void (async () => {
      try {
        const authHeaders = await getWalletAuthHeaders({ wallet, signMessage, scope: "write" });
        await fetch(`${API_URL}/api/users/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ wallet, signupSource: "wallet" }),
        });
      } catch {
        /* ignore */
      }
    })();
  }, [connected, publicKey, signMessage]);

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

  const handleCopyAddress = (value: string) => {
    hapticLight();
    if (value) navigator.clipboard.writeText(value);
    setDropdownOpen(false);
  };

  const handleExportPrivateKey = async () => {
    hapticLight();
    setDropdownOpen(false);
    setPkError(null);
    try {
      const key = await exportPrivateKey();
      setPrivateKey(key);
    } catch (e) {
      setPkError(e instanceof Error ? e.message : "Private key export is unavailable.");
    }
  };

  if (connected && publicKey) {
    return (
      <div className={`relative ${fullWidth ? "w-full" : ""}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => { hapticLight(); setDropdownOpen((o) => !o); }}
        className={`flex h-10 items-center gap-1.5 rounded-[14px] px-3 font-body text-xs transition-all duration-[120ms] ease hover:border-[var(--border-active)] ${fullWidth ? "w-full justify-between" : ""}`}
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
            <button type="button" onClick={() => handleCopyAddress(fullAddress)} className="w-full flex items-center gap-2 px-3 py-2 text-left font-body text-xs hover:bg-[var(--bg-elevated)]" style={{ color: "var(--text-1)" }}>
              <Copy className="w-3.5 h-3.5" /> Copy Solana address
            </button>
            {evmAddress && (
              <button type="button" onClick={() => handleCopyAddress(evmAddress)} className="w-full flex items-center gap-2 px-3 py-2 text-left font-body text-xs hover:bg-[var(--bg-elevated)]" style={{ color: "var(--text-1)" }}>
                <Copy className="w-3.5 h-3.5" /> Copy EVM address
              </button>
            )}
            {canExportPrivateKey && (
              <button type="button" onClick={handleExportPrivateKey} className="w-full flex items-center gap-2 px-3 py-2 text-left font-body text-xs hover:bg-[var(--bg-elevated)]" style={{ color: "var(--text-1)" }}>
                <KeyRound className="w-3.5 h-3.5" /> Export private key
              </button>
            )}
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
        className={`h-10 rounded-[14px] px-3 font-body text-xs transition-all duration-[120ms] ease hover:border-[var(--border-active)] ${fullWidth ? "w-full" : ""}`}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          color: "var(--text-2)",
        }}
      >
        Connect
      </button>
      {(privateKey || pkError) && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full max-w-md rounded-xl border p-4" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <p className="font-heading font-semibold text-sm mb-2" style={{ color: "var(--text-1)" }}>
              Private key export
            </p>
            {pkError ? (
              <p className="font-body text-xs mb-3" style={{ color: "var(--down)" }}>{pkError}</p>
            ) : (
              <>
                <p className="font-body text-xs mb-2" style={{ color: "var(--down)" }}>
                  Keep this secret. Anyone with this key can control your wallet.
                </p>
                <p className="font-body text-[11px] mb-3" style={{ color: "var(--text-3)" }}>
                  Only export if you are moving the wallet into another trusted app. Do not paste it into websites, chats, or support messages.
                </p>
                <textarea
                  readOnly
                  value={privateKey ?? ""}
                  className="w-full h-24 rounded-lg border p-2 font-body text-xs"
                  style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
                />
                <button
                  type="button"
                  onClick={() => { if (privateKey) navigator.clipboard.writeText(privateKey); }}
                  className="mt-2 px-3 py-1.5 rounded-lg font-body text-xs"
                  style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                >
                  Copy private key
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => { setPrivateKey(null); setPkError(null); }}
              className="mt-3 w-full py-2 rounded-lg font-body text-xs inline-flex items-center justify-center gap-1.5"
              style={{ background: "var(--bg-elevated)", color: "var(--text-2)", border: "1px solid var(--border-subtle)" }}
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide
            </button>
          </div>
        </div>
      )}
    </>
  );
}

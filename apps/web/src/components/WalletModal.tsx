"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useWalletTypeStore } from "@/store/useWalletTypeStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hapticLight } from "@/lib/haptics";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { select, connect, connecting, connected, wallets } = useSirenWallet();
  const { setWalletType } = useWalletTypeStore();
  const isMobile = useIsMobile();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getWalletByKey = (key: string) =>
    wallets.find((w: { adapter?: { name?: string } }) => w.adapter?.name?.toLowerCase().includes(key));

  const walletOrder = ["phantom", "backpack", "solflare", "coinbase", "torus"];
  const prioritized = walletOrder
    .map((key) => getWalletByKey(key))
    .filter(Boolean) as (typeof wallets)[0][];
  const remaining = wallets.filter((w) => !prioritized.includes(w));
  const sortedWallets = [...prioritized, ...remaining];

  useEffect(() => {
    if (connected) onClose();
  }, [connected, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleConnect = useCallback(
    async (wallet: (typeof wallets)[0] | undefined, type: "phantom" | "solflare" | "torus" | "backpack" | "coinbase") => {
      if (!wallet) return;
      hapticLight();
      setWalletType(type);
      setErrorMessage(null);
      try {
        if (wallet.adapter.name) select(wallet.adapter.name);
        await connect();
        onClose();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unable to connect wallet.";
        setErrorMessage(
          isMobile
            ? "Could not connect in this browser. Open Siren from your wallet browser and try again."
            : msg
        );
      }
    },
    [select, connect, isMobile, setWalletType, onClose]
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="w-full max-w-md flex flex-col sm:rounded-lg sm:border sm:mb-0 sm:max-h-[90vh] overflow-hidden" style={{ borderColor: "var(--border)", minHeight: isMobile ? "70vh" : "auto" }}>
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
            <span />
            <h2 className="font-heading font-bold text-[var(--text-primary)]">Connect wallet</h2>
            <button type="button" onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1" aria-label="Close">
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-hidden">
            <div className="space-y-2">
              {sortedWallets.map((wallet) => {
                const name = wallet.adapter?.name ?? "Wallet";
                const key = name.toLowerCase();
                const isPhantom = key.includes("phantom");
                const isSolflare = key.includes("solflare");
                const desc = key.includes("torus") ? "Email or social login" : "Secure connect";
                return (
                  <WalletCard
                    key={name}
                    name={name}
                    description={desc}
                    icon={(wallet as unknown as { adapter?: { icon?: string } })?.adapter?.icon}
                    onClick={() =>
                      handleConnect(
                        wallet,
                        (isPhantom ? "phantom" : isSolflare ? "solflare" : key.includes("torus") ? "torus" : key.includes("backpack") ? "backpack" : "coinbase")
                      )
                    }
                    disabled={connecting}
                  />
                );
              })}
              {errorMessage && (
                <p className="font-body text-xs mt-3" style={{ color: "var(--down)" }}>
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function getWalletFallbackLogo(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("phantom")) return "https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/phantom.svg";
  if (lower.includes("solflare")) return "https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/solflare.svg";
  if (lower.includes("backpack")) return "https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/backpack.svg";
  if (lower.includes("coinbase")) return "https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/coinbase.svg";
  if (lower.includes("torus")) return "https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/torus.svg";
  return "";
}

function WalletCard({ name, description, icon, onClick, disabled }: { name: string; description: string; icon?: string; onClick: () => void; disabled?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const logo = !imgError ? (icon || getWalletFallbackLogo(name)) : "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-all duration-150 hover:border-[var(--border-active)] disabled:opacity-50"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
        {logo ? (
          <img src={logo} alt={name} className="w-6 h-6 object-contain" onError={() => setImgError(true)} />
        ) : (
          <span className="font-heading font-bold text-[var(--accent-primary)] text-lg">{name[0]}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="text-xs text-[var(--text-secondary)] truncate">{description}</p>
      </div>
    </button>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useWalletTypeStore } from "@/store/useWalletTypeStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hapticLight } from "@/lib/haptics";

const PHANTOM_APP_STORE = "https://apps.apple.com/app/phantom-solana-wallet/id1598432977";
const PHANTOM_PLAY_STORE = "https://play.google.com/store/apps/details?id=app.phantom";
const SOLFLARE_APP_STORE = "https://apps.apple.com/app/solflare-wallet/id1580902717";
const SOLFLARE_PLAY_STORE = "https://play.google.com/store/apps/details?id=com.solflare.mobile";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { select, connect, connecting, connected, wallets } = useSirenWallet();
  const { setWalletType } = useWalletTypeStore();
  const isMobile = useIsMobile();
  const [step, setStep] = useState<"list" | "mobile-install">("list");
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  const getWalletByKey = (key: string) =>
    wallets.find((w: { adapter?: { name?: string } }) => w.adapter?.name?.toLowerCase().includes(key));

  const walletOrder = ["phantom", "backpack", "solflare", "coinbase", "torus"];
  const sortedWallets = walletOrder
    .map((key) => getWalletByKey(key))
    .filter(Boolean) as (typeof wallets)[0][];

  useEffect(() => {
    if (connected) onClose();
  }, [connected, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setStep("list");
      setSelectedWalletId(null);
    }
  }, [isOpen]);

  const handleConnect = useCallback(
    async (wallet: (typeof wallets)[0] | undefined, type: "phantom" | "solflare" | "torus" | "backpack" | "coinbase") => {
      if (!wallet) return;
      hapticLight();
      setWalletType(type);

      if (type === "phantom" && isMobile) {
        const isPhantom = typeof window !== "undefined" && (window as unknown as { phantom?: { solana?: unknown } }).phantom?.solana;
        if (!isPhantom) {
          setStep("mobile-install");
          setSelectedWalletId("phantom");
          return;
        }
      }

      if (type === "solflare" && isMobile) {
        const isSolflare = typeof window !== "undefined" && (window as unknown as { solflare?: { isSolflare?: boolean } }).solflare?.isSolflare;
        if (!isSolflare) {
          setStep("mobile-install");
          setSelectedWalletId("solflare");
          return;
        }
      }

      if (wallet.adapter.name) select(wallet.adapter.name);
      connect().catch(console.error);
      onClose();
    },
    [select, connect, isMobile, setWalletType, onClose]
  );

  const handleBack = () => {
    setStep("list");
    setSelectedWalletId(null);
  };

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
            {step !== "list" ? (
              <button type="button" onClick={handleBack} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors font-heading font-semibold text-sm">
                Back
              </button>
            ) : (
              <span />
            )}
            <h2 className="font-heading font-bold text-[var(--text-primary)]">Connect wallet</h2>
            <button type="button" onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors p-1" aria-label="Close">
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-hidden">
            {step === "list" && (
              <div className="space-y-2">
                {sortedWallets.map((wallet) => {
                  const name = wallet.adapter?.name ?? "Wallet";
                  const key = name.toLowerCase();
                  const isPhantom = key.includes("phantom");
                  const isSolflare = key.includes("solflare");
                  const desc =
                    isPhantom || isSolflare
                      ? isMobile
                        ? "Tap to connect or get the app"
                        : "Browser extension"
                      : key.includes("torus")
                        ? "Email or social login"
                        : "Browser extension";
                  return (
                    <WalletCard
                      key={name}
                      name={name}
                      description={desc}
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
              </div>
            )}

            {step === "mobile-install" && selectedWalletId === "phantom" && (
              <div className="space-y-4">
                <p className="text-[var(--text-secondary)] text-sm">Get Phantom to connect on mobile:</p>
                <a href={PHANTOM_APP_STORE} target="_blank" rel="noopener noreferrer" className="block w-full p-4 rounded-lg border text-center font-heading font-semibold transition-colors" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--accent-primary)" }}>
                  Download Phantom from App Store
                </a>
                <a href={PHANTOM_PLAY_STORE} target="_blank" rel="noopener noreferrer" className="block w-full p-4 rounded-lg border text-center font-heading font-semibold transition-colors" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--accent-primary)" }}>
                  Download Phantom from Play Store
                </a>
                <p className="text-[var(--text-tertiary)] text-xs">After installing, return here and connect.</p>
              </div>
            )}

            {step === "mobile-install" && selectedWalletId === "solflare" && (
              <div className="space-y-4">
                <p className="text-[var(--text-secondary)] text-sm">Get Solflare to connect on mobile:</p>
                <a href={SOLFLARE_APP_STORE} target="_blank" rel="noopener noreferrer" className="block w-full p-4 rounded-lg border text-center font-heading font-semibold transition-colors" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--accent-primary)" }}>
                  Download Solflare from App Store
                </a>
                <a href={SOLFLARE_PLAY_STORE} target="_blank" rel="noopener noreferrer" className="block w-full p-4 rounded-lg border text-center font-heading font-semibold transition-colors" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--accent-primary)" }}>
                  Download Solflare from Play Store
                </a>
                <p className="text-[var(--text-tertiary)] text-xs">After installing, return here and connect.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function WalletCard({ name, description, onClick, disabled }: { name: string; description: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-all duration-150 hover:border-[var(--border-active)] disabled:opacity-50"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--bg-elevated)" }}>
        <span className="font-heading font-bold text-[var(--accent-primary)] text-lg">{name[0]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="text-xs text-[var(--text-secondary)] truncate">{description}</p>
      </div>
    </button>
  );
}

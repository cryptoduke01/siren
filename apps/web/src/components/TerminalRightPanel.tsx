"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { SignalHistoryPanel } from "./SignalHistoryPanel";

import { API_URL } from "@/lib/apiUrl";

function formatUsd(usd: number) {
  return usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TerminalRightPanel() {
  const { connected, publicKey } = useSirenWallet();
  const { connection } = useConnection();

  const { data: solPriceUsd = 0 } = useQuery({
    queryKey: ["terminal-sol-price"],
    queryFn: () =>
      fetch(`${API_URL}/api/sol-price`, { credentials: "omit" }).then((r) => r.json()).then((j) => j.usd ?? 0),
    staleTime: 60_000,
  });

  const { data: solBalanceLamports = 0 } = useQuery({
    queryKey: ["terminal-sol-balance", publicKey?.toBase58()],
    enabled: connected && !!publicKey,
    queryFn: async () => {
      if (!publicKey) return 0;
      return connection.getBalance(publicKey as PublicKey);
    },
    staleTime: 15_000,
  });

  const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;

  return (
    <div
      className="right-panel flex flex-col overflow-y-auto"
      style={{
        borderLeft: "1px solid var(--border-subtle)",
        background: "var(--bg-base)",
      }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-sm" style={{ color: "var(--text-1)" }}>
              Portfolio
            </h3>
            <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
              Balance snapshot
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-dim)" }}
          >
            <span className="font-mono text-xs" style={{ color: "var(--accent)" }}>
              SOL
            </span>
          </div>
        </div>

        {!connected || !publicKey ? (
          <p className="font-body text-xs mt-3" style={{ color: "var(--text-3)" }}>
            Connect wallet to view balance.
          </p>
        ) : (
          <div className="mt-3 rounded-[12px] border p-4" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                  Native SOL
                </p>
                <p className="font-mono text-2xl tabular-nums" style={{ color: "var(--accent)" }}>
                  {solBalance.toFixed(4)} SOL
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                  ≈ USD
                </p>
                {solPriceUsd > 0 ? (
                  <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-2)" }}>
                    ${formatUsd(solBalance * solPriceUsd)}
                  </p>
                ) : (
                  <p className="font-mono text-sm tabular-nums" style={{ color: "var(--text-3)" }}>
                    —
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <SignalHistoryPanel />
        </div>
      </div>
    </div>
  );
}


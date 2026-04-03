"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useSirenWallet } from "@/contexts/SirenWalletContext";

import { API_URL } from "@/lib/apiUrl";

export function NavbarBalance() {
  const { connected, publicKey } = useSirenWallet();
  const { connection } = useConnection();

  const { data: solPriceUsd = 0 } = useQuery({
    queryKey: ["navbar-sol-price"],
    queryFn: () =>
      fetch(`${API_URL}/api/sol-price`, { credentials: "omit" }).then((r) => r.json()).then((j) => j.usd ?? 0),
    staleTime: 60_000,
  });

  const { data: lamports = 0 } = useQuery({
    queryKey: ["navbar-balance", publicKey?.toBase58()],
    enabled: connected && !!publicKey,
    queryFn: async () => {
      if (!publicKey) return 0;
      return connection.getBalance(publicKey as PublicKey);
    },
    staleTime: 15_000,
  });

  if (!connected || !publicKey) return null;

  const sol = lamports / LAMPORTS_PER_SOL;
  const usd = solPriceUsd > 0 ? sol * solPriceUsd : null;

  return (
    <div
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-2)",
      }}
    >
      <span style={{ color: "var(--accent)" }}>{sol.toFixed(2)} SOL</span>
      {usd != null && (
        <span style={{ color: "var(--text-3)" }}>≈${usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
      )}
    </div>
  );
}

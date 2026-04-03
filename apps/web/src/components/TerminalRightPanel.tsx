"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Activity, Wallet2 } from "lucide-react";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { fetchSolPriceUsd, formatUsd, SOL_PRICE_QUERY_KEY } from "@/lib/pricing";
import { SignalHistoryPanel } from "./SignalHistoryPanel";
import { API_URL } from "@/lib/apiUrl";

function truncateAddress(addr: string, len = 6) {
  if (!addr || addr.length < len * 2) return addr;
  return `${addr.slice(0, len)}…${addr.slice(-len)}`;
}

export function TerminalRightPanel() {
  const { connected, publicKey } = useSirenWallet();
  const { connection } = useConnection();

  const { data: solPriceUsd = 0 } = useQuery({
    queryKey: SOL_PRICE_QUERY_KEY,
    queryFn: () => fetchSolPriceUsd(API_URL),
    staleTime: 120_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
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
  const walletAddress = publicKey?.toBase58() ?? null;
  const walletValueUsd = solPriceUsd > 0 ? solBalance * solPriceUsd : null;
  const isLive = connected && !!walletAddress;

  return (
    <aside className="right-panel hidden min-h-0 2xl:flex">
      <div className="flex h-full min-h-0 w-full flex-col py-5 pr-5">
        <div
          className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border"
          style={{
            borderColor: "color-mix(in srgb, var(--border-subtle) 88%, transparent)",
            background:
              "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 12%, transparent), transparent 34%), linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
            boxShadow: "0 28px 64px -40px rgba(0, 0, 0, 0.8)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 100%)",
            }}
            aria-hidden
          />

          <div className="relative flex flex-1 min-h-0 flex-col overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>
                  Terminal Pulse
                </p>
                <h3 className="mt-2 font-heading text-xl font-semibold" style={{ color: "var(--text-1)" }}>
                  Wallet + Signals
                </h3>
                <p className="mt-1 font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
                  Native SOL, live USD conversion, and recent activity in one place.
                </p>
              </div>

              <div
                className="inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  borderColor: isLive ? "color-mix(in srgb, var(--up) 32%, transparent)" : "var(--border-subtle)",
                  background: isLive ? "color-mix(in srgb, var(--up) 12%, transparent)" : "var(--bg-elevated)",
                  color: isLive ? "var(--up)" : "var(--text-3)",
                }}
              >
                {isLive ? "Live" : "Idle"}
              </div>
            </div>

            {!walletAddress ? (
              <div
                className="mt-5 rounded-[20px] border border-dashed p-5"
                style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-elevated) 84%, transparent)" }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                >
                  <Wallet2 className="h-5 w-5" />
                </div>
                <p className="mt-4 font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                  Connect your wallet to turn this on.
                </p>
                <p className="mt-2 font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
                  Once connected, Siren will show your native SOL balance, current USD conversion, and the latest alert activity.
                </p>
              </div>
            ) : (
              <>
                <div
                  className="mt-5 rounded-[20px] border p-5"
                  style={{
                    borderColor: "color-mix(in srgb, var(--accent) 16%, var(--border-subtle))",
                    background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 90%, transparent), var(--bg-base))",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                        Native SOL
                      </p>
                      <p className="mt-1 font-body text-xs" style={{ color: "var(--text-3)" }}>
                        Wallet {truncateAddress(walletAddress)}
                      </p>
                    </div>
                    <div
                      className="inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        borderColor: "color-mix(in srgb, var(--accent) 24%, transparent)",
                        background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                        color: "var(--accent)",
                      }}
                    >
                      Realtime
                    </div>
                  </div>

                  <p className="mt-4 font-heading text-[2rem] font-bold tracking-tight tabular-nums" style={{ color: "var(--accent)" }}>
                    {solBalance.toFixed(4)} <span className="text-lg font-medium" style={{ color: "var(--text-2)" }}>SOL</span>
                  </p>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                      <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                        Wallet value
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
                        {walletValueUsd != null ? `$${formatUsd(walletValueUsd)}` : "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                      <p className="font-body text-[11px]" style={{ color: "var(--text-3)" }}>
                        1 SOL
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold tabular-nums" style={{ color: "var(--text-1)" }}>
                        {solPriceUsd > 0 ? `$${formatUsd(solPriceUsd)}` : "Loading…"}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-4 rounded-[20px] border p-4"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "color-mix(in srgb, var(--bg-elevated) 88%, transparent)",
                  }}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                        Signal Watch
                      </p>
                      <p className="mt-1 font-body text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
                        Thresholds and momentum triggers that fired recently.
                      </p>
                    </div>
                    <Activity className="h-4 w-4 shrink-0" style={{ color: "var(--text-3)" }} />
                  </div>
                  <SignalHistoryPanel variant="panel" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

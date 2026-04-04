"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Trophy, Target, DollarSign, ArrowLeft, Loader2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { API_URL } from "@/lib/apiUrl";
import { hapticLight } from "@/lib/haptics";

interface LeaderboardEntry {
  rank: number;
  id: string;
  label: string;
  subtitle?: string;
  volumeUsd: number;
  tradeCount: number;
  winRate: number | null;
  wins: number;
  losses: number;
  avatarUrl?: string | null;
}

function fmtVol(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function PodiumCard({
  entry,
  place,
  metric,
}: {
  entry: LeaderboardEntry | undefined;
  place: 1 | 2 | 3;
  metric: "volume" | "winRate";
}) {
  const border =
    place === 1 ? "#d4a20d" : place === 2 ? "#9ca3af" : "#b45309";
  const scale = place === 1 ? "scale-105" : "scale-100";
  const order = place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3";

  if (!entry) {
    return (
      <div
        className={`flex-1 min-w-[100px] max-w-[140px] rounded-xl border border-dashed p-4 ${order} ${scale}`}
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
      />
    );
  }

  const main =
    metric === "winRate"
      ? entry.winRate != null
        ? `${entry.winRate.toFixed(0)}%`
        : "—"
      : fmtVol(entry.volumeUsd);
  const subSecondary =
    metric === "winRate"
      ? fmtVol(entry.volumeUsd)
      : entry.winRate != null
        ? `${entry.winRate.toFixed(0)}% win rate`
        : "Win rate —";
  const sub = `${subSecondary} · ${entry.tradeCount} trades`;

  return (
    <div
      className={`flex-1 min-w-[100px] max-w-[160px] rounded-xl border-2 p-4 flex flex-col items-center text-center ${order} ${scale} transition-transform`}
      style={{ borderColor: border, background: "var(--bg-surface)" }}
    >
      {entry.avatarUrl ? (
        <img
          src={entry.avatarUrl}
          alt=""
          className="h-14 w-14 rounded-full object-cover mb-2"
          style={{ boxShadow: `0 0 0 2px ${border}` }}
        />
      ) : (
        <div
          className="h-14 w-14 rounded-full mb-2 flex items-center justify-center font-heading text-lg font-bold"
          style={{ background: "var(--bg-elevated)", boxShadow: `0 0 0 2px ${border}`, color: "var(--text-2)" }}
        >
          {entry.label.slice(0, 2).toUpperCase()}
        </div>
      )}
      <p className="font-heading text-xs font-semibold truncate w-full" style={{ color: "var(--text-1)" }}>
        {entry.label}
      </p>
      <p className="font-money text-lg font-bold mt-1 tabular-nums" style={{ color: "var(--accent)" }}>
        {main}
      </p>
      <p className="font-sub text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>
        {sub}
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  const [windowKey, setWindowKey] = useState<"7d" | "30d" | "all">("7d");
  const [metric, setMetric] = useState<"volume" | "winRate">("volume");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["leaderboard", windowKey, metric],
    queryFn: async () => {
      const qs = new URLSearchParams({
        window: windowKey === "all" ? "all" : windowKey,
        metric,
      });
      const res = await fetch(`${API_URL}/api/leaderboard?${qs}`, { credentials: "omit" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to load leaderboard");
      }
      return payload as {
        success: boolean;
        data: {
          entries: LeaderboardEntry[];
          emptyReason?: string;
          metric: string;
          truncated?: boolean;
          scope?: string;
        };
      };
    },
    staleTime: 60_000,
  });

  const entries = data?.data?.entries ?? [];
  const emptyReason = data?.data?.emptyReason;

  const podium = useMemo(() => {
    const a = entries[0];
    const b = entries[1];
    const c = entries[2];
    return { first: a, second: b, third: c, rest: entries.slice(3) };
  }, [entries]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <TopBar />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-16 pt-4 md:pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-sub text-xs mb-5"
          style={{ color: "var(--text-3)" }}
          onClick={() => hapticLight()}
        >
          <ArrowLeft className="h-3 w-3" /> Terminal
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-6 w-6" style={{ color: "#d4a20d" }} />
          <h1 className="font-heading text-xl font-bold tracking-tight" style={{ color: "var(--text-1)" }}>
            Leaderboard
          </h1>
        </div>
        <p className="font-sub text-sm mb-6 leading-relaxed" style={{ color: "var(--text-3)" }}>
          See who is trading best in Siren. Only market trades count here. Token swaps do not.
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setWindowKey("7d");
            }}
            className="rounded-md px-3 py-1.5 font-sub text-xs font-medium"
            style={{
              background: windowKey === "7d" ? "var(--accent)" : "var(--bg-elevated)",
              color: windowKey === "7d" ? "var(--accent-text)" : "var(--text-3)",
            }}
          >
            7 days
          </button>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setWindowKey("30d");
            }}
            className="rounded-md px-3 py-1.5 font-sub text-xs font-medium"
            style={{
              background: windowKey === "30d" ? "var(--accent)" : "var(--bg-elevated)",
              color: windowKey === "30d" ? "var(--accent-text)" : "var(--text-3)",
            }}
          >
            30 days
          </button>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setWindowKey("all");
            }}
            className="rounded-md px-3 py-1.5 font-sub text-xs font-medium"
            style={{
              background: windowKey === "all" ? "var(--accent)" : "var(--bg-elevated)",
              color: windowKey === "all" ? "var(--accent-text)" : "var(--text-3)",
            }}
          >
            All time
          </button>
        </div>

        <div
          className="flex rounded-lg border p-0.5 mb-6"
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
        >
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setMetric("winRate");
            }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 font-heading text-[11px] font-semibold"
            style={{
              background: metric === "winRate" ? "var(--bg-surface)" : "transparent",
              color: metric === "winRate" ? "var(--accent)" : "var(--text-3)",
            }}
          >
            <Target className="h-3.5 w-3.5" />
            Sort by win rate
          </button>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setMetric("volume");
            }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 font-heading text-[11px] font-semibold"
            style={{
              background: metric === "volume" ? "var(--bg-surface)" : "transparent",
              color: metric === "volume" ? "var(--accent)" : "var(--text-3)",
            }}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Sort by volume
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        )}

        {isError && (
          <p className="font-body text-sm py-8 text-center" style={{ color: "var(--down)" }}>
            {error instanceof Error ? error.message : "Could not load leaderboard"}
          </p>
        )}

        {!isLoading && !isError && data?.data?.truncated && (
          <p className="font-sub text-[11px] mb-4 leading-relaxed rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-subtle)", color: "var(--text-3)", background: "var(--bg-elevated)" }}>
            All-time rankings use the latest slice of trade history (performance cap). Use 7d or 30d for a complete window.
          </p>
        )}

        {!isLoading && !isError && entries.length === 0 && (
          <p className="font-body text-sm py-8 text-center leading-relaxed" style={{ color: "var(--text-3)" }}>
            {emptyReason || "No data for this view yet."}
          </p>
        )}

        {!isLoading && !isError && entries.length > 0 && (
          <>
            <p className="font-sub text-[10px] uppercase tracking-widest mb-3" style={{ color: "var(--text-3)" }}>
              Top 3
            </p>
            <div className="flex items-end justify-center gap-2 md:gap-4 mb-8 px-1">
              <PodiumCard entry={podium.second} place={2} metric={metric} />
              <PodiumCard entry={podium.first} place={1} metric={metric} />
              <PodiumCard entry={podium.third} place={3} metric={metric} />
            </div>

            {podium.rest.length > 0 && (
              <>
                <p className="font-sub text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text-3)" }}>
                  Rankings
                </p>
                <ul className="space-y-2">
                  {podium.rest.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 rounded-xl border px-3 py-3"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                    >
                      <span className="font-money text-sm tabular-nums w-6 shrink-0" style={{ color: "var(--text-3)" }}>
                        {e.rank}
                      </span>
                      {e.avatarUrl ? (
                        <img src={e.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center font-heading text-xs font-bold"
                          style={{ background: "var(--bg-elevated)", color: "var(--text-2)" }}
                        >
                          {e.label.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-sm font-semibold truncate" style={{ color: "var(--text-1)" }}>
                          {e.label}
                        </p>
                        <p className="font-sub text-[11px]" style={{ color: "var(--text-3)" }}>
                          {fmtVol(e.volumeUsd)} volume
                          {e.winRate != null && (
                            <span>
                              {" · "}
                              {e.winRate.toFixed(0)}% ({e.wins}W / {e.losses}L)
                            </span>
                          )}
                          {" · "}
                          {e.tradeCount} trades
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-money text-base font-bold tabular-nums" style={{ color: "var(--accent)" }}>
                          {metric === "winRate"
                            ? e.winRate != null
                              ? `${e.winRate.toFixed(0)}%`
                              : "—"
                            : fmtVol(e.volumeUsd)}
                        </p>
                        <p className="font-sub text-[9px]" style={{ color: "var(--text-3)" }}>
                          {metric === "winRate" ? "win rate (sorted)" : "volume (sorted)"}
                        </p>
                        <p className="font-sub text-[9px] mt-0.5 tabular-nums" style={{ color: "var(--text-3)" }}>
                          {metric === "winRate" ? fmtVol(e.volumeUsd) : e.winRate != null ? `${e.winRate.toFixed(0)}% WR` : "—"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

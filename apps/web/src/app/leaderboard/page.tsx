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
  attemptCount?: number;
  winRate: number | null;
  successRate?: number | null;
  executionScore?: number | null;
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
  metric: "volume" | "winRate" | "execution";
}) {
  const border =
    place === 1 ? "#d4a20d" : place === 2 ? "#9ca3af" : "#b45309";
  const glow =
    place === 1 ? "0 24px 60px rgba(212,162,13,0.14)" : place === 2 ? "0 18px 42px rgba(156,163,175,0.10)" : "0 18px 42px rgba(180,83,9,0.10)";

  if (!entry) {
    return (
      <div
        className="rounded-[28px] border border-dashed p-5"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
      />
    );
  }

  const main =
    metric === "execution"
      ? entry.executionScore != null
        ? `${entry.executionScore.toFixed(0)}`
        : "—"
      : metric === "winRate"
      ? entry.winRate != null
        ? `${entry.winRate.toFixed(0)}%`
        : "—"
      : fmtVol(entry.volumeUsd);
  const subSecondary =
    metric === "execution"
      ? entry.successRate != null
        ? `${entry.successRate.toFixed(0)}% clean routing`
        : "No execution score yet"
      : metric === "winRate"
      ? fmtVol(entry.volumeUsd)
      : entry.winRate != null
        ? `${entry.winRate.toFixed(0)}% win rate`
        : "Win rate —";

  return (
    <div
      className="rounded-[30px] border p-5 text-left transition-transform"
      style={{
        borderColor: border,
        background:
          place === 1
            ? "linear-gradient(180deg, color-mix(in srgb, #d4a20d 12%, var(--bg-surface)), var(--bg-surface))"
            : "linear-gradient(180deg, color-mix(in srgb, var(--accent) 4%, var(--bg-surface)), var(--bg-surface))",
        boxShadow: glow,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {entry.avatarUrl ? (
            <img
              src={entry.avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover shrink-0"
              style={{ boxShadow: `0 0 0 2px ${border}` }}
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-heading text-lg font-bold"
              style={{ background: "var(--bg-elevated)", boxShadow: `0 0 0 2px ${border}`, color: "var(--text-2)" }}
            >
              {entry.label.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
              Rank #{entry.rank}
            </p>
            <p className="mt-1 truncate font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
              {entry.label}
            </p>
            {entry.subtitle && (
              <p className="mt-1 truncate font-sub text-[11px]" style={{ color: "var(--text-3)" }}>
                {entry.subtitle}
              </p>
            )}
          </div>
        </div>
        <div
          className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 font-heading text-sm font-semibold"
          style={{ borderColor: border, color: border }}
        >
          {place}
        </div>
      </div>

      <p className="mt-6 font-money text-[2rem] font-bold tabular-nums leading-none" style={{ color: place === 1 ? "#d4a20d" : "var(--accent)" }}>
        {main}
      </p>
      <p className="mt-2 font-sub text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        {subSecondary}
      </p>
      <p className="mt-3 font-sub text-[11px]" style={{ color: "var(--text-3)" }}>
        {entry.attemptCount ?? entry.tradeCount} attempts · {entry.tradeCount} trades
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  const [windowKey, setWindowKey] = useState<"7d" | "30d" | "all">("7d");
  const [metric, setMetric] = useState<"execution" | "volume" | "winRate">("execution");

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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4 md:px-6 md:pt-6">
        <Link
          href="/terminal"
          className="inline-flex items-center gap-1.5 font-sub text-xs mb-5"
          style={{ color: "var(--text-3)" }}
          onClick={() => hapticLight()}
        >
          <ArrowLeft className="h-3 w-3" /> Terminal
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-6 w-6" style={{ color: "#d4a20d" }} />
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl" style={{ color: "var(--text-1)" }}>
            Leaderboard
          </h1>
        </div>
        <p className="max-w-3xl font-sub text-sm mb-6 leading-relaxed md:text-base" style={{ color: "var(--text-3)" }}>
          See who is actually executing well in Siren. This board now favors clean fills, close discipline, and real prediction-market trading quality over vanity size.
        </p>

        <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div
            className="grid grid-cols-3 gap-2 rounded-[24px] border p-2"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
          >
            {([
              ["7d", "7 days"],
              ["30d", "30 days"],
              ["all", "All time"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  hapticLight();
                  setWindowKey(value);
                }}
                className="min-h-12 rounded-2xl px-3 py-2 font-sub text-xs font-semibold"
                style={{
                  background: windowKey === value ? "var(--accent)" : "transparent",
                  color: windowKey === value ? "var(--accent-text)" : "var(--text-3)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className="grid gap-2 rounded-[24px] border p-2 sm:grid-cols-2"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
          >
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setMetric("execution");
              }}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-2 font-heading text-[12px] font-semibold"
              style={{
                background: metric === "execution" ? "var(--bg-surface)" : "transparent",
                color: metric === "execution" ? "var(--accent)" : "var(--text-3)",
              }}
            >
              <Target className="h-4 w-4" />
              Sort by execution
            </button>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setMetric("volume");
              }}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-2 font-heading text-[12px] font-semibold"
              style={{
                background: metric === "volume" ? "var(--bg-surface)" : "transparent",
                color: metric === "volume" ? "var(--accent)" : "var(--text-3)",
              }}
            >
              <DollarSign className="h-4 w-4" />
              Sort by volume
            </button>
          </div>
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
            <div className="grid gap-4 mb-8 md:grid-cols-3">
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
                      className="flex items-center gap-4 rounded-[24px] border px-4 py-4"
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
                        {e.subtitle && (
                          <p className="mt-1 font-sub text-[11px]" style={{ color: "var(--text-3)" }}>
                            {e.subtitle}
                          </p>
                        )}
                        <p className="mt-1 font-sub text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                          {fmtVol(e.volumeUsd)} volume
                          {e.successRate != null && (
                            <span>
                              {" · "}
                              {e.successRate.toFixed(0)}% execution
                            </span>
                          )}
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
                          {metric === "execution"
                            ? e.executionScore != null
                              ? `${e.executionScore.toFixed(0)}`
                              : "—"
                            : metric === "winRate"
                            ? e.winRate != null
                              ? `${e.winRate.toFixed(0)}%`
                              : "—"
                            : fmtVol(e.volumeUsd)}
                        </p>
                        <p className="font-sub text-[9px]" style={{ color: "var(--text-3)" }}>
                          {metric === "execution" ? "execution (sorted)" : metric === "winRate" ? "win rate (sorted)" : "volume (sorted)"}
                        </p>
                        <p className="font-sub text-[9px] mt-0.5 tabular-nums" style={{ color: "var(--text-3)" }}>
                          {metric === "execution"
                            ? e.successRate != null
                              ? `${e.successRate.toFixed(0)}% success`
                              : fmtVol(e.volumeUsd)
                            : metric === "winRate"
                              ? fmtVol(e.volumeUsd)
                              : e.winRate != null
                                ? `${e.winRate.toFixed(0)}% WR`
                                : "—"}
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

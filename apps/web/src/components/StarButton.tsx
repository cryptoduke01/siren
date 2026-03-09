"use client";

import { Star } from "lucide-react";
import { useWatchlistStore } from "@/store/useWatchlistStore";
import { hapticLight } from "@/lib/haptics";

export function StarButton({
  type,
  id,
  className = "",
}: {
  type: "market" | "token";
  id: string;
  className?: string;
}) {
  const isMarket = type === "market";
  const isStarred = isMarket
    ? useWatchlistStore((s) => s.isMarketStarred(id))
    : useWatchlistStore((s) => s.isTokenStarred(id));
  const starMarket = useWatchlistStore((s) => s.starMarket);
  const unstarMarket = useWatchlistStore((s) => s.unstarMarket);
  const starToken = useWatchlistStore((s) => s.starToken);
  const unstarToken = useWatchlistStore((s) => s.unstarToken);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    if (isMarket) {
      isStarred ? unstarMarket(id) : starMarket(id);
    } else {
      isStarred ? unstarToken(id) : starToken(id);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`p-1 rounded-[4px] transition-colors duration-[120ms] ease hover:bg-[var(--bg-hover)] ${className}`}
      style={{ color: isStarred ? "var(--yellow)" : "var(--text-3)" }}
      title={isStarred ? "Remove from watchlist" : "Add to watchlist"}
      aria-label={isStarred ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Star className="w-3.5 h-3.5" fill={isStarred ? "currentColor" : "none"} strokeWidth={2} />
    </button>
  );
}

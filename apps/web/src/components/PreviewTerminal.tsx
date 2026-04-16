"use client";

/** Mock terminal for waitlist preview — no API calls, avoids rate limits. */

const MOCK_MARKETS = [
  { ticker: "TRUMPWIN", title: "Trump wins 2024 election", probability: 58, velocity: 2.1 },
  { ticker: "FEDCUT", title: "Fed cuts rates in Dec", probability: 72, velocity: -0.8 },
  { ticker: "BTCA100K", title: "Bitcoin above $100k by EOY", probability: 34, velocity: 1.2 },
  { ticker: "SOL5", title: "Solana above $500", probability: 22, velocity: 3.4 },
];

const MOCK_TOKENS = [
  { symbol: "JPOW", name: "JPOW", price: 0.0023, vol: "12.4K" },
  { symbol: "TRUMP", name: "Trump Coin", price: 0.0018, vol: "8.2K" },
  { symbol: "BONK", name: "Bonk Inu", price: 0.00004, vol: "1.2M" },
];

export function PreviewTerminal() {
  return (
    <div className="flex h-[260px] min-h-[260px] w-full">
      <aside className="w-[140px] flex-shrink-0 overflow-hidden flex flex-col" style={{ background: "var(--bg-base)", borderRight: "1px solid var(--border-subtle)" }}>
        <div className="flex-shrink-0 px-2 pt-2 pb-1">
          <h2 className="font-heading font-semibold text-[10px]" style={{ letterSpacing: "0.1em", color: "var(--text-3)" }}>
            MARKETS
          </h2>
        </div>
        <div className="flex-shrink-0 px-2 pb-1">
          <input
            type="text"
            placeholder="Search..."
            readOnly
            className="w-full font-body text-[10px] h-6 px-2 rounded-[4px] border"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
          />
        </div>
        <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden px-1.5 pb-1 space-y-1">
          {MOCK_MARKETS.map((m) => (
            <li
              key={m.ticker}
              className="rounded-[4px] p-1.5 flex-shrink-0"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
            >
              <p className="font-body text-[10px] truncate mb-0.5" style={{ color: "var(--text-1)" }}>
                {m.title}
              </p>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[9px] tabular-nums" style={{ color: "var(--accent)" }}>
                  {m.probability}%
                </span>
                <span className="font-mono text-[9px] tabular-nums" style={{ color: m.velocity >= 0 ? "var(--up)" : "var(--down)" }}>
                  {m.velocity >= 0 ? "+" : ""}{m.velocity}%/hr
                </span>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden p-2" style={{ background: "var(--bg-void)" }}>
        <h2 className="font-heading font-semibold text-[11px] flex-shrink-0 mb-1.5" style={{ color: "var(--text-1)" }}>
          Tokens
        </h2>
        <input
          type="text"
          placeholder="Search tokens..."
          readOnly
          className="w-full font-body text-[10px] h-6 px-2 rounded-[4px] border flex-shrink-0 mb-2"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-1)" }}
        />
        <div className="grid grid-cols-3 gap-1.5 min-h-0 overflow-auto flex-1 content-start">
          {MOCK_TOKENS.map((t) => (
            <div
              key={t.symbol}
              className="rounded-[4px] p-1.5 border flex-shrink-0"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
            >
              <p className="font-heading font-bold text-[10px] truncate mb-0.5" style={{ color: "var(--text-1)" }}>
                ${t.symbol}
              </p>
              <p className="font-body text-[9px] truncate mb-0.5" style={{ color: "var(--text-2)" }}>
                {t.name}
              </p>
              <div className="flex justify-between items-center">
                <span className="font-mono text-[9px] tabular-nums" style={{ color: "var(--text-1)" }}>
                  ${t.price.toFixed(4)}
                </span>
                <span className="font-mono text-[9px] tabular-nums" style={{ color: "var(--text-3)" }}>
                  {t.vol}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

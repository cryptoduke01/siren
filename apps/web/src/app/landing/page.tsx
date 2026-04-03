import Link from "next/link";

export const metadata = {
  title: "Siren — Event-Driven Meme Token Terminal",
  description:
    "Siren is an event-driven meme token terminal. Watch Kalshi prediction markets, surface Bags tokens tied to real-world events, and trade with MEV-safe swaps.",
};

export default function LandingPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-12"
      style={{ background: "var(--bg-void)" }}
    >
      <main className="max-w-2xl mx-auto text-center">
        <h1
          className="font-heading font-bold text-4xl md:text-5xl mb-4"
          style={{ color: "var(--text-1)" }}
        >
          Siren
        </h1>
        <p
          className="font-body text-lg mb-6"
          style={{ color: "var(--text-2)" }}
        >
          Event-driven meme token terminal. Watch Kalshi prediction markets,
          surface Bags tokens tied to real-world events, and trade with
          MEV-safe swaps.
        </p>
        <ul className="font-body text-sm text-left max-w-md mx-auto mb-10 space-y-2" style={{ color: "var(--text-2)" }}>
          <li>• Live Kalshi market data</li>
          <li>• Token surfacing for real-world events</li>
          <li>• Bags launches with creator fee-sharing</li>
          <li>• MEV-protected swaps via Jupiter</li>
        </ul>
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Link
            href="/waitlist"
            className="px-6 py-3 rounded-xl font-heading font-semibold text-sm uppercase tracking-wider transition-colors"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            Join Waitlist
          </Link>
          <Link
            href="https://docs.onsiren.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl font-heading font-semibold text-sm uppercase tracking-wider border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-1)" }}
          >
            Docs
          </Link>
        </div>
        <footer className="flex flex-wrap justify-center gap-6 text-sm">
          <Link href="/privacy" className="underline" style={{ color: "var(--text-2)" }}>
            Privacy Policy
          </Link>
          <Link href="/terms" className="underline" style={{ color: "var(--text-2)" }}>
            Terms of Service
          </Link>
        </footer>
      </main>
    </div>
  );
}

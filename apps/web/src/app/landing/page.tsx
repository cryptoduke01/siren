import Link from "next/link";

export const metadata = {
  title: "Siren | Execution and risk intelligence for prediction markets",
  description:
    "Execution and risk intelligence for prediction traders. Kalshi and Polymarket signals, Solana execution, and portfolio context in one place.",
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
          Execution and risk intelligence for prediction traders. Live Kalshi and Polymarket signals,
          Solana execution with clearer routes and outcomes, and portfolio context in one terminal.
        </p>
        <ul className="font-body text-sm text-left max-w-md mx-auto mb-10 space-y-2" style={{ color: "var(--text-2)" }}>
          <li>• Live Kalshi + Polymarket signal feed</li>
          <li>• Prediction execution with route context</li>
          <li>• Portfolio and activity in one place</li>
          <li>• Privy social onboarding with embedded wallets</li>
          <li>• DFlow-first execution on supported outcomes</li>
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

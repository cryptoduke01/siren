import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Privacy Policy — Siren",
  description:
    "Privacy Policy for Siren. Learn how we collect, use, and protect your information.",
};

export default function PrivacyPage() {
  const effectiveDate = "March 11, 2026";
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 px-5 py-10">
        <div
          className="max-w-3xl mx-auto rounded-2xl border p-6 md:p-8"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <h1 className="font-heading font-bold text-2xl mb-2" style={{ color: "var(--text-1)" }}>
            Privacy Policy
          </h1>
          <p className="font-body text-xs mb-8" style={{ color: "var(--text-3)" }}>
            Effective date: {effectiveDate}
          </p>

          <div className="prose prose-invert max-w-none">
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              This Privacy Policy explains how Siren (&quot;we&quot;, &quot;us&quot;) collects, uses, and shares information when you use the
              Service.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>
              Information we collect
            </h2>
            <ul className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              <li>
                <strong>Account and login info:</strong> when you log in, we receive an identifier from your login provider
                (wallet address and/or OAuth provider user ID). If you sign in with Google/GitHub/X, we may receive basic
                profile information such as a display name or username.
              </li>
              <li>
                <strong>Waitlist info:</strong> if you join the waitlist, we collect your email and optional name/wallet.
              </li>
              <li>
                <strong>Usage and device info:</strong> basic diagnostics such as timestamps, pages viewed, and coarse
                location signals (e.g. country) for compliance and abuse prevention.
              </li>
              <li>
                <strong>On-chain data:</strong> public blockchain data associated with wallet addresses you use with the
                Service.
              </li>
            </ul>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>
              How we use information
            </h2>
            <ul className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              <li>Provide and secure the Service (auth, access gating, fraud prevention).</li>
              <li>Send onboarding and access-code emails when requested.</li>
              <li>Operate features that require third-party APIs (quotes, swaps, market data).</li>
              <li>Comply with legal and regulatory requirements, including jurisdiction-based restrictions.</li>
            </ul>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>
              How we share information
            </h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              We share information with service providers to run Siren, such as: authentication (Privy), email delivery
              (Resend), data and infrastructure providers (e.g. RPC providers like Helius), and trading/quote providers
              (e.g. DFlow, Jupiter, Bags). These providers process information under their own terms and policies. We do
              not sell your personal information.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>
              Data retention
            </h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              We retain information for as long as needed to provide the Service and comply with legal obligations. You
              may request deletion of waitlist information by contacting us.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>
              Security
            </h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              We take reasonable measures to protect information. No method of transmission or storage is 100% secure.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>
              Changes
            </h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              We may update this Policy from time to time. Continued use of the Service after updates become effective
              indicates acceptance.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Link href="/terms" className="font-body text-xs underline" style={{ color: "var(--text-2)" }}>
              Terms of Service
            </Link>
            <Link href="/" className="font-body text-xs underline" style={{ color: "var(--text-2)" }}>
              Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

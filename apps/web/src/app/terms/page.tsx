"use client";

import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { hapticLight } from "@/lib/haptics";

export default function TermsPage() {
  const effectiveDate = "March 11, 2026";
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 px-5 py-10">
        <div className="max-w-3xl mx-auto rounded-2xl border p-6 md:p-8" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
          <h1 className="font-heading font-bold text-2xl mb-2" style={{ color: "var(--text-1)" }}>Terms of Service</h1>
          <p className="font-body text-xs mb-8" style={{ color: "var(--text-3)" }}>Effective date: {effectiveDate}</p>

          <div className="prose prose-invert max-w-none">
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              These Terms of Service (“Terms”) govern your access to and use of the Siren website and application (the “Service”).
              By accessing or using the Service, you agree to these Terms.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>1. Eligibility</h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              You must be able to form a binding contract in your jurisdiction. If you are using the Service on behalf of an entity,
              you represent you have authority to bind that entity.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>2. No financial advice</h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              Siren provides software and information for exploring markets and tokens. Nothing on the Service constitutes financial,
              investment, legal, or tax advice. You are solely responsible for your decisions and any transactions you initiate.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>3. Non-custodial; third-party services</h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              Siren does not custody your funds. Trades and transactions are executed using third-party protocols and infrastructure
              (for example, wallets, RPC providers, DFlow, Jupiter, Bags, and Solana). Your use of third-party services is governed
              by their terms, and they may impose additional restrictions or fees.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>4. Access codes</h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              Access to the Service may require an access code. Waitlist access codes may be single-use. We may revoke, rotate, or disable
              access codes at any time to protect the Service.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>5. Acceptable use</h2>
            <ul className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              <li>Do not attempt to interfere with or disrupt the Service.</li>
              <li>Do not reverse engineer, scrape, or abuse rate limits except as permitted by law.</li>
              <li>Do not use the Service for unlawful activity.</li>
            </ul>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>6. Intellectual property</h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              The Service, including branding, UI, and content, is owned by Siren and its licensors. We grant you a limited,
              non-exclusive, non-transferable license to use the Service for your personal or internal business use.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>7. Disclaimers</h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              The Service is provided “as is” and “as available”. We do not warrant uninterrupted or error-free operation, or that
              information is accurate or complete. Markets and on-chain data can change rapidly.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>8. Limitation of liability</h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              To the maximum extent permitted by law, Siren will not be liable for indirect, incidental, special, consequential, or
              punitive damages, or any loss of profits, data, or goodwill. Our total liability for any claim related to the Service
              will not exceed $100 USD.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>9. Termination</h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              We may suspend or terminate access to the Service at any time. You may stop using the Service at any time.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>10. Changes</h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              We may update these Terms from time to time. Continued use of the Service after changes become effective constitutes
              acceptance of the updated Terms.
            </p>

            <h2 className="font-heading font-semibold text-lg mt-8 mb-2" style={{ color: "var(--text-1)" }}>Contact</h2>
            <p className="font-body text-sm" style={{ color: "var(--text-2)" }}>
              For questions about these Terms, contact us via the links in the app footer.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Link
              href="/privacy"
              onClick={() => hapticLight()}
              className="font-body text-xs underline"
              style={{ color: "var(--text-2)" }}
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}


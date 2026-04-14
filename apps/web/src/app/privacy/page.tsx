"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10" style={{ background: "var(--bg-base)", color: "var(--text-1)" }}>
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: "var(--text-2)" }}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="font-heading text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--text-3)" }}>
          Siren stores only the minimum data needed to run trading, activity, and profile features.
        </p>

        <section className="mt-8 space-y-4 text-sm leading-6" style={{ color: "var(--text-2)" }}>
          <p>
            We may process wallet addresses, trade metadata, profile preferences, and basic device/network diagnostics to keep the app functional,
            secure, and reliable.
          </p>
          <p>
            We do not sell personal data. Some data is processed by infrastructure providers (for example, hosting, analytics, and RPC services) so
            the product can operate.
          </p>
          <p>
            By using Siren, you acknowledge that on-chain activity is public by design and may be visible on block explorers.
          </p>
        </section>
      </div>
    </main>
  );
}

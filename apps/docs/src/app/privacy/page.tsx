export default function PrivacyPage() {
  const effectiveDate = "March 11, 2026";

  return (
    <div className="docs-page">
      <section className="docs-hero">
        <p className="docs-eyebrow">Privacy</p>
        <h1>Privacy policy</h1>
        <p>Effective date: {effectiveDate}</p>
      </section>

      <section className="docs-grid">
        <article className="docs-card">
          <h2>Information we collect</h2>
          <ul>
            <li>Account and login info from your wallet or OAuth provider, such as Google or GitHub.</li>
            <li>Waitlist info including email, name, and optional wallet address.</li>
            <li>Usage diagnostics such as timestamps, market views, and coarse location signals for compliance and abuse prevention.</li>
            <li>Public blockchain data associated with wallets you use with Siren.</li>
          </ul>
        </article>
        <article className="docs-card">
          <h2>How we use it</h2>
          <ul>
            <li>Provide and secure the service, including access gating and fraud prevention.</li>
            <li>Send onboarding emails, access codes, and product updates when appropriate.</li>
            <li>Operate third-party integrations for market data, quotes, swaps, and authentication.</li>
            <li>Meet legal and regulatory obligations.</li>
          </ul>
        </article>
        <article className="docs-card">
          <h2>How we share it</h2>
          <p>
            We share information with providers that help run Siren, such as authentication, email, infrastructure, analytics, and market-data partners.
            We do not sell your personal information.
          </p>
        </article>
        <article className="docs-card">
          <h2>Retention and security</h2>
          <p>
            We keep information only as long as necessary to operate the service and meet legal obligations. We use reasonable safeguards, but no system is perfectly secure.
          </p>
        </article>
      </section>
    </div>
  );
}

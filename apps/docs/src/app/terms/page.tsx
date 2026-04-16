export default function TermsPage() {
  const effectiveDate = "March 11, 2026";

  return (
    <div className="docs-page">
      <section className="docs-hero">
        <p className="docs-eyebrow">Terms</p>
        <h1>Terms of service</h1>
        <p>Effective date: {effectiveDate}</p>
      </section>

      <section className="docs-grid">
        <article className="docs-card">
          <h2>Eligibility</h2>
          <p>You must be able to form a binding contract in your jurisdiction to use Siren.</p>
        </article>
        <article className="docs-card">
          <h2>No financial advice</h2>
          <p>
            Siren provides software and information for exploring and executing around prediction markets. Nothing on the service constitutes financial, investment, legal, or tax advice.
          </p>
        </article>
        <article className="docs-card">
          <h2>Non-custodial service</h2>
          <p>
            Siren does not custody user funds. Transactions and accounts rely on third-party services such as wallets, authentication providers, Solana, DFlow, Polymarket, and related infrastructure.
          </p>
        </article>
        <article className="docs-card">
          <h2>Acceptable use</h2>
          <ul>
            <li>Do not interfere with or disrupt the service.</li>
            <li>Do not reverse engineer or abuse rate limits.</li>
            <li>Do not use the service for unlawful activity.</li>
          </ul>
        </article>
        <article className="docs-card">
          <h2>Disclaimers</h2>
          <p>The service is provided “as is” and “as available.”</p>
        </article>
        <article className="docs-card">
          <h2>Limitation of liability</h2>
          <p>To the maximum extent permitted by law, Siren’s total liability will not exceed $100 USD.</p>
        </article>
      </section>
    </div>
  );
}

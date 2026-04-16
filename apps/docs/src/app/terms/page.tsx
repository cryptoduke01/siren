export default function TermsPage() {
  const effectiveDate = "March 11, 2026";
  return (
    <>
      <h1>Terms of Service</h1>
      <p><em>Effective date: {effectiveDate}</em></p>
      <p>
        These Terms of Service (“Terms”) govern your access to and use of the Siren website and application (the “Service”).
        By accessing or using the Service, you agree to these Terms.
      </p>
      <h2>Eligibility</h2>
      <p>You must be able to form a binding contract in your jurisdiction.</p>
      <h2>No financial advice</h2>
      <p>
        Siren provides software and information for exploring markets and tokens. Nothing on the Service constitutes financial,
        investment, legal, or tax advice.
      </p>
      <h2>Non-custodial; third-party services</h2>
      <p>
        Siren does not custody your funds. Transactions are executed using third-party protocols and infrastructure (wallets, RPCs,
        DFlow, Jupiter, Polymarket, Solana). Your use of third-party services is governed by their terms.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not interfere with or disrupt the Service.</li>
        <li>Do not reverse engineer or abuse rate limits.</li>
        <li>Do not use the Service for unlawful activity.</li>
      </ul>
      <h2>Disclaimers</h2>
      <p>The Service is provided “as is” and “as available”.</p>
      <h2>Limitation of liability</h2>
      <p>To the maximum extent permitted by law, Siren’s total liability will not exceed $100 USD.</p>
    </>
  );
}


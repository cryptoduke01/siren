export default function GettingStarted() {
  return (
    <div className="docs-page">
      <section className="docs-hero">
        <p className="docs-eyebrow">Getting started</p>
        <h1>Unlock the terminal and get to execution context fast.</h1>
        <p>
          Siren onboarding is built to get traders from invite to execution surface quickly, with wallet and social options depending on how they want to start.
        </p>
      </section>

      <section className="docs-grid">
        <article className="docs-card">
          <h2>1. Get an access code</h2>
          <p>
            If you joined the waitlist, you receive a 6-digit code by email. Enter it at <span className="docs-inline-code">onsiren.xyz/access</span> to unlock the app.
          </p>
        </article>
        <article className="docs-card">
          <h2>2. Sign in or connect</h2>
          <p>
            Use a Solana wallet for direct control, or sign in with Google or GitHub for a faster start with an embedded wallet.
          </p>
        </article>
        <article className="docs-card">
          <h2>3. Pick a market</h2>
          <p>
            The left rail surfaces live prediction markets. Opening one loads the execution surface, venue context, and route-aware actions.
          </p>
        </article>
        <article className="docs-card">
          <h2>4. Watch the risk layer</h2>
          <p>
            Before sizing up, check the execution and risk read: route status, resolution window, liquidity context, and likely failure mode.
          </p>
        </article>
      </section>

      <section className="docs-callout">
        <p>
          <strong>Note:</strong> access-code emails and broader product emails are now managed separately. Waitlist operations stay focused on onboarding, while the unified audience powers campaign sends.
        </p>
      </section>
    </div>
  );
}

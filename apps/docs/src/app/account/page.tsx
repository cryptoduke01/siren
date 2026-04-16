export default function Account() {
  return (
    <div className="docs-page">
      <section className="docs-hero">
        <p className="docs-eyebrow">Account</p>
        <h1>Account data is now part of the unified audience story too.</h1>
        <p>
          Siren supports direct wallet connection and social sign-in. Auth-backed users can move faster, and their captured email lets Siren treat the app audience and waitlist as one mailing audience instead of two fragmented lists.
        </p>
      </section>

      <section className="docs-grid">
        <article className="docs-card">
          <h2>Wallet-first option</h2>
          <p>
            Connect Phantom, Solflare, Torus, or another supported wallet when you want direct custody and native signing flow.
          </p>
        </article>
        <article className="docs-card">
          <h2>Social sign-in</h2>
          <p>
            Google and GitHub sign-in create a faster path into Siren and can provision an embedded wallet through Privy.
          </p>
        </article>
        <article className="docs-card">
          <h2>Audience capture</h2>
          <p>
            When an auth-backed user signs in, Siren can now store the email in user metadata so admin broadcasts can dedupe against waitlist emails automatically.
          </p>
        </article>
        <article className="docs-card">
          <h2>Security posture</h2>
          <p>
            Embedded wallets remain managed by Privy. Siren uses the minimum profile data needed for access, user identity, and product operations.
          </p>
        </article>
      </section>
    </div>
  );
}

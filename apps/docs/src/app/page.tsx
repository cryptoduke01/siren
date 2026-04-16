export default function DocsHome() {
  return (
    <div className="docs-page">
      <section className="docs-hero">
        <p className="docs-eyebrow">Overview</p>
        <h1>Siren is the execution layer above prediction markets.</h1>
        <p>
          Siren does not replace Kalshi, Polymarket, or onchain venues. It helps traders answer the questions that matter in the moment:
          can this trade clear, why did it fail, how thin is the route, how exposed am I into resolution, and what should I do next?
        </p>
        <div className="docs-link-row">
          <a href="https://onsiren.xyz" target="_blank" rel="noopener noreferrer">
            Open Siren
          </a>
          <a href="https://x.com/sirenmarketsxyz" target="_blank" rel="noopener noreferrer">
            Follow @sirenmarketsxyz
          </a>
        </div>
      </section>

      <section className="docs-grid">
        <article className="docs-card">
          <h2>What Siren is</h2>
          <p>
            An execution and risk intelligence product for prediction traders. Siren emphasizes feasibility, adaptive sizing, route explanations,
            and post-trade clarity.
          </p>
        </article>
        <article className="docs-card">
          <h2>What Siren is not</h2>
          <p>
            Not another exchange, not a leverage-first prediction product, and not a token-discovery wrapper. The wedge is execution reliability
            and risk clarity.
          </p>
        </article>
      </section>

      <section className="docs-grid">
        <article className="docs-card">
          <h3>Execution feasibility</h3>
          <p>
            Before submit, Siren should help you understand whether the book can actually absorb your size instead of only showing a headline price.
          </p>
        </article>
        <article className="docs-card">
          <h3>Adaptive execution</h3>
          <p>
            When a full clip cannot route, Siren is being designed to reduce size in controlled steps rather than fail opaquely.
          </p>
        </article>
        <article className="docs-card">
          <h3>Route explanations</h3>
          <p>
            Route errors should be human: no bid, route too thin, venue-only market, wallet issue, or retry-later context.
          </p>
        </article>
        <article className="docs-card">
          <h3>Risk guardrails</h3>
          <p>
            The first guardrails are simple and practical: concentration hints, resolution-window awareness, and clearer exposure framing.
          </p>
        </article>
      </section>

      <section className="docs-callout">
        <p>
          <strong>Brand note:</strong> the company is still Siren, the domain stays <span className="docs-inline-code">onsiren.xyz</span>, and the story now leads with
          execution and risk intelligence for prediction markets.
        </p>
      </section>
    </div>
  );
}

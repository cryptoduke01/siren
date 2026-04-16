export default function Portfolio() {
  return (
    <div className="docs-page">
      <section className="docs-hero">
        <p className="docs-eyebrow">Portfolio</p>
        <h1>Portfolio should explain exposure, not just list positions.</h1>
        <p>
          Siren portfolio work is moving toward a trader’s real question set: what is open, how much risk is stacked into the same outcome cluster, and what gets dangerous as markets near resolution.
        </p>
      </section>

      <section className="docs-grid">
        <article className="docs-card">
          <h2>Balances and positions</h2>
          <p>
            Today the portfolio surfaces wallet balances, prediction positions where supported, and local entry data for better readback on PnL.
          </p>
        </article>
        <article className="docs-card">
          <h2>Resolution awareness</h2>
          <p>
            The risk direction for Siren is to make time-to-resolution matter more in the interface so exit danger is visible before it becomes a problem.
          </p>
        </article>
        <article className="docs-card">
          <h2>Post-trade context</h2>
          <p>
            Trade logging and permanent history are the groundwork for post-trade reporting, fill explanations, and trader improvement loops.
          </p>
        </article>
        <article className="docs-card">
          <h2>Shareable state</h2>
          <p>
            Siren can already export branded market and PnL cards. The next step is making those exports reflect execution and outcome context, not just screenshots.
          </p>
        </article>
      </section>
    </div>
  );
}

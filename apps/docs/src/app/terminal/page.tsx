export default function Terminal() {
  return (
    <div className="docs-page">
      <section className="docs-hero">
        <p className="docs-eyebrow">Execution surface</p>
        <h1>The terminal is where feasibility and risk meet the trade.</h1>
        <p>
          Siren’s main surface is no longer about discovery for discovery’s sake. It is where a selected market turns into route context, sizing judgment, and clearer action.
        </p>
      </section>

      <section className="docs-grid">
        <article className="docs-card">
          <h2>Selected market focus</h2>
          <p>
            Opening a market surfaces the venue, outcome pricing, close time, recent activity, and the primary action Siren can support right now.
          </p>
        </article>
        <article className="docs-card">
          <h2>Execution intelligence</h2>
          <p>
            Siren derives a quick read from route availability, close window, velocity, and visible liquidity. The goal is to warn before a trader learns the hard way.
          </p>
        </article>
        <article className="docs-card">
          <h2>Route clarity</h2>
          <p>
            Markets can be fully routable in Siren, venue-only, or thin enough that the playbook should shift to smaller clips and more patience.
          </p>
        </article>
        <article className="docs-card">
          <h2>Failure guidance</h2>
          <p>
            A failed order should point somewhere useful: route missing, depth thin, wallet issue, quote stale, or venue-side availability.
          </p>
        </article>
      </section>
    </div>
  );
}

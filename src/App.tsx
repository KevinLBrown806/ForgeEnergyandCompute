import { Estimator } from './components/Estimator';

const STATS = [
  { value: '100%', label: 'Renewable-matched energy' },
  { value: '1.12', label: 'Average facility PUE' },
  { value: '48h', label: 'Median time to first job' },
];

const FEATURES = [
  {
    title: 'Clean baseload power',
    body: 'Sited next to hydro, geothermal, and curtailed wind so every FLOP runs on low-carbon electricity.',
  },
  {
    title: 'High-density racks',
    body: 'Direct-to-chip liquid cooling supports 120 kW racks without throttling under sustained load.',
  },
  {
    title: 'Transparent metering',
    body: 'Per-tenant energy and carbon telemetry, exported to your dashboards in real time.',
  },
  {
    title: 'Elastic reservations',
    body: 'Reserve a pod for a quarter or burst into spare capacity by the hour. No lock-in.',
  },
];

function App() {
  return (
    <div className="page">
      <header className="nav">
        <a className="brand" href="#top">
          <span className="brand__mark" aria-hidden="true">
            ⬡
          </span>
          Forge <span className="brand__accent">Energy&nbsp;&amp;&nbsp;Compute</span>
        </a>
        <nav className="nav__links">
          <a href="#features">Platform</a>
          <a href="#estimator">Estimator</a>
          <a className="btn btn--ghost" href="#estimator">
            Get a quote
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">Sustainable AI infrastructure</p>
          <h1>
            Compute that runs on <span className="hero__accent">clean energy</span>.
          </h1>
          <p className="lede">
            Forge operates liquid-cooled GPU clusters co-located with renewable
            power. Train and serve models at scale while keeping cost and carbon
            under control.
          </p>
          <div className="hero__cta">
            <a className="btn btn--primary" href="#estimator">
              Estimate your cluster
            </a>
            <a className="btn btn--ghost" href="#features">
              Explore the platform
            </a>
          </div>

          <dl className="stats">
            {STATS.map((stat) => (
              <div className="stat" key={stat.label}>
                <dt className="stat__value">{stat.value}</dt>
                <dd className="stat__label">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Estimator />

        <section className="features" id="features" aria-labelledby="features-title">
          <div className="features__intro">
            <p className="eyebrow">Platform</p>
            <h2 id="features-title">Built for dense, sustainable training</h2>
          </div>
          <div className="features__grid">
            {FEATURES.map((feature) => (
              <article className="feature" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          © {new Date().getFullYear()} Forge Energy &amp; Compute. Built for a
          low-carbon compute grid.
        </p>
      </footer>
    </div>
  );
}

export default App;

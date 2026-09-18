const LINKS = [
  { href: '#overview', label: 'Overview' },
  { href: '#treasury', label: 'Treasury' },
  { href: '#fleet', label: 'Fleet' },
  { href: '#mining', label: 'Mining' },
  { href: '#energy', label: 'Energy' },
  { href: '#capital', label: 'Capital' },
  { href: '#strategy', label: 'Strategy' },
];

export function Nav() {
  return (
    <header className="nav">
      <a className="brand" href="#overview">
        <span className="brand__mark" aria-hidden="true">
          ⬡
        </span>
        <span className="brand__name">
          FORGE
          <span className="brand__sub">Energy &amp; Compute</span>
        </span>
      </a>
      <nav className="nav__links" aria-label="Dashboard sections">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

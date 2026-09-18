const LINKS = [
  { href: '#overview', label: 'Overview' },
  { href: '#treasury', label: 'Treasury' },
  { href: '#mining', label: 'Mining' },
  { href: '#energy', label: 'Energy' },
  { href: '#capital', label: 'Capital' },
  { href: '#strategy', label: 'Strategy' },
];

function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
      <polygon
        points="16,2.4 28.2,9.2 28.2,22.8 16,29.6 3.8,22.8 3.8,9.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12.2 10.4h8.2v1.9h-6.1v2.6h5.4v1.8h-5.4V21.6h-2.1V10.4z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Nav() {
  return (
    <header className="nav">
      <a className="brand" href="#overview">
        <BrandMark />
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

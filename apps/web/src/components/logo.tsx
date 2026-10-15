/** Sakan wordmark: a house outline with the name in both scripts. */
export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={inverted ? 'logo inverted' : 'logo'}>
      <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
        <path d="M6 19 20 7l14 12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 17v15h18V17" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
        <rect x="17" y="23" width="6" height="9" rx="1" className="logo-door" />
      </svg>
      <span className="logo-text">
        <span lang="ar">سكن</span>
        <span lang="fr" className="logo-latin">SAKAN</span>
      </span>
    </span>
  );
}

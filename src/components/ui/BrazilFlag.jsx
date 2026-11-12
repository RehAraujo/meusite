// Assinatura discreta: referência simbólica à bandeira, não decoração patriótica.
export function BrazilFlag({ className = 'rj-flag' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 28 20"
      width="21"
      height="15"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="28" height="20" rx="2" fill="#009b3a" />
      <path d="M14 2.6 25.2 10 14 17.4 2.8 10Z" fill="#fedf00" />
      <circle cx="14" cy="10" r="4.3" fill="#002776" />
    </svg>
  );
}

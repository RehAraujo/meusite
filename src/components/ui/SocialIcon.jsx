const paths = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6Z" />
      <path d="M9.2 8.6c.2 2.6 2.6 5 5.2 5.3l1-1.1-1.7-.9-.7.6a4.4 4.4 0 0 1-2.2-2.2l.6-.7-.9-1.7Z" />
    </>
  ),
  github: (
    <path d="M9 19c-4 1.3-4-2-5.6-2.4M14.6 21v-3.3c0-1 .1-1.4-.5-2 2.8-.3 5.4-1.3 5.4-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6 0C6.3 3 5.3 3.3 5.3 3.3a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.9 9.7c0 4.6 2.6 5.7 5.4 6-.6.6-.6 1.2-.5 2V21" />
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10.5V16M8 7.8v.1M11.5 16v-5.5M11.5 13c0-1.7 1-2.5 2.2-2.5s2.3.8 2.3 2.6V16" />
    </>
  ),
};

export function SocialIcon({ name }) {
  return (
    <svg
      className="rj-social-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

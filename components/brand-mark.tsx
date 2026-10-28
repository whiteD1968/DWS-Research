// The DWS block-mass mark, drawn from the Dustin White Studio brand guide.
export function BrandMark({ className, title = "DWS" }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox="0 0 301 65" role="img" aria-label={title}>
      <path fill="currentColor" fillRule="evenodd" d="M0 0H86V65H0Z M37 22H65V47H37Z" />
      <path fill="currentColor" d="M97 0H120V35H133V0H170V35H182V0H205V65H97Z" />
      <path fill="currentColor" d="M216 0H301V15H260V25H301V65H216V49H258V39H216Z" />
    </svg>
  );
}

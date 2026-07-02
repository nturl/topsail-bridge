// The TI oval, sized for the header wordmark. Shared by the app page and the
// content pages so the brand reads identically everywhere.
export function HeaderMark() {
  return (
    <svg width="36" height="24" viewBox="0 0 36 24" aria-hidden className="shrink-0">
      <ellipse cx="18" cy="12" rx="16.5" ry="10.5" fill="#fff" stroke="#0f172a" strokeWidth="2.4" />
      <text
        x="18"
        y="16.2"
        textAnchor="middle"
        fontSize="11.5"
        fontWeight="800"
        fill="#0f172a"
        fontFamily="ui-sans-serif, system-ui"
        letterSpacing="0.5"
      >
        TI
      </text>
    </svg>
  );
}

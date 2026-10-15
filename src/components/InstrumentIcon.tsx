// Drawn instrument icons in one consistent stroke, coloured by currentColor.
// Instruments are free text in the database (stored lowercase), so unknown
// ones get a generic music-note icon.
const PATHS: Record<string, React.ReactNode> = {
  guitar: (
    <>
      <circle cx="9" cy="15" r="5.5" />
      <circle cx="9" cy="15" r="1.4" />
      <path d="M13 11l7.5-7.5M17.5 3l3.5 3.5" />
    </>
  ),
  piano: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M9 13v6M15 13v6M7.5 5v8M12 5v8M16.5 5v8" />
    </>
  ),
  violin: (
    <>
      <ellipse cx="12" cy="9.5" rx="3.5" ry="3" />
      <ellipse cx="12" cy="16.5" rx="5" ry="4.5" />
      <path d="M12 2.5v7M9.5 13h5" />
    </>
  ),
  drums: (
    <>
      <ellipse cx="12" cy="13" rx="8" ry="3.5" />
      <path d="M4 13v4.5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5V13M5 3l6 7M19 3l-6 7" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </>
  ),
};

const GENERIC = (
  <>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </>
);

export function InstrumentIcon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name.toLowerCase()] ?? GENERIC}
    </svg>
  );
}

export function StarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 1.2l2 4.3 4.7.6-3.4 3.3.9 4.7L8 11.8 3.8 14.1l.9-4.7L1.3 6.1 6 5.5z"
      />
    </svg>
  );
}

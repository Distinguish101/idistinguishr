// Small spinner for inline use next to button labels, or standalone for
// full-page/section loading states. Uses currentColor for the stroke so it
// automatically matches whatever text color it's placed in (button text,
// t-soft, etc.) without needing its own color prop.
export function Spinner({
  size = 16,
  label,
}: {
  size?: number;
  label?: string;
}) {
  return (
    <span className="spinner-wrap">
      <span
        className="spinner"
        style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 7)) }}
        aria-hidden={label ? true : undefined}
      />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

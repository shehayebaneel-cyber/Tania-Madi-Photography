// Brand mark + tone placeholder for Tania Madi Photography.
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="brand" style={{ cursor: "default" }}>
      <span className="n" style={light ? { color: "#fff" } : undefined}>
        Tania <i>Madi</i>
      </span>
      <span className="s">Photography</span>
    </span>
  );
}

// A placeholder "photo" — a soft tonal block. Swap for real <img> when photos arrive.
export function Tone({ tone, label, className = "", style, onClick }: { tone: string; label?: string; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div className={`ph ${tone} ${className}`} style={onClick ? { cursor: "zoom-in", ...style } : style} onClick={onClick} aria-hidden="true">
      {label && <span className="plabel">{label}</span>}
    </div>
  );
}

export function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

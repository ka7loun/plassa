// Brand-styled illustration per spot type (no stock photos to license).
const PATHS: Record<string, string> = {
  garage: "M8 30V17l16-9 16 9v13M14 30v-9h20v9M14 25h20",
  courtyard: "M8 30h32M12 30V18a12 12 0 0 1 24 0v12M20 30v-7h8v7",
  driveway: "M10 30h28M16 30l4-18h8l4 18M24 14v3M24 21v3M24 27v2",
  lot: "M10 10h28v20H10zM19 10v20M29 10v20",
  basement: "M8 14h32M12 14v16h24V14M18 22h12M24 14V8",
};

export function SpotThumb({ type, className = "" }: { type: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-blue-50 ${className}`} aria-hidden>
      <svg viewBox="0 0 48 40" className="h-3/5 w-3/5" fill="none" stroke="#1E4BFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS[type] ?? PATHS.lot} />
        <circle cx="38" cy="10" r="3" fill="#D4A574" stroke="none" />
      </svg>
    </div>
  );
}

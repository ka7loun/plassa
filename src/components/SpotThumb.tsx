// Brand-styled illustration per spot type, shown when a spot has no photo yet.
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

/** Small version of a seeded stock photo; uploads are already resized on the device. */
export function thumbUrl(url: string) {
  return url.startsWith("/spots/") ? url.replace(/\.jpg$/, "-sm.jpg") : url;
}

/** The spot's first photo, or the brand illustration when the host added none. */
export function SpotPhoto({ photos, type, className = "", small = true, alt = "" }: { photos: string[]; type: string; className?: string; small?: boolean; alt?: string }) {
  if (!photos.length) return <SpotThumb type={type} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={small ? thumbUrl(photos[0]) : photos[0]} alt={alt} loading="lazy" decoding="async" className={`rounded-xl bg-blue-50 object-cover ${className}`} />
  );
}

/** "★ 4.6 (23)" or a "New" tag when a spot has no reviews yet. */
export function RatingTag({ avg, count, newLabel, className = "" }: { avg: number | null; count: number; newLabel: string; className?: string }) {
  if (avg === null || count === 0)
    return <span className={`rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue ${className}`}>{newLabel}</span>;
  return (
    <span className={`num inline-flex items-center gap-0.5 text-xs font-semibold text-navy ${className}`}>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="#D4A574" aria-hidden>
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
      {avg.toFixed(1)} <span className="font-normal text-navy-50">({count})</span>
    </span>
  );
}

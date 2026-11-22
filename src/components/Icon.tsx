// One authored icon set: 24px grid, 2px round stroke, currentColor.
const P = {
  search: "M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21",
  calendar: "M4 6.5h16V20H4zM8 3.5v5M16 3.5v5M4 10.5h16",
  home: "M4 20V9.5l8-5.5 8 5.5V20h-5.5v-6h-5v6z",
  chart: "M4 20V11M10 20V5M16 20v-6M2.5 20h19",
  back: "M15 5l-7 7 7 7",
  forward: "M9 5l7 7-7 7",
  locate: "M12 3v3M12 18v3M3 12h3M18 12h3M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  plus: "M12 5v14M5 12h14",
  navigate: "M3 11l18-8-8 18-2-8z",
  share: "M7 12a3 3 0 1 1 0-.01M17 6a3 3 0 1 0 0-.01M17 18a3 3 0 1 0 0-.01M9.6 10.6l4.8-3.2M9.6 13.4l4.8 3.2",
  key: "M14.5 9.5a4 4 0 1 1-1.2-2.8L21 14v3h-3v-2h-2v-2h-2.2",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  check: "M5 12.5l4.5 4.5L19 7.5",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
  trophy: "M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20.5h7M10 17h4",
  camera: "M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  x: "M6 6l12 12M18 6L6 18",
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={P[name]} />
    </svg>
  );
}

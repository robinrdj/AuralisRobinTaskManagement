import "./auri.css";

export type AuriMood = "idle" | "excited" | "pointing" | "concerned" | "celebrating";

/**
 * Auri — a small drifting light, drawn entirely in SVG.
 *
 * Deliberately not a face or an assistant avatar: a soft orb reads as ambient
 * rather than as a character demanding attention, and it carries no implied
 * gender, species or age. Mood is expressed through motion and colour instead
 * of expression, which stays legible at 26px and costs no extra assets.
 *
 * The animations are CSS rather than a JS animation library. Auri appears on
 * the landing page, so anything it imports lands in the first bundle a visitor
 * downloads — and these are perpetual idle loops, which the compositor runs
 * without waking the main thread at all.
 */
export function AuriSprite({ mood = "idle", size = 44 }: { mood?: AuriMood; size?: number }) {
  return (
    <div
      // Decorative: everything Auri conveys is also in the speech-bubble text,
      // which is what a screen reader announces.
      aria-hidden="true"
      className={`auri auri--${mood}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 44 44" width={size} height={size}>
        <defs>
          <radialGradient id={`auri-core-${mood}`} cx="38%" cy="34%">
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="45%" stopColor="var(--auri-color)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--auri-color)" stopOpacity="0.55" />
          </radialGradient>
          <filter id="auri-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer halo, breathing slightly out of phase with the body. */}
        <circle className="auri__halo" cx="22" cy="22" r="15" fill="var(--auri-color)" />

        <circle
          cx="22"
          cy="22"
          r="10"
          fill={`url(#auri-core-${mood})`}
          filter="url(#auri-glow)"
        />

        {/* A specular highlight, which is what makes it read as a sphere. */}
        <circle cx="18.5" cy="18" r="2.6" fill="white" opacity="0.75" />

        {/* Three motes orbiting, faster when Auri is excited or celebrating. */}
        <g className="auri__motes">
          <circle cx="22" cy="6" r="1.7" fill="var(--auri-color)" opacity="0.85" />
          <circle cx="35.9" cy="30" r="1.2" fill="var(--auri-color)" opacity="0.6" />
          <circle cx="8.1" cy="30" r="1.4" fill="var(--auri-color)" opacity="0.72" />
        </g>
      </svg>
    </div>
  );
}

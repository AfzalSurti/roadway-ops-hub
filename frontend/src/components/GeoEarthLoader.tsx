type GeoEarthLoaderProps = {
  title?: string;
  subtitle?: string;
  failed?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
};

export function GeoEarthLoader({
  title = "Geo Designs & Research",
  subtitle = "Waking up server — this can take up to a minute on first load…",
  failed = false,
  onRetry,
  retrying = false
}: GeoEarthLoaderProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/4 w-[520px] h-[520px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[420px] h-[420px] rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_72%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        <div className="geo-earth-scene mb-8" aria-hidden>
          <div className="geo-earth-orbit geo-earth-orbit-outer" />
          <div className="geo-earth-orbit geo-earth-orbit-inner" />
          <div className="geo-earth-globe-wrap">
            <svg className="geo-earth-globe" viewBox="0 0 200 200" role="img" aria-label="Rotating earth">
              <defs>
                <radialGradient id="geoEarthShade" cx="35%" cy="30%" r="68%">
                  <stop offset="0%" stopColor="hsl(185 75% 58%)" />
                  <stop offset="55%" stopColor="hsl(195 68% 38%)" />
                  <stop offset="100%" stopColor="hsl(220 45% 14%)" />
                </radialGradient>
                <linearGradient id="geoLand" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(160 62% 46%)" />
                  <stop offset="100%" stopColor="hsl(152 55% 32%)" />
                </linearGradient>
                <filter id="geoEarthGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <circle cx="100" cy="100" r="78" fill="url(#geoEarthShade)" filter="url(#geoEarthGlow)" />
              <g fill="url(#geoLand)" opacity="0.92">
                <path d="M58 72c10-8 24-6 30 4 4 8-2 18-12 20-14 2-24-10-18-24z" />
                <path d="M118 58c16 2 28 14 26 28-2 12-16 18-28 12-14-8-10-28 2-40z" />
                <path d="M92 108c18 4 32 18 28 34-4 14-22 20-36 10-12-8-8-30 8-44z" />
                <path d="M48 118c8 10 6 24-4 30-10 6-22-2-22-16 0-10 10-18 26-14z" />
                <path d="M132 112c10 6 12 20 4 28-8 8-22 4-26-8-4-12 6-22 22-20z" />
              </g>
              <ellipse cx="72" cy="68" rx="22" ry="10" fill="white" opacity="0.12" transform="rotate(-18 72 68)" />
            </svg>
          </div>
        </div>

        <p className="text-[11px] uppercase tracking-[0.28em] text-primary/90 font-medium mb-2">Sankalp Ops Hub</p>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{failed ? "Could not reach the server. Please try again." : subtitle}</p>

        {!failed ? (
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="geo-earth-dot" />
            <span className="geo-earth-dot geo-earth-dot-delay-1" />
            <span className="geo-earth-dot geo-earth-dot-delay-2" />
            <span className="ml-1">Connecting</span>
          </div>
        ) : onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mt-8 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {retrying ? "Retrying…" : "Try again"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

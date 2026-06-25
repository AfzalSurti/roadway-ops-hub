type OpsForgeLogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

export function OpsForgeLogo({ size = 36, showWordmark = true, className = "" }: OpsForgeLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="shrink-0"
      >
        <defs>
          <linearGradient id="of-grad-main" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(186, 72%, 52%)" />
            <stop offset="1" stopColor="hsl(158, 68%, 42%)" />
          </linearGradient>
          <linearGradient id="of-grad-inner" x1="14" y1="14" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(186, 72%, 62%)" stopOpacity="0.9" />
            <stop offset="1" stopColor="hsl(158, 68%, 48%)" stopOpacity="0.85" />
          </linearGradient>
          <filter id="of-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="2" y="2" width="44" height="44" rx="13" fill="hsl(222, 22%, 9%)" stroke="url(#of-grad-main)" strokeWidth="1.5" />

        <path
          d="M24 10 L34 16 V28 L24 34 L14 28 V16 Z"
          stroke="url(#of-grad-main)"
          strokeWidth="1.75"
          strokeLinejoin="round"
          fill="none"
          opacity="0.55"
        />

        <path
          d="M24 14 L30 17.5 V24.5 L24 28 L18 24.5 V17.5 Z"
          fill="url(#of-grad-inner)"
          filter="url(#of-glow)"
        />

        <path
          d="M24 18 L27 19.75 V23.25 L24 25 L21 23.25 V19.75 Z"
          fill="hsl(222, 28%, 8%)"
          opacity="0.85"
        />

        <circle cx="24" cy="21.5" r="1.5" fill="hsl(186, 72%, 58%)" />

        <path
          d="M12 36 H36"
          stroke="url(#of-grad-main)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.35"
        />
        <path
          d="M16 38 H32"
          stroke="url(#of-grad-main)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.22"
        />
      </svg>

      {showWordmark ? (
        <span className="font-bold text-lg tracking-tight">
          Ops<span className="gradient-text">Forge</span>
        </span>
      ) : null}
    </span>
  );
}

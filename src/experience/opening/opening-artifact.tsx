interface OpeningArtifactProps {
  className?: string;
}

export function OpeningArtifact({ className = "" }: OpeningArtifactProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 680"
      role="img"
      aria-labelledby="opening-artifact-title opening-artifact-description"
    >
      <title id="opening-artifact-title">VISR display system silhouette</title>
      <desc id="opening-artifact-description">
        A diecast car is revealed inside a transparent precision display frame.
      </desc>

      <defs>
        <linearGradient id="visr-body" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f6f6f3" stopOpacity="0.78" />
          <stop offset="0.42" stopColor="#8d8d89" stopOpacity="0.22" />
          <stop offset="1" stopColor="#f6f6f3" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="visr-glass" x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.035" />
        </linearGradient>
        <radialGradient id="visr-wheel" cx="50%" cy="42%" r="58%">
          <stop offset="0" stopColor="#cfcfcb" stopOpacity="0.42" />
          <stop offset="0.28" stopColor="#242424" />
          <stop offset="0.72" stopColor="#070707" />
          <stop offset="1" stopColor="#000000" />
        </radialGradient>
        <filter id="visr-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="visr-shadow" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      <g data-opening-shadow opacity="0.46">
        <ellipse cx="610" cy="532" rx="360" ry="30" fill="#000" filter="url(#visr-shadow)" />
      </g>

      <g data-opening-frame fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          data-frame-line
          d="M170 122H1032L1094 189V512L1032 558H170L108 512V189L170 122Z"
          stroke="rgba(255,255,255,.24)"
          strokeWidth="2"
          pathLength="1"
        />
        <path
          data-frame-line
          d="M188 145H1015L1067 201V493L1018 532H186L135 493V202L188 145Z"
          stroke="rgba(255,255,255,.075)"
          strokeWidth="1"
          pathLength="1"
        />
        <path
          data-frame-highlight
          d="M170 122H1032L1094 189"
          stroke="rgba(255,255,255,.78)"
          strokeWidth="2.5"
          pathLength="1"
          filter="url(#visr-soft-glow)"
        />
        <path
          data-frame-highlight
          d="M108 512L170 558H1032"
          stroke="rgba(255,255,255,.38)"
          strokeWidth="2"
          pathLength="1"
        />
      </g>

      <g data-opening-car>
        <path
          data-car-glass
          d="M416 354L492 269C511 248 536 237 566 237H716C746 237 772 249 790 271L856 354Z"
          fill="url(#visr-glass)"
          stroke="rgba(255,255,255,.18)"
          strokeWidth="2"
        />
        <path
          data-car-body
          d="M266 386C304 367 356 357 425 351L474 294C495 269 526 255 558 255H724C757 255 786 269 808 294L860 350C933 358 982 373 1007 398L1037 438C1048 452 1042 473 1024 478L960 494H304L229 478C210 474 203 451 215 436L246 399C252 393 259 389 266 386Z"
          fill="url(#visr-body)"
          stroke="rgba(255,255,255,.26)"
          strokeWidth="2"
        />
        <path
          data-car-body-line
          d="M302 386C452 371 745 369 958 390"
          fill="none"
          stroke="rgba(255,255,255,.42)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength="1"
        />
        <path
          data-car-body-line
          d="M405 351H864"
          fill="none"
          stroke="rgba(255,255,255,.16)"
          strokeWidth="1.5"
          pathLength="1"
        />
        <path
          d="M257 424H343"
          stroke="rgba(255,255,255,.7)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M913 422H1001"
          stroke="rgba(255,255,255,.42)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <g data-wheel-left>
          <circle cx="408" cy="475" r="67" fill="url(#visr-wheel)" />
          <circle cx="408" cy="475" r="32" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
          <circle cx="408" cy="475" r="7" fill="rgba(255,255,255,.3)" />
        </g>
        <g data-wheel-right>
          <circle cx="851" cy="475" r="67" fill="url(#visr-wheel)" />
          <circle cx="851" cy="475" r="32" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
          <circle cx="851" cy="475" r="7" fill="rgba(255,255,255,.3)" />
        </g>
      </g>

      <g data-opening-reflection opacity="0.42">
        <path
          d="M243 177L795 177"
          stroke="rgba(255,255,255,.6)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#visr-soft-glow)"
        />
        <path
          d="M792 178L971 178"
          stroke="rgba(255,255,255,.13)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 24, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-label="AI Teacher"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="spark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* Background circle */}
      <circle cx="16" cy="16" r="15" fill="url(#logo-grad)" />
      {/* Open book */}
      <path
        d="M16 22.5c-1.8-1-4.2-1.6-7-1.8V10.5c2.8.2 5.2.8 7 1.8V22.5z"
        fill="#fff"
        opacity="0.95"
      />
      <path
        d="M16 22.5c1.8-1 4.2-1.6 7-1.8V10.5c-2.8.2-5.2.8-7 1.8V22.5z"
        fill="#fff"
        opacity="0.8"
      />
      {/* AI sparkle — top right */}
      <path
        d="M22 6l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2L19 9l2.2-.8z"
        fill="url(#spark-grad)"
      />
      {/* Small sparkle — left */}
      <path
        d="M9 7.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"
        fill="#fde68a"
        opacity="0.8"
      />
    </svg>
  );
}

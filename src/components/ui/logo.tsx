const sizes = {
  sm: { icon: 22, text: "text-sm" },
  md: { icon: 26, text: "text-lg" },
  lg: { icon: 34, text: "text-2xl" },
};

export function Logo({
  size = "md",
  className = "",
}: {
  size?: keyof typeof sizes;
  className?: string;
}) {
  const { icon, text } = sizes[size];

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width={icon} height={icon} viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
        <rect width="100" height="100" rx="24" className="fill-accent" />
        <path d="M50 25 L78 57 L22 57 Z" className="fill-accent-foreground" />
        <rect x="30" y="57" width="40" height="19" rx="4" className="fill-accent-foreground" />
      </svg>
      <span className={`font-semibold tracking-tight text-foreground ${text}`}>Realty Labz</span>
    </span>
  );
}

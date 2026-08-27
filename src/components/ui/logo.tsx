import Link from "next/link";
import {
  LOGO_CHIMNEY_BUBBLES,
  LOGO_CHIMNEY_PATH,
  LOGO_HOUSE_PATH,
  LOGO_LIQUID_BUBBLES,
  LOGO_LIQUID_COLOR,
  LOGO_LIQUID_PATH,
  LOGO_STROKE_WIDTH,
} from "./logo-mark";

const sizes = {
  sm: { icon: 24, text: "text-sm" },
  md: { icon: 28, text: "text-lg" },
  lg: { icon: 36, text: "text-2xl" },
};

// `href` is opt-in rather than always-on: this same mark also appears on the
// client portal and the public open-house sign-in, where the viewer has no
// account and a link into the app would dead-end at a login screen. Callers
// that already sit inside a <Link> must not pass it either -- nested anchors
// are invalid HTML that browsers silently break.
export function Logo({
  size = "md",
  className = "",
  href,
  onClick,
}: {
  size?: keyof typeof sizes;
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  const { icon, text } = sizes[size];

  const mark = (
    <>
      <svg width={icon} height={icon} viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
        {/* Chimney sits under the roofline so the roof stroke hides its base. */}
        <path
          d={LOGO_CHIMNEY_PATH}
          fill="none"
          strokeWidth={LOGO_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-foreground"
        />
        <path d={LOGO_LIQUID_PATH} fill={LOGO_LIQUID_COLOR} />
        {LOGO_LIQUID_BUBBLES.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="#ffffff" fillOpacity={0.85} />
        ))}
        <path
          d={LOGO_HOUSE_PATH}
          fill="none"
          strokeWidth={LOGO_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-foreground"
        />
        {LOGO_CHIMNEY_BUBBLES.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={LOGO_LIQUID_COLOR} />
        ))}
      </svg>
      <span className={`font-semibold tracking-tight text-foreground ${text}`}>Realty Labz</span>
    </>
  );

  const classes = `inline-flex items-center gap-2.5 ${className}`;

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={`${classes} transition-opacity hover:opacity-80`}>
        {mark}
      </Link>
    );
  }

  return <span className={classes}>{mark}</span>;
}

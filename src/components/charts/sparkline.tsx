// Cumulative year-to-date area. Each value is that month's net; the line is
// the running total, so one busy month doesn't look like a flat line with a spike.
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const cumulative: number[] = [];
  let run = 0;
  for (const value of values) {
    run += value;
    cumulative.push(run);
  }
  if (cumulative.every((v) => v === 0)) return null;

  const min = Math.min(0, ...cumulative);
  const max = Math.max(0, ...cumulative);
  const span = max - min || 1;
  const w = 168;
  const h = 48;
  const coords = cumulative.map((v, i) => {
    const x = (i / (cumulative.length - 1)) * (w - 2) + 1;
    const y = h - 4 - ((v - min) / span) * (h - 8);
    return { x, y };
  });
  const line = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `M${coords[0].x.toFixed(1)},${h} ` + coords.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + ` L${coords[coords.length - 1].x.toFixed(1)},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} aria-hidden className="h-12 w-full">
      <path d={area} fill="var(--accent)" opacity="0.16" />
      <polyline
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={line}
      />
    </svg>
  );
}

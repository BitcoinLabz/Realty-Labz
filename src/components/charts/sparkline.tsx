// A quiet trend line beside a headline number. Values are already computed
// by the page; this only draws them.
export function Sparkline({ values, negative = false }: { values: number[]; negative?: boolean }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 108;
  const h = 36;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((v - min) / span) * (h - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <polyline
        fill="none"
        stroke={negative ? "var(--danger)" : "var(--accent)"}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

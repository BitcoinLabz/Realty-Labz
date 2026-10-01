// Soft tinted icon chips -- the one place colour is used decoratively, and
// even then it signals the kind of thing (money = green, people = violet,
// dates = amber). Class strings are written out in full so Tailwind can see
// them; never build them from the tone name.
export const TONE_CHIP = {
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  violet: "bg-violet/10 text-violet",
  danger: "bg-danger/10 text-danger",
} as const;

export type Tone = keyof typeof TONE_CHIP;

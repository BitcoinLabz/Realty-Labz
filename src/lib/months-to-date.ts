// January through the current month for this year. A past year stays whole.
export function throughCurrentMonth<T>(rows: T[], year: number): T[] {
  if (new Date().getFullYear() !== year) return rows;
  return rows.slice(0, new Date().getMonth() + 1);
}

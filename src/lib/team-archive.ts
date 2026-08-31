/**
 * Which of a departing agent's deals a brokerage keeps.
 *
 * Michigan brokers have record-retention obligations, so an agent leaving
 * must not vaporise the brokerage's transaction history. But retention is
 * scoped to what actually closed under that brokerage -- an active deal the
 * agent takes with them to their next office was never this broker's
 * business, and a deal that closed at a previous brokerage isn't either.
 *
 * Nothing here copies or moves data. The caller stamps `archivedTeamId` on
 * the returned deals; `userId` is untouched, so the agent keeps full
 * ownership of every one of them.
 *
 * Pure and separately tested because it decides what a broker can still see
 * about someone who no longer works for them -- worth being exactly right
 * rather than approximately right.
 */

export type ArchivableDeal = {
  id: string;
  status: string;
  closingDate: Date | null;
};

export function selectDealsToArchive(
  deals: ArchivableDeal[],
  teamJoinedAt: Date | null,
): string[] {
  return deals
    .filter((deal) => {
      if (deal.status !== "CLOSED") return false;

      // Null join date: everyone who was already on a team before
      // teamJoinedAt existed. Best effort -- keep every closed deal rather
      // than none, since under-retaining is the worse failure for a broker
      // who may need the record. Documented as approximate, not pretended
      // to be exact.
      if (!teamJoinedAt) return true;

      // A deal with no closing date can't be placed in time. Same reasoning:
      // keep it rather than silently drop it from the brokerage's records.
      if (!deal.closingDate) return true;

      return deal.closingDate.getTime() >= teamJoinedAt.getTime();
    })
    .map((deal) => deal.id);
}

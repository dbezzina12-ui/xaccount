// Display only: reconstruct credited awards from the recorded spin cursor.
export const paidOf = spin => spin?.paid ?? spin?.win ?? 0;
export function shownTotal(round, pending) {
  if (!round || !pending || pending.stage === 'base') return 0;
  if (pending.stage === 'end') return round.total;
  return paidOf(round.spin) + (round.bonus?.spins || [])
    .slice(0, pending.next).reduce((sum, spin) => sum + paidOf(spin), 0);
}
export const credits = cents => (cents / 100).toLocaleString(undefined, {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});

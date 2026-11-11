// Single source of truth for the launch-lunch capacity, used by both the public
// /api/seats display and the /api/signup gate so the two can never drift apart.
export const LUNCH_LIMIT = 33;

// How long a signup "holds" a seat while the person is paying. The webhook usually
// converts the interest to an active member within seconds, so this only needs to
// cover the Payfast round trip. Holds expire on their own - an abandoned signup
// frees its seat with no cleanup job.
const HOLD_MINUTES = 20;

// Seats committed to the lunch right now: active lunch members, plus unexpired
// "about to pay" holds on interest records. Pass the current signup's email to
// exclude that person's own row (so a re-submit never blocks itself).
export async function lunchSeatsTaken(db, excludeEmail = null) {
  const ex = excludeEmail ? String(excludeEmail).toLowerCase() : null;
  const since = new Date(Date.now() - HOLD_MINUTES * 60000).toISOString();
  const [{ data: mem }, { data: holds }] = await Promise.all([
    db.from('members').select('email,seats').eq('tier', 'lunch').eq('status', 'active'),
    db.from('interests').select('email,seats,pay_started_at').eq('tier', 'lunch').eq('status', 'interested').gte('pay_started_at', since),
  ]);
  const sum = (rows) => (rows || [])
    .filter((r) => !ex || String(r.email || '').toLowerCase() !== ex)
    .reduce((a, r) => a + (Number(r.seats) || 0), 0);
  return sum(mem) + sum(holds);
}

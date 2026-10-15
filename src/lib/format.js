export const rand = (n) => 'R' + Number(n || 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 });
export const shortDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// Fallback next-payment date for members without a Payfast-synced date: step the
// quarterly start date forward until it's in the future. An estimate, not authoritative.
export const nextQuarterly = (startDate) => {
  if (!startDate) return '';
  const d = new Date(startDate); if (isNaN(d)) return '';
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let guard = 0;
  while (d <= now && guard < 40) { d.setMonth(d.getMonth() + 3); guard++; }
  return d.toISOString().slice(0, 10);
};

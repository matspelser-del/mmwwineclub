export const rand = (n) => 'R' + Number(n || 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 });
export const shortDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

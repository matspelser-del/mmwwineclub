// A readable, mostly-unique member discount code, e.g. "MILES7K2Q"
export function genCode(name) {
  const base = (String(name || '').split(' ')[0] || 'CLUB')
    .toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'CLUB';
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${rnd}`;
}

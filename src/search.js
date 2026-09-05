export const normalize = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export function search(rows, filters) {
  const terms = normalize(filters.q).split(' ').filter(Boolean);
  return rows.filter(r => terms.every(t => normalize(r.name).includes(t))
    && (!filters.letter || r.shard === filters.letter)
    && (!filters.town || r.town === filters.town)
    && (!filters.county || r.county === filters.county)
    && (!filters.route || r.route === filters.route)
    && (!filters.rating || r.rating === filters.rating));
}

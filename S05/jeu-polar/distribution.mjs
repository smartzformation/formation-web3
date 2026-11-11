// Input cards are ordered by family and role as displayed in the catalogue.
// Include only registered cards currently held by the trainer.
export function proposeDeal(cards, players) {
  if (players.length < 2 || players.length > 9 || new Set(players.map(p => p.toLowerCase())).size !== players.length) {
    throw new Error('Il faut de 2 à 9 portefeuilles distincts.');
  }
  const grouped = new Map();
  for (const card of cards) {
    if (!grouped.has(card.family)) grouped.set(card.family, []);
    grouped.get(card.family).push(card);
  }
  const families = [...grouped.values()];
  for (let size = 5; size >= 2; size--) {
    for (const family of families) {
      const joker = family.find(card => card.joker);
      if (!joker) continue;
      for (const roles of combinations(family.filter(card => !card.joker).map(card => card.role), size - 1)) {
        const selected = [];
        const commonRoles = [joker.role, ...roles].sort((a, b) => a - b);
        for (const candidate of families) {
          const row = commonRoles.map(role => candidate.find(card => card.role === role && card.joker === (role === joker.role)));
          if (row.every(Boolean)) selected.push(row);
          if (selected.length === players.length) return deal(selected, players);
        }
      }
    }
  }
  throw new Error('Stock insuffisant. Il faut une famille par joueur et au moins deux rôles communs, joker compris.');
}

function* combinations(items, length, start = 0, chosen = []) {
  if (!length) {
    yield chosen;
    return;
  }
  for (let index = start; index <= items.length - length; index++) {
    yield* combinations(items, length - 1, index + 1, [...chosen, items[index]]);
  }
}

function shuffled(items) {
  const copy = [...items];
  const random = new Uint32Array(1);
  for (let index = copy.length - 1; index > 0; index--) {
    const range = index + 1;
    const limit = 2 ** 32 - (2 ** 32 % range);
    do { globalThis.crypto.getRandomValues(random); } while (random[0] >= limit);
    const other = random[0] % range;
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function deal(families, players) {
  const size = families[0].length;
  const jokers = shuffled(players);
  const ordinary = players.flatMap(player => Array(size - 1).fill(player));
  for (let attempt = 0; attempt < 64; attempt++) {
    const recipients = shuffled(ordinary);
    let index = 0;
    const rows = families.map((family, row) => family.map(card => card.joker ? jokers[row] : recipients[index++]));
    if (rows.every(row => new Set(row).size > 1)) {
      return { families: families.map(row => row.map(card => card.id)), recipients: rows.flat(), size };
    }
  }
  // A cyclic shift guarantees a valid fallback for two or more players.
  return {
    families: families.map(row => row.map(card => card.id)),
    recipients: families.flatMap((row, index) => row.map(card => card.joker ? jokers[index] : jokers[(index + 1) % jokers.length])),
    size,
  };
}

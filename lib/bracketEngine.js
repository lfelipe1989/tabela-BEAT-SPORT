// Motor de torneio: sorteio, grupos, chaveamento eliminatório.
// Funções puras (sem React, sem banco) — reaproveitadas na página
// de cada etapa. Segue a mesma lógica do gerador de chaveamento avulso.

let idc = 0;
export function uid(p) {
  return p + '_' + ++idc + '_' + Math.random().toString(36).slice(2, 7);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 2);
}

export function seedOrder(n) {
  let res = [1, 2];
  while (res.length < n) {
    const m = res.length * 2 + 1;
    const next = [];
    for (const x of res) next.push(x, m - x);
    res = next;
  }
  return res;
}

export function computeSetsResult(sets) {
  let setsA = 0,
    setsB = 0,
    ptsA = 0,
    ptsB = 0;
  for (const s of sets) {
    ptsA += s[0] || 0;
    ptsB += s[1] || 0;
    if (s[0] > s[1]) setsA++;
    else if (s[1] > s[0]) setsB++;
  }
  return { setsA, setsB, ptsA, ptsB };
}

export function headToHead(aId, bId, matches) {
  const m = matches.find(
    (mm) => (mm.teamA === aId && mm.teamB === bId) || (mm.teamA === bId && mm.teamB === aId)
  );
  if (!m || !m.winner) return 0;
  if (m.winner === aId) return -1;
  if (m.winner === bId) return 1;
  return 0;
}

export function compareTeams(a, b, matches, tiebreak) {
  for (const crit of tiebreak) {
    if (crit === 'confronto_direto') {
      const h = headToHead(a.id, b.id, matches);
      if (h !== 0) return h;
    } else {
      const map = {
        vitorias: 'vitorias',
        saldo_sets: 'saldoSets',
        saldo_pontos: 'saldoPontos',
        sets_pro: 'setsPro',
        pontos_pro: 'pontosPro',
      };
      const key = map[crit];
      const diff = b[key] - a[key];
      if (diff !== 0) return diff;
    }
  }
  return 0;
}

export function computeStandings(group, groupMatches, tiebreak) {
  const stats = {};
  for (const id of group.teamIds) {
    stats[id] = { id, vitorias: 0, jogos: 0, setsPro: 0, setsContra: 0, pontosPro: 0, pontosContra: 0 };
  }
  const matches = groupMatches.filter((m) => m.groupId === group.id);
  for (const m of matches) {
    if (!m.sets || m.sets.length === 0) continue;
    const r = computeSetsResult(m.sets);
    const a = stats[m.teamA],
      b = stats[m.teamB];
    if (!a || !b) continue;
    a.jogos++;
    b.jogos++;
    a.setsPro += r.setsA;
    a.setsContra += r.setsB;
    b.setsPro += r.setsB;
    b.setsContra += r.setsA;
    a.pontosPro += r.ptsA;
    a.pontosContra += r.ptsB;
    b.pontosPro += r.ptsB;
    b.pontosContra += r.ptsA;
    if (m.winner === m.teamA) a.vitorias++;
    else if (m.winner === m.teamB) b.vitorias++;
  }
  const list = Object.values(stats);
  list.forEach((t) => {
    t.saldoSets = t.setsPro - t.setsContra;
    t.saldoPontos = t.pontosPro - t.pontosContra;
  });
  list.sort((x, y) => compareTeams(x, y, matches, tiebreak));
  return list;
}

// teams: [{id, name, seed}]
export function performDraw(format, teams, numGroups) {
  const seeded = shuffle(teams.filter((t) => t.seed));
  const unseeded = shuffle(teams.filter((t) => !t.seed));

  if (format === 'eliminatoria_simples') {
    const ordered = [...seeded, ...unseeded];
    const bracketSize = nextPow2(ordered.length);
    const order = seedOrder(bracketSize);
    const posTeam = order.map((rank) => ordered[rank - 1] || null);
    const round1 = [];
    for (let i = 0; i < posTeam.length; i += 2) {
      const a = posTeam[i],
        b = posTeam[i + 1];
      let winner = null;
      if (a && !b) winner = a.id;
      if (b && !a) winner = b.id;
      round1.push({ id: uid('m'), teamA: a ? a.id : null, teamB: b ? b.id : null, sets: [], winner });
    }
    return { groups: [], groupMatches: [], bracket: { rounds: [round1] } };
  }

  const groups = [];
  for (let i = 0; i < numGroups; i++) {
    groups.push({ id: uid('g'), name: 'Grupo ' + String.fromCharCode(65 + i), teamIds: [] });
  }
  const distribute = (arr) => {
    let dir = 1,
      idx = 0;
    for (const t of arr) {
      groups[idx].teamIds.push(t.id);
      idx += dir;
      if (idx === numGroups) {
        idx = numGroups - 1;
        dir = -1;
      } else if (idx < 0) {
        idx = 0;
        dir = 1;
      }
    }
  };
  distribute(seeded);
  distribute(unseeded);

  const groupMatches = [];
  for (const g of groups) {
    for (let i = 0; i < g.teamIds.length; i++) {
      for (let j = i + 1; j < g.teamIds.length; j++) {
        groupMatches.push({ id: uid('m'), groupId: g.id, teamA: g.teamIds[i], teamB: g.teamIds[j], sets: [], winner: null });
      }
    }
  }
  return { groups, groupMatches, bracket: null };
}

export function advanceBracket(bracket) {
  if (!bracket) return { bracket, champion: null };
  const rounds = [...bracket.rounds];
  let last = rounds[rounds.length - 1];
  let champion = null;
  while (true) {
    if (last.length === 1) {
      if (last[0].winner) champion = last[0].winner;
      break;
    }
    if (last.every((m) => m.winner)) {
      const next = [];
      for (let i = 0; i < last.length; i += 2) {
        next.push({ id: uid('m'), teamA: last[i].winner, teamB: last[i + 1].winner, sets: [], winner: null });
      }
      rounds.push(next);
      last = next;
    } else break;
  }
  return { bracket: { rounds }, champion };
}

export function generateKnockoutFromGroups(groups, groupMatches, tiebreak, qualifiersPerGroup, teams) {
  const rankedByGroup = groups.map((g) => computeStandings(g, groupMatches, tiebreak));
  let seedList = [];
  for (let pos = 0; pos < qualifiersPerGroup; pos++) {
    for (const ranked of rankedByGroup) {
      if (ranked[pos]) seedList.push(ranked[pos]);
    }
  }
  const teamsFull = seedList.map((t) => teams.find((tm) => tm.id === t.id)).filter(Boolean);
  if (teamsFull.length < 2) return null;
  const bracketSize = nextPow2(teamsFull.length);
  const order = seedOrder(bracketSize);
  const posTeam = order.map((rank) => teamsFull[rank - 1] || null);
  const round1 = [];
  for (let i = 0; i < posTeam.length; i += 2) {
    const a = posTeam[i],
      b = posTeam[i + 1];
    let winner = null;
    if (a && !b) winner = a.id;
    if (b && !a) winner = b.id;
    round1.push({ id: uid('m'), teamA: a ? a.id : null, teamB: b ? b.id : null, sets: [], winner });
  }
  return { rounds: [round1] };
}

export function roundLabel(totalRounds, idx) {
  const remaining = totalRounds - idx;
  if (remaining === 1) return 'Final';
  if (remaining === 2) return 'Semifinal';
  if (remaining === 3) return 'Quartas de final';
  if (remaining === 4) return 'Oitavas de final';
  if (remaining === 5) return '16-avos de final';
  return 'Rodada ' + (idx + 1);
}

// Retorna { teamId: colocacao } com base em quem perdeu em qual rodada.
// Campeão = 1, perdedor da final = 2, perdedores da semi = 3 (empatados), etc.
export function placementsFromBracket(bracket) {
  const rounds = bracket.rounds;
  const totalRounds = rounds.length;
  const placements = {};
  rounds.forEach((round, idx) => {
    const d = totalRounds - 1 - idx; // distância até a final
    const placement = Math.pow(2, d) + 1;
    round.forEach((m) => {
      if (!m.winner) return;
      const loserId = m.teamA === m.winner ? m.teamB : m.teamA;
      if (loserId) placements[loserId] = placement;
      if (idx === rounds.length - 1) placements[m.winner] = 1;
    });
  });
  return placements;
}

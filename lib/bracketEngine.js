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

// Trata "BYE" como se fosse uma dupla de verdade (sempre entra pra
// completar a chave até a próxima potência de 2), em vez de deixar um
// espaço vazio decidido automaticamente. Assim toda partida — mesmo as
// que envolvem um BYE — precisa que o organizador lance o resultado
// manualmente (dando a vitória pra dupla real e a derrota pro BYE).
export function isByeId(id) {
  return typeof id === 'string' && id.indexOf('BYE::') === 0;
}
function padWithByes(list, size) {
  const padded = [...list];
  let n = 1;
  while (padded.length < size) {
    padded.push({ id: 'BYE::' + n, name: 'BYE ' + n, seed: false, isBye: true });
    n++;
  }
  return padded;
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
    const padded = padWithByes(ordered, bracketSize);
    const order = seedOrder(bracketSize);
    const posTeam = order.map((rank) => padded[rank - 1]);
    const round1 = [];
    for (let i = 0; i < posTeam.length; i += 2) {
      const a = posTeam[i],
        b = posTeam[i + 1];
      round1.push({ id: uid('m'), teamA: a.id, teamB: b.id, sets: [], winner: null });
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

// Mantém a partida existente (com id e resultado) se as duplas forem as
// mesmas; se as duplas mudaram (ex.: resultado anterior foi corrigido ou
// um BYE foi trocado por uma dupla), a partida é zerada.
function reconcileMatch(existing, a, b, prefix) {
  const ta = a || null;
  const tb = b || null;
  if (existing && (existing.teamA || null) === ta && (existing.teamB || null) === tb) return autoBye(existing);
  return autoBye({ id: existing ? existing.id : uid(prefix), teamA: ta, teamB: tb, sets: [], winner: null });
}
// Jogo contra BYE já nasce com a vitória da dupla real (marcado como
// automático). Pode ser editado depois normalmente. Se for BYE x BYE,
// o primeiro avança só para a chave não travar.
function autoBye(m) {
  if (!m || m.winner || !m.teamA || !m.teamB) return m;
  const aBye = isByeId(m.teamA);
  const bBye = isByeId(m.teamB);
  if (aBye && !bBye) return { ...m, winner: m.teamB, auto: true };
  if (bBye && !aBye) return { ...m, winner: m.teamA, auto: true };
  if (aBye && bBye) return { ...m, winner: m.teamA, auto: true };
  return m;
}
function winnerOf(m) {
  return m && m.winner ? m.winner : null;
}
function loserOf(m) {
  if (!m || !m.winner) return null;
  return (m.teamA === m.winner ? m.teamB : m.teamA) || null;
}

// Monta a chave inteira desde o começo: cada jogo das fases seguintes já
// existe e fica disponível assim que as DUAS duplas dele estiverem
// definidas — não precisa esperar a rodada anterior terminar.
export function advanceBracket(bracket, includeThirdPlace) {
  if (!bracket) return { bracket, champion: null };
  const old = bracket.rounds;
  const rounds = [old[0].map(autoBye)];
  let size = old[0].length;
  let r = 1;
  while (size > 1) {
    size = size / 2;
    const prev = rounds[r - 1];
    const row = [];
    for (let i = 0; i < size; i++) {
      row.push(reconcileMatch(old[r] && old[r][i], winnerOf(prev[2 * i]), winnerOf(prev[2 * i + 1]), 'm'));
    }
    rounds.push(row);
    r++;
  }
  let thirdPlaceMatch = null;
  if (includeThirdPlace && rounds.length >= 2) {
    const semis = rounds[rounds.length - 2];
    if (semis.length === 2 && semis[0].winner && semis[1].winner) {
      thirdPlaceMatch = reconcileMatch(bracket.thirdPlaceMatch, loserOf(semis[0]), loserOf(semis[1]), 'm3');
    }
  }
  const finalMatch = rounds[rounds.length - 1][0];
  return { bracket: { rounds, thirdPlaceMatch }, champion: winnerOf(finalMatch) };
}

// Lista os "buracos" (BYE) da primeira rodada, para o organizador poder
// colocar uma dupla real no lugar.
export function listByeSlots(torneio) {
  if (!torneio) return [];
  const first = torneio.doubleElim
    ? torneio.doubleElim.winners.rounds[0]
    : torneio.bracket
    ? torneio.bracket.rounds[0]
    : [];
  const slots = [];
  first.forEach((m) => {
    [m.teamA, m.teamB].forEach((t) => {
      if (isByeId(t)) {
        const opp = m.teamA === t ? m.teamB : m.teamA;
        slots.push({ byeId: t, matchId: m.id, opponentId: opp, hasResult: Boolean(m.winner && !m.auto) });
      }
    });
  });
  return slots;
}

// Ids de duplas que já fazem parte do sorteio (grupos ou primeira rodada).
export function teamIdsInDraw(torneio) {
  const ids = new Set();
  if (!torneio) return ids;
  (torneio.groups || []).forEach((g) => g.teamIds.forEach((t) => ids.add(t)));
  const first = torneio.doubleElim
    ? torneio.doubleElim.winners.rounds[0]
    : torneio.bracket
    ? torneio.bracket.rounds[0]
    : [];
  first.forEach((m) => {
    if (m.teamA && !isByeId(m.teamA)) ids.add(m.teamA);
    if (m.teamB && !isByeId(m.teamB)) ids.add(m.teamB);
  });
  return ids;
}

// Troca um BYE por uma dupla real. O jogo do BYE é zerado e tudo que
// dependia dele nas fases seguintes é recalculado/zerado.
export function placeTeamOnBye(torneio, byeId, newId, includeThirdPlace) {
  const swap = (m) =>
    m.teamA === byeId || m.teamB === byeId
      ? { ...m, teamA: m.teamA === byeId ? newId : m.teamA, teamB: m.teamB === byeId ? newId : m.teamB, sets: [], winner: null, auto: false }
      : m;
  if (torneio.doubleElim) {
    const w = torneio.doubleElim.winners.rounds;
    const de = { ...torneio.doubleElim, winners: { rounds: [w[0].map(swap), ...w.slice(1)] } };
    return { ...torneio, doubleElim: { ...de, ...advanceDoubleElim(de, includeThirdPlace) } };
  }
  if (torneio.bracket) {
    const rr = torneio.bracket.rounds;
    const a = advanceBracket({ rounds: [rr[0].map(swap), ...rr.slice(1)], thirdPlaceMatch: torneio.bracket.thirdPlaceMatch }, includeThirdPlace);
    return { ...torneio, bracket: a.bracket, champion: a.champion };
  }
  return torneio;
}

// Melhores "próximos colocados" (ex.: melhores 3ºs) entre todos os grupos.
// Compara só pelos critérios numéricos (confronto direto não vale entre grupos).
export function bestNextPlaced(groups, groupMatches, tiebreak, qualifiersPerGroup, extra) {
  if (!extra || extra <= 0) return [];
  const crit = tiebreak.filter((c) => c !== 'confronto_direto');
  const candidates = groups
    .map((g) => computeStandings(g, groupMatches, tiebreak)[qualifiersPerGroup])
    .filter(Boolean);
  candidates.sort((a, b) => compareTeams(a, b, [], crit));
  return candidates.slice(0, extra);
}

export function generateKnockoutFromGroups(groups, groupMatches, tiebreak, qualifiersPerGroup, teams, extraQualifiers) {
  const rankedByGroup = groups.map((g) => computeStandings(g, groupMatches, tiebreak));
  let seedList = [];
  for (let pos = 0; pos < qualifiersPerGroup; pos++) {
    for (const ranked of rankedByGroup) {
      if (ranked[pos]) seedList.push(ranked[pos]);
    }
  }
  // melhores próximos colocados entram por último (menores cabeças)
  seedList = seedList.concat(bestNextPlaced(groups, groupMatches, tiebreak, qualifiersPerGroup, extraQualifiers));
  const teamsFull = seedList.map((t) => teams.find((tm) => tm.id === t.id)).filter(Boolean);
  if (teamsFull.length < 2) return null;
  const bracketSize = nextPow2(teamsFull.length);
  const padded = padWithByes(teamsFull, bracketSize);
  const order = seedOrder(bracketSize);
  const posTeam = order.map((rank) => padded[rank - 1]);
  const round1 = [];
  for (let i = 0; i < posTeam.length; i += 2) {
    const a = posTeam[i],
      b = posTeam[i + 1];
    round1.push({ id: uid('m'), teamA: a.id, teamB: b.id, sets: [], winner: null });
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
// Campeão = 1, perdedor da final = 2. Se houver disputa de 3º lugar
// (bracket.thirdPlaceMatch), o vencedor dela = 3 e o perdedor = 4.
// Sem disputa de 3º lugar, os dois semifinalistas eliminados ficam
// empatados em 3º (comportamento padrão).
export function placementsFromBracket(bracket) {
  const rounds = bracket.rounds;
  const totalRounds = rounds.length;
  const placements = {};
  rounds.forEach((round, idx) => {
    const d = totalRounds - 1 - idx; // distância até a final
    const isSemifinalRound = d === 1;
    round.forEach((m) => {
      if (!m.winner) return;
      const loserId = m.teamA === m.winner ? m.teamB : m.teamA;
      if (isSemifinalRound && bracket.thirdPlaceMatch) {
        // colocação desses dois é definida pela disputa de 3º lugar, abaixo
      } else {
        const placement = Math.pow(2, d) + 1;
        if (loserId) placements[loserId] = placement;
      }
      if (idx === rounds.length - 1) placements[m.winner] = 1;
    });
  });
  if (bracket.thirdPlaceMatch && bracket.thirdPlaceMatch.winner) {
    const tp = bracket.thirdPlaceMatch;
    placements[tp.winner] = 3;
    const loser = tp.teamA === tp.winner ? tp.teamB : tp.teamA;
    if (loser) placements[loser] = 4;
  }
  return placements;
}

// true se existe uma disputa de 3º lugar configurada mas ainda sem vencedor
// (usado para bloquear a finalização da etapa até esse jogo ser lançado)
export function thirdPlacePending(bracket) {
  return Boolean(bracket && bracket.thirdPlaceMatch && !bracket.thirdPlaceMatch.winner);
}

// ============================================================
// DUPLA ELIMINAÇÃO ATÉ A SEMIFINAL
// Chave principal (winners) roda até sobrarem exatamente 2 duplas
// invictas — elas NÃO jogam entre si. Em paralelo, a repescagem
// absorve os perdedores da chave principal rodada a rodada até
// também sobrarem exatamente 2 sobreviventes. Nesse momento, cada
// invicta cruza contra um sobrevivente da repescagem: são as duas
// semifinais. Vencedoras -> Final. Perdedoras -> disputa de 3º/4º
// (se habilitada). A partir daí é eliminação simples de verdade.
// Funciona de forma mais previsível com número de duplas em potência
// de 2 (4, 8, 16, 32) e a partir de 8 duplas.
// ============================================================

export function performDoubleElimDraw(teams) {
  const seeded = shuffle(teams.filter((t) => t.seed));
  const unseeded = shuffle(teams.filter((t) => !t.seed));
  const ordered = [...seeded, ...unseeded];
  const bracketSize = nextPow2(ordered.length);
  const padded = padWithByes(ordered, bracketSize);
  const order = seedOrder(bracketSize);
  const posTeam = order.map((rank) => padded[rank - 1]);
  const round1 = [];
  for (let i = 0; i < posTeam.length; i += 2) {
    const a = posTeam[i],
      b = posTeam[i + 1];
    round1.push({ id: uid('m'), teamA: a.id, teamB: b.id, sets: [], winner: null });
  }
  return {
    winners: { rounds: [round1] },
    losers: { rounds: [], nextGroupIndex: 0 },
    semifinals: null,
    finalMatch: null,
    thirdPlaceMatch: null,
    champion: null,
  };
}

export function advanceDoubleElim(state, includeThirdPlace) {
  const oldW = state.winners.rounds;
  const first = oldW[0].map(autoBye);
  const N = first.length * 2;
  const k = Math.round(Math.log2(N));

  // 1) Chave principal: jogos já existem; vai até sobrarem 2 partidas
  // (as 2 invictas não jogam entre si — cada uma vai pra uma semifinal).
  const winnersRounds = [first];
  for (let r = 1; r <= k - 2; r++) {
    const prev = winnersRounds[r - 1];
    const row = [];
    for (let i = 0; i < prev.length / 2; i++) {
      row.push(reconcileMatch(oldW[r] && oldW[r][i], winnerOf(prev[2 * i]), winnerOf(prev[2 * i + 1]), 'm'));
    }
    winnersRounds.push(row);
  }
  const winners = { rounds: winnersRounds };
  const wbLoser = (r, m) => loserOf(winnersRounds[r] && winnersRounds[r][m]);

  // 2) Repescagem: cada jogo fica disponível assim que as duas duplas
  // dele estão definidas (perdedores da chave principal + sobreviventes).
  const oldL = (state.losers && state.losers.rounds) || [];
  const totalGroups = k - 1;
  const lb = [];
  const resolve = (ref) => (ref.t === 'wl' ? wbLoser(ref.r, ref.m) : winnerOf(lb[ref.r] && lb[ref.r][ref.m]));
  const addRound = (descs) => {
    const idx = lb.length;
    lb.push(descs.map((d, i) => reconcileMatch(oldL[idx] && oldL[idx][i], resolve(d.a), resolve(d.b), 'm')));
  };
  const pairSurvivors = (idx, s) => {
    const d = [];
    for (let i = 0; i < s; i += 2) d.push({ a: { t: 'lw', r: idx, m: i }, b: { t: 'lw', r: idx, m: i + 1 } });
    return d;
  };
  let nextGroupIndex = 0;
  if (first.length >= 2 && totalGroups >= 1) {
    const d0 = [];
    for (let i = 0; i < first.length; i += 2) d0.push({ a: { t: 'wl', r: 0, m: i }, b: { t: 'wl', r: 0, m: i + 1 } });
    addRound(d0);
    nextGroupIndex = 1;
    let guard = 0;
    while (guard++ < 30) {
      const idx = lb.length - 1;
      const s = lb[idx].length;
      if (nextGroupIndex >= totalGroups) {
        if (s <= 2) break;
        addRound(pairSurvivors(idx, s));
      } else {
        const gs = N / Math.pow(2, nextGroupIndex + 1);
        if (gs === s) {
          const dist = totalGroups - 1 - nextGroupIndex;
          const d = [];
          for (let i = 0; i < s; i++) {
            d.push({ a: { t: 'lw', r: idx, m: i }, b: { t: 'wl', r: nextGroupIndex, m: dist % 2 === 0 ? gs - 1 - i : i } });
          }
          addRound(d);
          nextGroupIndex += 1;
        } else if (gs < s) {
          addRound(pairSurvivors(idx, s));
        } else break;
      }
    }
  }

  const wbLast = winnersRounds[winnersRounds.length - 1];
  const wbSurvivors = wbLast.length === 2 && wbLast.every((m) => m.winner) ? wbLast.map((m) => m.winner) : null;
  const lbLast = lb[lb.length - 1];
  const lbSurvivors = lbLast && lbLast.length === 2 && lbLast.every((m) => m.winner) ? lbLast.map((m) => m.winner) : null;

  // 3) Semifinais: 2 invictas x 2 sobreviventes. Regra inegociável: uma
  // dupla nunca reencontra, na semi, quem acabou de vencê-la na última
  // rodada da chave principal.
  let semifinals = null;
  if (wbSurvivors && lbSurvivors) {
    const [A, B] = wbSurvivors;
    const [X, Y] = lbSurvivors;
    const derrotouRecemente = {};
    wbLast.forEach((m) => {
      const loser = loserOf(m);
      if (loser) derrotouRecemente[m.winner] = loser;
    });
    const conflito1 = derrotouRecemente[A] === X || derrotouRecemente[B] === Y;
    const conflito2 = derrotouRecemente[A] === Y || derrotouRecemente[B] === X;
    const [semiB1, semiB2] = !conflito2 ? [Y, X] : !conflito1 ? [X, Y] : [Y, X];
    const oldS = state.semifinals || [];
    semifinals = [reconcileMatch(oldS[0], A, semiB1, 'sf'), reconcileMatch(oldS[1], B, semiB2, 'sf')];
  }

  let finalMatch = null;
  let thirdPlaceMatch = null;
  if (semifinals && semifinals.every((m) => m.winner)) {
    finalMatch = reconcileMatch(state.finalMatch, semifinals[0].winner, semifinals[1].winner, 'mf');
    if (includeThirdPlace) {
      thirdPlaceMatch = reconcileMatch(state.thirdPlaceMatch, loserOf(semifinals[0]), loserOf(semifinals[1]), 'mt');
    }
  }
  const champion = finalMatch && finalMatch.winner ? finalMatch.winner : null;

  return {
    winners,
    losers: { rounds: lb, nextGroupIndex },
    semifinals,
    finalMatch,
    thirdPlaceMatch,
    champion,
  };
}

export function thirdPlacePendingDoubleElim(state) {
  return Boolean(state.thirdPlaceMatch && !state.thirdPlaceMatch.winner);
}

export function placementsFromDoubleElim(state) {
  const placements = {};
  const allTeamIds = new Set();
  state.winners.rounds.forEach((round) =>
    round.forEach((m) => {
      if (m.teamA) allTeamIds.add(m.teamA);
      if (m.teamB) allTeamIds.add(m.teamB);
    })
  );
  const totalReal = allTeamIds.size;
  let eliminatedSoFar = 0;

  // Toda rodada da repescagem elimina de verdade agora (não há mais
  // uma "rodada final" especial dentro dela — a repescagem termina
  // exatamente com 2 sobreviventes, que seguem para as semifinais).
  const lbRounds = state.losers.rounds;
  for (let i = 0; i < lbRounds.length; i++) {
    const round = lbRounds[i];
    if (!round.every((m) => m.winner)) break;
    const losersHere = round.map((m) => (m.teamA === m.winner ? m.teamB : m.teamA)).filter(Boolean);
    eliminatedSoFar += losersHere.length;
    const placement = totalReal - eliminatedSoFar + 1;
    losersHere.forEach((tid) => {
      placements[tid] = placement;
    });
  }

  if (state.finalMatch && state.finalMatch.winner) {
    placements[state.finalMatch.winner] = 1;
    const runnerUp = state.finalMatch.teamA === state.finalMatch.winner ? state.finalMatch.teamB : state.finalMatch.teamA;
    if (runnerUp) placements[runnerUp] = 2;
  }
  if (state.thirdPlaceMatch && state.thirdPlaceMatch.winner) {
    placements[state.thirdPlaceMatch.winner] = 3;
    const fourth = state.thirdPlaceMatch.teamA === state.thirdPlaceMatch.winner ? state.thirdPlaceMatch.teamB : state.thirdPlaceMatch.teamA;
    if (fourth) placements[fourth] = 4;
  } else if (state.semifinals && state.semifinals.every((m) => m.winner)) {
    const loser1 = state.semifinals[0].teamA === state.semifinals[0].winner ? state.semifinals[0].teamB : state.semifinals[0].teamA;
    const loser2 = state.semifinals[1].teamA === state.semifinals[1].winner ? state.semifinals[1].teamB : state.semifinals[1].teamA;
    if (loser1) placements[loser1] = 3;
    if (loser2) placements[loser2] = 3;
  }
  return placements;
}

// Atualiza um torneio salvo antes das últimas melhorias (jogos adiantados
// e vitória automática contra BYE) sem perder nenhum resultado já lançado.
export function normalizeTorneio(torneio, includeThirdPlace) {
  if (!torneio) return torneio;
  if (torneio.doubleElim) {
    return { ...torneio, doubleElim: { ...torneio.doubleElim, ...advanceDoubleElim(torneio.doubleElim, includeThirdPlace) } };
  }
  if (torneio.bracket) {
    const a = advanceBracket(torneio.bracket, includeThirdPlace);
    return { ...torneio, bracket: a.bracket, champion: a.champion };
  }
  return torneio;
}

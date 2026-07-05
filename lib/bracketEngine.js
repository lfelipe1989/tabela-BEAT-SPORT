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

export function advanceBracket(bracket, includeThirdPlace) {
  if (!bracket) return { bracket, champion: null };
  const rounds = [...bracket.rounds];
  let thirdPlaceMatch = bracket.thirdPlaceMatch || null;
  let last = rounds[rounds.length - 1];
  let champion = null;
  while (true) {
    if (last.length === 1) {
      if (last[0].winner) champion = last[0].winner;
      break;
    }
    if (last.every((m) => m.winner)) {
      if (last.length === 2 && includeThirdPlace && !thirdPlaceMatch) {
        const loserA = last[0].teamA === last[0].winner ? last[0].teamB : last[0].teamA;
        const loserB = last[1].teamA === last[1].winner ? last[1].teamB : last[1].teamA;
        if (loserA && loserB) {
          thirdPlaceMatch = { id: uid('m3'), teamA: loserA, teamB: loserB, sets: [], winner: null };
        }
      }
      const next = [];
      for (let i = 0; i < last.length; i += 2) {
        next.push({ id: uid('m'), teamA: last[i].winner, teamB: last[i + 1].winner, sets: [], winner: null });
      }
      rounds.push(next);
      last = next;
    } else break;
  }
  return { bracket: { rounds, thirdPlaceMatch }, champion };
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
// Chave principal (winners) + repescagem (losers) rodando em paralelo.
// Assim que sobram 4 duplas (2 invictas na final da chave principal,
// 2 sobreviventes na final da repescagem), essas duas "finais" viram
// as duas semifinais: os vencedores vão pra Final, os perdedores para
// a disputa de 3º/4º (se habilitada). Funciona de forma mais previsível
// com número de duplas em potência de 2 (4, 8, 16, 32).
// ============================================================

function pairMatches(teamIds) {
  const matches = [];
  for (let i = 0; i < teamIds.length; i += 2) {
    const a = teamIds[i],
      b = teamIds[i + 1];
    let winner = null;
    if (a && !b) winner = a;
    if (b && !a) winner = b;
    matches.push({ id: uid('m'), teamA: a || null, teamB: b || null, sets: [], winner });
  }
  return matches;
}

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
    finalMatch: null,
    thirdPlaceMatch: null,
    champion: null,
  };
}

export function advanceDoubleElim(state, includeThirdPlace) {
  let winners = state.winners;
  let losersRounds = [...((state.losers && state.losers.rounds) || [])];
  let nextGroupIndex = (state.losers && state.losers.nextGroupIndex) || 0;
  let finalMatch = state.finalMatch || null;
  let thirdPlaceMatch = state.thirdPlaceMatch || null;

  // Chave principal: avança sozinha e já para na própria final (2 duplas).
  const wbAdv = advanceBracket(winners);
  winners = wbAdv.bracket;
  const semifinalAWinner = wbAdv.champion;

  const bracketSize = winners.rounds[0].length * 2;
  const k = Math.round(Math.log2(bracketSize));
  const totalGroups = k - 1; // grupos de perdedores disponíveis: rodadas 0..k-2

  // Grupos de perdedores da chave principal, na medida em que cada
  // rodada dela vai sendo decidida (a rodada final, k-1, não entra
  // aqui — o perdedor dela vai direto pra disputa de 3º/4º).
  const wbLoserGroups = [];
  for (let r = 0; r <= k - 2; r++) {
    const round = winners.rounds[r];
    if (round && round.every((m) => m.winner)) {
      wbLoserGroups[r] = round.map((m) => (m.teamA === m.winner ? m.teamB : m.teamA)).filter(Boolean);
    } else {
      break;
    }
  }

  let progressed = true;
  while (progressed) {
    progressed = false;

    if (losersRounds.length === 0) {
      if (wbLoserGroups[0] && wbLoserGroups[0].length >= 2) {
        losersRounds.push(pairMatches(wbLoserGroups[0]));
        nextGroupIndex = 1;
        progressed = true;
      }
      continue;
    }

    const lastRound = losersRounds[losersRounds.length - 1];
    if (!lastRound.every((m) => m.winner)) continue; // esperando resultado
    const survivors = lastRound.map((m) => m.winner);
    if (survivors.length <= 1) continue; // repescagem já decidida (semifinal B)

    if (nextGroupIndex >= totalGroups) {
      // não há mais grupos pra injetar: sobreviventes só jogam entre si
      losersRounds.push(pairMatches(survivors));
      progressed = true;
    } else {
      const nextGroup = wbLoserGroups[nextGroupIndex];
      if (nextGroup) {
        if (nextGroup.length === survivors.length) {
          // rodada de absorção: sobreviventes + próximo grupo de perdedores
          losersRounds.push(pairMatches([...survivors, ...nextGroup]));
          nextGroupIndex += 1;
          progressed = true;
        } else if (nextGroup.length < survivors.length) {
          // ainda não é hora de absorver: sobreviventes jogam entre si primeiro
          losersRounds.push(pairMatches(survivors));
          progressed = true;
        }
        // se nextGroup.length > survivors.length, bracket irregular (raro): não avança essa rodada
      }
      // se nextGroup ainda não existir (rodada da chave principal ainda não decidida), espera
    }
  }

  const lbFinalRound = losersRounds[losersRounds.length - 1];
  const semifinalBDecided = Boolean(lbFinalRound && lbFinalRound.length === 1 && lbFinalRound[0].winner);
  const semifinalBWinner = semifinalBDecided ? lbFinalRound[0].winner : null;

  if (semifinalAWinner && semifinalBWinner && !finalMatch) {
    finalMatch = { id: uid('mf'), teamA: semifinalAWinner, teamB: semifinalBWinner, sets: [], winner: null };
  }
  if (includeThirdPlace && semifinalAWinner && semifinalBWinner && !thirdPlaceMatch) {
    const wbFinalRound = winners.rounds[winners.rounds.length - 1];
    let semifinalALoser = null;
    if (wbFinalRound.length === 1 && wbFinalRound[0].winner) {
      const m = wbFinalRound[0];
      semifinalALoser = m.teamA === m.winner ? m.teamB : m.teamA;
    }
    const semifinalBLoser = lbFinalRound[0].teamA === semifinalBWinner ? lbFinalRound[0].teamB : lbFinalRound[0].teamA;
    if (semifinalALoser && semifinalBLoser) {
      thirdPlaceMatch = { id: uid('mt'), teamA: semifinalALoser, teamB: semifinalBLoser, sets: [], winner: null };
    }
  }

  const champion = finalMatch && finalMatch.winner ? finalMatch.winner : null;

  return {
    winners,
    losers: { rounds: losersRounds, nextGroupIndex },
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

  const lbRounds = state.losers.rounds;
  for (let i = 0; i < lbRounds.length - 1; i++) {
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
  } else {
    const wbFinalRound = state.winners.rounds[state.winners.rounds.length - 1];
    if (wbFinalRound && wbFinalRound.length === 1 && wbFinalRound[0].winner) {
      const m = wbFinalRound[0];
      const loser = m.teamA === m.winner ? m.teamB : m.teamA;
      if (loser) placements[loser] = 3;
    }
    if (lbRounds.length && lbRounds[lbRounds.length - 1].length === 1 && lbRounds[lbRounds.length - 1][0].winner) {
      const m = lbRounds[lbRounds.length - 1][0];
      const loser = m.teamA === m.winner ? m.teamB : m.teamA;
      if (loser) placements[loser] = 3;
    }
  }
  return placements;
}

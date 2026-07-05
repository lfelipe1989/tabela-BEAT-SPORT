'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import {
  computeStandings,
  computeSetsResult,
  advanceBracket,
  generateKnockoutFromGroups,
  placementsFromBracket,
  thirdPlacePending,
  roundLabel,
} from '../../../../lib/bracketEngine';
import { pontosPorColocacao } from '../../../../lib/ranking';

const TIEBREAK = ['confronto_direto', 'vitorias', 'saldo_sets', 'saldo_pontos', 'sets_pro', 'pontos_pro'];

export default function LancarResultadoPageWrapper() {
  return (
    <Suspense fallback={<div className="page"><div className="empty-hint">Carregando...</div></div>}>
      <LancarResultadoPage />
    </Suspense>
  );
}

function LancarResultadoPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('t') || '';

  const [etapa, setEtapa] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [atletas, setAtletas] = useState([]);
  const [torneio, setTorneio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editingSets, setEditingSets] = useState([[0, 0], [0, 0], [0, 0]]);
  const [busy, setBusy] = useState(false);
  const [finalResults, setFinalResults] = useState(null);

  const load = useCallback(async () => {
    const { data: e } = await supabase.from('etapas').select('*').eq('id', id).single();
    setEtapa(e);
    const { data: parts } = await supabase.from('etapa_participantes').select('*').eq('etapa_id', id);
    setParticipantes(parts || []);
    const { data: al } = await supabase.from('atletas').select('*').order('nome');
    setAtletas(al || []);
    if (e && e.estado_chaveamento) setTorneio(e.estado_chaveamento);
    if (e && e.status === 'finalizada') {
      const { data: res } = await supabase.from('etapa_resultados').select('*').eq('etapa_id', id).order('colocacao');
      setFinalResults(res || []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  function atletaNome(aid) {
    const a = atletas.find((x) => x.id === aid);
    return a ? a.apelido || a.nome : '—';
  }
  function participanteNome(pid) {
    const p = participantes.find((x) => x.id === pid);
    if (!p) return '—';
    return p.atleta2_id ? `${atletaNome(p.atleta1_id)} / ${atletaNome(p.atleta2_id)}` : atletaNome(p.atleta1_id);
  }

  async function saveEstado(t, status) {
    await fetch(`/api/etapas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-etapa-token': token },
      body: JSON.stringify({ estado_chaveamento: t, status: status || 'em_andamento' }),
    });
  }

  function openEdit(matchId) {
    setEditingMatchId(matchId);
    setEditingSets([[0, 0], [0, 0], [0, 0]]);
  }

  function saveMatch(matchId, isBracket) {
    const sets = editingSets.filter((s) => (s[0] || 0) !== 0 || (s[1] || 0) !== 0);
    if (sets.length === 0) {
      alert('Informe o placar de ao menos um set.');
      return;
    }
    const r = computeSetsResult(sets);
    setTorneio((prev) => {
      let next = { ...prev };
      if (!isBracket) {
        next.groupMatches = next.groupMatches.map((m) => {
          if (m.id !== matchId) return m;
          const winner = r.setsA > r.setsB ? m.teamA : r.setsB > r.setsA ? m.teamB : null;
          return { ...m, sets, winner };
        });
      } else if (next.bracket.thirdPlaceMatch && next.bracket.thirdPlaceMatch.id === matchId) {
        const tp = next.bracket.thirdPlaceMatch;
        const winner = r.setsA > r.setsB ? tp.teamA : r.setsB > r.setsA ? tp.teamB : null;
        next.bracket = { ...next.bracket, thirdPlaceMatch: { ...tp, sets, winner } };
      } else {
        const rounds = next.bracket.rounds.map((round) =>
          round.map((m) => {
            if (m.id !== matchId) return m;
            const winner = r.setsA > r.setsB ? m.teamA : r.setsB > r.setsA ? m.teamB : null;
            return { ...m, sets, winner };
          })
        );
        const advanced = advanceBracket({ rounds, thirdPlaceMatch: next.bracket.thirdPlaceMatch }, etapa.disputa_terceiro);
        next.bracket = advanced.bracket;
        next.champion = advanced.champion;
      }
      saveEstado(next, 'em_andamento');
      return next;
    });
    setEditingMatchId(null);
  }

  function handleGenKnockout() {
    const qtd = torneio.qualifiersPerGroup || 2;
    let bracket = generateKnockoutFromGroups(torneio.groups, torneio.groupMatches, TIEBREAK, qtd, participantes.map((p) => ({ id: p.id })));
    if (!bracket) {
      alert('Não há duplas suficientes classificadas.');
      return;
    }
    const adv = advanceBracket(bracket, etapa.disputa_terceiro);
    setTorneio((prev) => {
      const next = { ...prev, bracket: adv.bracket, champion: adv.champion };
      saveEstado(next, 'em_andamento');
      return next;
    });
  }

  async function handleFinalizar() {
    if (torneio.bracket && thirdPlacePending(torneio.bracket)) {
      alert('A disputa de 3º lugar está habilitada e ainda não tem resultado. Lance o resultado dela antes de finalizar.');
      return;
    }
    let colocacoes = {};
    if (torneio.bracket) {
      colocacoes = placementsFromBracket(torneio.bracket);
    } else if (torneio.groups && torneio.groups.length) {
      torneio.groups.forEach((g) => {
        const standings = computeStandings(g, torneio.groupMatches, TIEBREAK);
        standings.forEach((t, i) => {
          colocacoes[t.id] = i + 1;
        });
      });
    }
    if (Object.keys(colocacoes).length === 0) {
      alert('Nenhum resultado disponível ainda.');
      return;
    }
    const { data: pontosTabela } = await supabase.from('pontos_colocacao').select('*');
    const resultados = Object.entries(colocacoes).map(([participante_id, colocacao]) => ({
      participante_id,
      colocacao,
      pontos: pontosPorColocacao(colocacao, pontosTabela || []),
    }));
    setBusy(true);
    const res = await fetch(`/api/etapas/${id}/resultados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-etapa-token': token },
      body: JSON.stringify({ resultados }),
    });
    setBusy(false);
    if (res.ok) load();
    else alert('Erro ao salvar resultados finais. Verifique se o link ainda é válido.');
  }

  if (loading) return <div className="page"><div className="empty-hint">Carregando...</div></div>;
  if (!etapa) return <div className="page"><div className="empty-hint">Etapa não encontrada.</div></div>;
  if (!token) return <div className="page"><div className="empty-hint">Link inválido: falta o código de acesso.</div></div>;

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">
            <span className="icon">📝</span>
            <h1 className="brand-title">{etapa.nome}</h1>
          </div>
        </div>
      </header>

      <div className="warning-box">Você está lançando resultados desta etapa por um link compartilhado. Dá pra registrar placares e avançar as fases, mas não pra editar duplas ou apagar a etapa.</div>

      {etapa.status === 'finalizada' && finalResults && (
        <div className="card">
          <h2 className="section-title">🏆 Resultado final</h2>
          <table className="standings">
            <thead>
              <tr>
                <th>Colocação</th>
                <th>Dupla</th>
                <th>Pontos</th>
              </tr>
            </thead>
            <tbody>
              {finalResults.map((r) => (
                <tr key={r.id}>
                  <td>{r.colocacao}º</td>
                  <td>{participanteNome(r.participante_id)}</td>
                  <td>{r.pontos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!torneio && <div className="empty-hint">O sorteio desta etapa ainda não foi realizado pelo organizador.</div>}

      {torneio && torneio.groups && torneio.groups.length > 0 && (
        <>
          <h2 className="section-title">Fase de grupos</h2>
          <div className="groups-grid">
            {torneio.groups.map((g) => {
              const standings = computeStandings(g, torneio.groupMatches, TIEBREAK);
              const matches = torneio.groupMatches.filter((m) => m.groupId === g.id);
              const qtd = torneio.qualifiersPerGroup || 2;
              return (
                <div className="card group-card" key={g.id}>
                  <h3>{g.name}</h3>
                  <table className="standings">
                    <thead>
                      <tr>
                        <th>Dupla</th>
                        <th>J</th>
                        <th>V</th>
                        <th>Sets</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((t, i) => (
                        <tr key={t.id} className={i < qtd ? 'qualified' : ''}>
                          <td>{participanteNome(t.id)}</td>
                          <td>{t.jogos}</td>
                          <td>{t.vitorias}</td>
                          <td>{t.setsPro}-{t.setsContra}</td>
                          <td>{t.saldoSets > 0 ? '+' : ''}{t.saldoSets}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 12 }}>
                    {matches.map((m) => (
                      <MatchRow
                        key={m.id}
                        m={m}
                        participanteNome={participanteNome}
                        editing={editingMatchId === m.id}
                        editingSets={editingSets}
                        setEditingSets={setEditingSets}
                        onEdit={() => openEdit(m.id)}
                        onCancel={() => setEditingMatchId(null)}
                        onSave={() => saveMatch(m.id, false)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {etapa.formato === 'grupos_eliminatoria' && !torneio.bracket && (
            <div className="footer-actions">
              <button className="btn btn-primary" onClick={handleGenKnockout}>
                🏆 Gerar fase eliminatória
              </button>
            </div>
          )}
          {etapa.formato === 'grupos_apenas' && etapa.status !== 'finalizada' && (
            <div className="footer-actions">
              <button className="btn btn-primary" onClick={handleFinalizar} disabled={busy}>
                ✅ Finalizar etapa e salvar ranking
              </button>
            </div>
          )}
        </>
      )}

      {torneio && torneio.bracket && (
        <>
          <h2 className="section-title">Eliminatórias</h2>
          <div className="bracket-scroll">
            <div className="bracket">
              {torneio.bracket.rounds.map((round, idx) => (
                <div className="round-col" key={idx}>
                  <div className="round-label">{roundLabel(Math.log2(torneio.bracket.rounds[0].length * 2), idx)}</div>
                  {round.map((m) => (
                    <div className="match-box" key={m.id}>
                      <div className={`side ${m.winner && m.winner === m.teamA ? 'winner' : ''} ${!m.teamA ? 'bye' : ''}`}>
                        {m.teamA ? participanteNome(m.teamA) : '—'}
                      </div>
                      <div className="vs-div"></div>
                      <div className={`side ${m.winner && m.winner === m.teamB ? 'winner' : ''} ${!m.teamB ? 'bye' : ''}`}>
                        {m.teamB ? participanteNome(m.teamB) : '—'}
                      </div>
                      {m.teamA && m.teamB && !m.winner && editingMatchId !== m.id && (
                        <span className="edit-link" onClick={() => openEdit(m.id)}>✏️ Resultado</span>
                      )}
                      {m.teamA && m.teamB && m.winner && editingMatchId !== m.id && (
                        <span className="edit-link" onClick={() => openEdit(m.id)}>✏️ Editar</span>
                      )}
                      {editingMatchId === m.id && (
                        <SetsForm
                          editingSets={editingSets}
                          setEditingSets={setEditingSets}
                          onSave={() => saveMatch(m.id, true)}
                          onCancel={() => setEditingMatchId(null)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {torneio.bracket.thirdPlaceMatch && (
            <div className="card" style={{ maxWidth: 320 }}>
              <h3 style={{ fontFamily: 'Anton', fontWeight: 400, fontSize: 16, margin: '0 0 10px', color: 'var(--ocean-dark)' }}>
                🥉 Disputa de 3º lugar
              </h3>
              <MatchRow
                m={torneio.bracket.thirdPlaceMatch}
                participanteNome={participanteNome}
                editing={editingMatchId === torneio.bracket.thirdPlaceMatch.id}
                editingSets={editingSets}
                setEditingSets={setEditingSets}
                onEdit={() => openEdit(torneio.bracket.thirdPlaceMatch.id)}
                onCancel={() => setEditingMatchId(null)}
                onSave={() => saveMatch(torneio.bracket.thirdPlaceMatch.id, true)}
              />
            </div>
          )}
          {torneio.champion && etapa.status !== 'finalizada' && (
            <div className="champion-box">
              <div className="trophy">🏆</div>
              <div className="clabel">Campeão da etapa</div>
              <div className="cname">{participanteNome(torneio.champion)}</div>
              <div className="footer-actions" style={{ justifyContent: 'center', marginTop: 14 }}>
                <button className="btn btn-primary" onClick={handleFinalizar} disabled={busy}>
                  ✅ Salvar resultado final no ranking
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MatchRow({ m, participanteNome, editing, editingSets, setEditingSets, onEdit, onCancel, onSave }) {
  const isBye = !m.teamA || !m.teamB;
  const r = m.sets && m.sets.length ? computeSetsResult(m.sets) : null;
  return (
    <div className="match-row">
      <div className="match-top">
        <div className="match-teams">
          {participanteNome(m.teamA)} <span style={{ color: '#aaa' }}>vs</span> {participanteNome(m.teamB)}
        </div>
        {r && <div className="match-score">{r.setsA} x {r.setsB}</div>}
        <div className={`match-status ${m.winner ? 'status-done' : 'status-pending'}`}>
          {m.winner ? 'Concluída' : isBye ? 'BYE' : 'Pendente'}
        </div>
      </div>
      {!isBye && !m.winner && !editing && (
        <button className="btn btn-sm btn-ghost" onClick={onEdit} style={{ marginTop: 6 }}>✏️ Registrar resultado</button>
      )}
      {!isBye && m.winner && !editing && (
        <button className="btn btn-sm btn-ghost" onClick={onEdit} style={{ marginTop: 6 }}>✏️ Editar resultado</button>
      )}
      {editing && <SetsForm editingSets={editingSets} setEditingSets={setEditingSets} onSave={onSave} onCancel={onCancel} />}
    </div>
  );
}

function SetsForm({ editingSets, setEditingSets, onSave, onCancel }) {
  function updateSet(i, side, val) {
    const copy = editingSets.map((s) => [...s]);
    copy[i][side] = parseInt(val) || 0;
    setEditingSets(copy);
  }
  return (
    <div className="sets-form">
      {editingSets.map((s, i) => (
        <div className="set-row" key={i}>
          <span>Set {i + 1}:</span>
          <input type="number" min="0" value={s[0]} onChange={(e) => updateSet(i, 0, e.target.value)} />
          <span>x</span>
          <input type="number" min="0" value={s[1]} onChange={(e) => updateSet(i, 1, e.target.value)} />
        </div>
      ))}
      <div className="sets-actions">
        <button className="btn btn-sm btn-ghost" onClick={() => setEditingSets([...editingSets, [0, 0]])}>+ Set</button>
        <button className="btn btn-sm btn-ocean" onClick={onSave}>Salvar resultado</button>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

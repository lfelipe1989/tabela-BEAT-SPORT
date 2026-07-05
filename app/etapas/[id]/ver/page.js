'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { computeStandings, computeSetsResult, roundLabel } from '../../../../lib/bracketEngine';

const TIEBREAK = ['confronto_direto', 'vitorias', 'saldo_sets', 'saldo_pontos', 'sets_pro', 'pontos_pro'];
const FORMATOS = {
  grupos_eliminatoria: 'Grupos + eliminatórias',
  eliminatoria_simples: 'Eliminatória simples',
  grupos_apenas: 'Somente grupos',
};
const MODALIDADES = { volei: '🏐 Vôlei de praia', futevolei: '⚽ Futevôlei', beach_tenis: '🎾 Beach tênis' };

export default function VerEtapaPage() {
  const { id } = useParams();
  const [etapa, setEtapa] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [atletas, setAtletas] = useState([]);
  const [torneio, setTorneio] = useState(null);
  const [finalResults, setFinalResults] = useState(null);
  const [loading, setLoading] = useState(true);

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
    if (!id) return;
    load();
    const interval = setInterval(load, 15000); // atualiza sozinho a cada 15s
    return () => clearInterval(interval);
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

  if (loading) return <div className="page"><div className="empty-hint">Carregando...</div></div>;
  if (!etapa) return <div className="page"><div className="empty-hint">Etapa não encontrada.</div></div>;

  const qualifiersPerGroup = (torneio && torneio.qualifiersPerGroup) || 2;

  // partidas pendentes (para "próximos confrontos")
  let proximos = [];
  if (torneio) {
    const groupPend = (torneio.groupMatches || []).filter((m) => m.teamA && m.teamB && !m.winner);
    let bracketPend = [];
    if (torneio.bracket) {
      torneio.bracket.rounds.forEach((round) => {
        round.forEach((m) => {
          if (m.teamA && m.teamB && !m.winner) bracketPend.push(m);
        });
      });
      if (torneio.bracket.thirdPlaceMatch && !torneio.bracket.thirdPlaceMatch.winner && torneio.bracket.thirdPlaceMatch.teamA) {
        bracketPend.push(torneio.bracket.thirdPlaceMatch);
      }
    }
    proximos = [...groupPend, ...bracketPend];
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">
            <span className="icon">👀</span>
            <h1 className="brand-title">{etapa.nome}</h1>
          </div>
        </div>
      </header>

      <div className="card">
        <div className="grid2">
          <div>
            <span className="field-label">Modalidade</span>
            <div>{MODALIDADES[etapa.modalidade]}</div>
          </div>
          <div>
            <span className="field-label">Formato</span>
            <div>{FORMATOS[etapa.formato]}</div>
          </div>
        </div>
      </div>

      {etapa.status === 'finalizada' && finalResults && (
        <div className="card">
          <h2 className="section-title">🏆 Resultado final</h2>
          <table className="standings">
            <thead>
              <tr>
                <th>Colocação</th>
                <th>Dupla</th>
              </tr>
            </thead>
            <tbody>
              {finalResults.map((r) => (
                <tr key={r.id}>
                  <td>{r.colocacao}º</td>
                  <td>{participanteNome(r.participante_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!torneio && (
        <div className="empty-hint">O sorteio desta etapa ainda não foi realizado.</div>
      )}

      {proximos.length > 0 && (
        <>
          <h2 className="section-title">▶️ Próximos confrontos</h2>
          <div className="card">
            {proximos.map((m) => (
              <div className="match-row" key={m.id}>
                <div className="match-top">
                  <div className="match-teams">
                    {participanteNome(m.teamA)} <span style={{ color: '#aaa' }}>vs</span> {participanteNome(m.teamB)}
                  </div>
                  <div className="match-status status-pending">Pendente</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {torneio && torneio.groups && torneio.groups.length > 0 && (
        <>
          <h2 className="section-title">Fase de grupos</h2>
          <div className="groups-grid">
            {torneio.groups.map((g) => {
              const standings = computeStandings(g, torneio.groupMatches, TIEBREAK);
              const matches = torneio.groupMatches.filter((m) => m.groupId === g.id);
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
                        <tr key={t.id} className={i < qualifiersPerGroup ? 'qualified' : ''}>
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
                    {matches.filter((m) => m.winner).map((m) => {
                      const r = computeSetsResult(m.sets);
                      return (
                        <div className="match-row" key={m.id}>
                          <div className="match-top">
                            <div className="match-teams">
                              {participanteNome(m.teamA)} <span style={{ color: '#aaa' }}>vs</span> {participanteNome(m.teamB)}
                            </div>
                            <div className="match-score">{r.setsA} x {r.setsB}</div>
                            <div className="match-status status-done">Concluída</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
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
              <div className="match-box">
                <div className={`side ${torneio.bracket.thirdPlaceMatch.winner === torneio.bracket.thirdPlaceMatch.teamA ? 'winner' : ''}`}>
                  {participanteNome(torneio.bracket.thirdPlaceMatch.teamA)}
                </div>
                <div className="vs-div"></div>
                <div className={`side ${torneio.bracket.thirdPlaceMatch.winner === torneio.bracket.thirdPlaceMatch.teamB ? 'winner' : ''}`}>
                  {participanteNome(torneio.bracket.thirdPlaceMatch.teamB)}
                </div>
              </div>
            </div>
          )}
          {torneio.champion && (
            <div className="champion-box">
              <div className="trophy">🏆</div>
              <div className="clabel">Campeão da etapa</div>
              <div className="cname">{participanteNome(torneio.champion)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

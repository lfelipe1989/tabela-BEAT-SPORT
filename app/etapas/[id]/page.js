'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { getAdminPassword } from '../../../lib/adminClient';
import PageHeader from '../../../components/PageHeader';
import {
  performDraw,
  computeStandings,
  computeSetsResult,
  advanceBracket,
  generateKnockoutFromGroups,
  placementsFromBracket,
  thirdPlacePending,
  roundLabel,
  performDoubleElimDraw,
  advanceDoubleElim,
  placementsFromDoubleElim,
  thirdPlacePendingDoubleElim,
  isByeId,
} from '../../../lib/bracketEngine';
import { pontosPorColocacao } from '../../../lib/ranking';

const TIEBREAK = ['confronto_direto', 'vitorias', 'saldo_sets', 'saldo_pontos', 'sets_pro', 'pontos_pro'];
const FORMATOS = {
  grupos_eliminatoria: 'Grupos + eliminatórias',
  eliminatoria_simples: 'Eliminatória simples',
  grupos_apenas: 'Somente grupos',
  dupla_eliminatoria_ate_semi: 'Dupla eliminação até a semifinal',
};
const MODALIDADES = { volei: '🏐 Vôlei de praia', futevolei: '⚽ Futevôlei', beach_tenis: '🎾 Beach tênis' };

export default function EtapaPage() {
  const { id } = useParams();
  const router = useRouter();
  const [etapa, setEtapa] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [atletas, setAtletas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [torneio, setTorneio] = useState(null);
  const [numGroups, setNumGroups] = useState(2);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editingSets, setEditingSets] = useState([[0, 0], [0, 0], [0, 0]]);
  const [finalResults, setFinalResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pForm, setPForm] = useState({ atleta1_id: '', atleta2_id: '', cabeca_de_chave: false });
  const [editingEtapa, setEditingEtapa] = useState(false);
  const [etapaForm, setEtapaForm] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [loadingToken, setLoadingToken] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: e } = await supabase.from('etapas').select('*').eq('id', id).single();
    setEtapa(e);
    setEtapaForm(e);
    const { data: parts } = await supabase.from('etapa_participantes').select('*').eq('etapa_id', id);
    setParticipantes(parts || []);
    const { data: al } = await supabase.from('atletas').select('*').order('nome');
    setAtletas(al || []);

    if (e && e.estado_chaveamento) {
      setTorneio(e.estado_chaveamento);
    }
    if (e && e.status === 'finalizada') {
      const { data: res } = await supabase.from('etapa_resultados').select('*').eq('etapa_id', id).order('colocacao');
      setFinalResults(res || []);
    } else {
      setFinalResults(null);
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
    if (isByeId(pid)) return 'BYE';
    const p = participantes.find((x) => x.id === pid);
    if (!p) return '—';
    return p.atleta2_id ? `${atletaNome(p.atleta1_id)} / ${atletaNome(p.atleta2_id)}` : atletaNome(p.atleta1_id);
  }

  const teams = participantes.map((p) => ({ id: p.id, name: participanteNome(p.id), seed: p.cabeca_de_chave }));

  async function saveEstado(t, status) {
    const password = getAdminPassword();
    await fetch(`/api/etapas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ estado_chaveamento: t, status: status || 'em_andamento' }),
    });
  }

  async function handleAddParticipante(e) {
    e.preventDefault();
    if (!pForm.atleta1_id) return;
    setBusy(true);
    const password = getAdminPassword();
    const res = await fetch(`/api/etapas/${id}/participantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify(pForm),
    });
    setBusy(false);
    if (res.ok) {
      setPForm({ atleta1_id: '', atleta2_id: '', cabeca_de_chave: false });
      load();
    } else {
      alert((await res.json()).error || 'Erro ao adicionar dupla');
    }
  }

  async function handleRemoveParticipante(pid) {
    if (!confirm('Remover esta dupla da etapa?')) return;
    const password = getAdminPassword();
    const res = await fetch(`/api/etapas/${id}/participantes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ participante_id: pid }),
    });
    if (res.ok) load();
  }

  async function handleSaveEtapa(e) {
    e.preventDefault();
    const password = getAdminPassword();
    const res = await fetch(`/api/etapas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({
        nome: etapaForm.nome,
        modalidade: etapaForm.modalidade,
        formato: etapaForm.formato,
        data_evento: etapaForm.data_evento,
        disputa_terceiro: etapaForm.disputa_terceiro,
      }),
    });
    if (res.ok) {
      setEditingEtapa(false);
      load();
    } else {
      alert((await res.json()).error || 'Erro ao salvar etapa');
    }
  }

  async function handleDeleteEtapa() {
    if (!confirm(`Excluir a etapa "${etapa.nome}"? Isso apaga duplas e resultados dela. Essa ação não pode ser desfeita.`)) return;
    const password = getAdminPassword();
    const res = await fetch(`/api/etapas/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': password },
    });
    if (res.ok) router.push('/etapas');
    else alert((await res.json()).error || 'Erro ao excluir etapa');
  }

  async function handleShowToken() {
    setLoadingToken(true);
    const password = getAdminPassword();
    const res = await fetch(`/api/etapas/${id}/token`, {
      headers: { 'x-admin-password': password },
    });
    setLoadingToken(false);
    if (res.ok) {
      const data = await res.json();
      setShareToken(data.token);
    } else {
      alert('Erro ao buscar o link.');
    }
  }

  async function handleRegenerateToken() {
    if (!confirm('Gerar um novo link? O link antigo de lançar resultado deixa de funcionar.')) return;
    setLoadingToken(true);
    const password = getAdminPassword();
    const res = await fetch(`/api/etapas/${id}/token`, {
      method: 'POST',
      headers: { 'x-admin-password': password },
    });
    setLoadingToken(false);
    if (res.ok) {
      const data = await res.json();
      setShareToken(data.token);
    } else {
      alert('Erro ao gerar novo link.');
    }
  }

  function copyLink(url) {
    navigator.clipboard.writeText(url);
    alert('Link copiado!');
  }

  function handleDraw() {
    if (etapa.formato === 'dupla_eliminatoria_ate_semi' && teams.length < 8) {
      alert('Esse formato exige pelo menos 8 duplas.');
      return;
    }
    if (!confirm('Confirmar sorteio? As duplas ficarão travadas para esta etapa.')) return;

    if (etapa.formato === 'dupla_eliminatoria_ate_semi') {
      const result = performDoubleElimDraw(teams);
      const adv = advanceDoubleElim(result, etapa.disputa_terceiro);
      const t = { doubleElim: { ...result, ...adv } };
      setTorneio(t);
      saveEstado(t, 'em_andamento');
      return;
    }

    const result = performDraw(etapa.formato, teams, numGroups);
    let t = { ...result, champion: null, qualifiersPerGroup };
    if (t.bracket) {
      const adv = advanceBracket(t.bracket, etapa.disputa_terceiro);
      t.bracket = adv.bracket;
      t.champion = adv.champion;
    }
    setTorneio(t);
    saveEstado(t, 'em_andamento');
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

      if (next.doubleElim) {
        const de = { ...next.doubleElim };
        const applyResult = (m) => {
          const winner = r.setsA > r.setsB ? m.teamA : r.setsB > r.setsA ? m.teamB : null;
          return { ...m, sets, winner };
        };
        if (de.finalMatch && de.finalMatch.id === matchId) {
          de.finalMatch = applyResult(de.finalMatch);
        } else if (de.thirdPlaceMatch && de.thirdPlaceMatch.id === matchId) {
          de.thirdPlaceMatch = applyResult(de.thirdPlaceMatch);
        } else if (de.semifinals && de.semifinals.some((m) => m.id === matchId)) {
          de.semifinals = de.semifinals.map((m) => (m.id === matchId ? applyResult(m) : m));
        } else {
          de.winners = { rounds: de.winners.rounds.map((round) => round.map((m) => (m.id === matchId ? applyResult(m) : m))) };
          de.losers = { ...de.losers, rounds: de.losers.rounds.map((round) => round.map((m) => (m.id === matchId ? applyResult(m) : m))) };
        }
        const adv = advanceDoubleElim(de, etapa.disputa_terceiro);
        next.doubleElim = { ...de, ...adv };
        saveEstado(next, 'em_andamento');
        return next;
      }

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
    const qtd = torneio.qualifiersPerGroup || qualifiersPerGroup;
    let bracket = generateKnockoutFromGroups(torneio.groups, torneio.groupMatches, TIEBREAK, qtd, teams);
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
    if (torneio.doubleElim) {
      if (thirdPlacePendingDoubleElim(torneio.doubleElim)) {
        alert('A disputa de 3º lugar está habilitada e ainda não tem resultado. Lance o resultado dela antes de finalizar.');
        return;
      }
      const colocacoes = placementsFromDoubleElim(torneio.doubleElim);
      if (Object.keys(colocacoes).length === 0) {
        alert('Nenhum resultado disponível ainda.');
        return;
      }
      const { data: pontosTabela } = await supabase.from('pontos_colocacao').select('*');
      const resultados = Object.entries(colocacoes)
        .filter(([participante_id]) => !isByeId(participante_id))
        .map(([participante_id, colocacao]) => ({
          participante_id,
          colocacao,
          pontos: pontosPorColocacao(colocacao, pontosTabela || []),
        }));
      setBusy(true);
      const password = getAdminPassword();
      const res = await fetch(`/api/etapas/${id}/resultados`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ resultados }),
      });
      setBusy(false);
      if (res.ok) load();
      else alert('Erro ao salvar resultados finais.');
      return;
    }
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
    const resultados = Object.entries(colocacoes)
      .filter(([participante_id]) => !isByeId(participante_id))
      .map(([participante_id, colocacao]) => ({
        participante_id,
        colocacao,
        pontos: pontosPorColocacao(colocacao, pontosTabela || []),
      }));
    setBusy(true);
    const password = getAdminPassword();
    const res = await fetch(`/api/etapas/${id}/resultados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ resultados }),
    });
    setBusy(false);
    if (res.ok) load();
    else alert('Erro ao salvar resultados finais.');
  }

  async function handleReabrir() {
    if (!confirm('Reabrir esta etapa? O resultado final salvo será apagado.')) return;
    const password = getAdminPassword();
    const res = await fetch(`/api/etapas/${id}/resultados`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
    });
    if (res.ok) load();
  }

  if (loading) return <div className="page"><div className="empty-hint">Carregando...</div></div>;
  if (!etapa) return <div className="page"><div className="empty-hint">Etapa não encontrada.</div></div>;

  const locked = etapa.status !== 'planejada';

  return (
    <div className="page">
      <PageHeader title={etapa.nome} icon="🏐" />

      <div className="card">
        {!editingEtapa ? (
          <>
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
            <div className="grid2" style={{ marginTop: 10 }}>
              <div>
                <span className="field-label">Data</span>
                <div>{etapa.data_evento || '—'}</div>
              </div>
              <div>
                <span className="field-label">Disputa de 3º/4º lugar</span>
                <div>{etapa.disputa_terceiro ? 'Habilitada (jogo real)' : 'Desabilitada (empatados em 3º)'}</div>
              </div>
            </div>
            <div className="footer-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setEtapaForm(etapa); setEditingEtapa(true); }}>
                ✏️ Editar etapa
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteEtapa}>
                🗑️ Excluir etapa
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSaveEtapa}>
            <div className="grid2">
              <div className="field">
                <label className="field-label">Nome da etapa</label>
                <input type="text" value={etapaForm.nome} onChange={(e) => setEtapaForm({ ...etapaForm, nome: e.target.value })} required />
              </div>
              <div className="field">
                <label className="field-label">Data</label>
                <input type="date" value={etapaForm.data_evento || ''} onChange={(e) => setEtapaForm({ ...etapaForm, data_evento: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label">Modalidade{locked ? ' (travado após sorteio)' : ''}</label>
                <select value={etapaForm.modalidade} onChange={(e) => setEtapaForm({ ...etapaForm, modalidade: e.target.value })} disabled={locked}>
                  {Object.entries(MODALIDADES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Formato{locked ? ' (travado após sorteio)' : ''}</label>
                <select value={etapaForm.formato} onChange={(e) => setEtapaForm({ ...etapaForm, formato: e.target.value })} disabled={locked}>
                  {Object.entries(FORMATOS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            {etapa.formato !== 'grupos_apenas' && (
              <label className="chk-wrap" style={{ marginTop: 6, marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={!!etapaForm.disputa_terceiro}
                  disabled={locked}
                  onChange={(e) => setEtapaForm({ ...etapaForm, disputa_terceiro: e.target.checked })}
                />{' '}
                Disputar 3º/4º lugar em jogo real{locked ? ' (travado após sorteio)' : ' (senão, os dois semifinalistas ficam empatados em 3º)'}
              </label>
            )}
            <div className="footer-actions">
              <button className="btn btn-primary" type="submit">Salvar</button>
              <button className="btn btn-ghost" type="button" onClick={() => setEditingEtapa(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">🔗 Compartilhar</h2>
        <div className="grid2">
          <div>
            <label className="field-label">Link de visualização (tabela e próximos jogos, sem senha)</label>
            <div className="footer-actions" style={{ marginTop: 6 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => copyLink(`${window.location.origin}/etapas/${id}/ver`)}
              >
                📋 Copiar link de visualização
              </button>
            </div>
          </div>
          <div>
            <label className="field-label">Link para lançar resultado (sem senha de admin)</label>
            <div className="footer-actions" style={{ marginTop: 6 }}>
              {!shareToken ? (
                <button className="btn btn-ghost btn-sm" onClick={handleShowToken} disabled={loadingToken}>
                  🔒 Ver link de lançamento
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-ocean btn-sm"
                    onClick={() => copyLink(`${window.location.origin}/etapas/${id}/lancar?t=${shareToken}`)}
                  >
                    📋 Copiar link de lançamento
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={handleRegenerateToken} disabled={loadingToken}>
                    🔄 Gerar novo link
                  </button>
                </>
              )}
            </div>
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
          <div className="footer-actions">
            <button className="btn btn-ghost btn-sm" onClick={handleReabrir}>
              🔄 Reabrir etapa
            </button>
          </div>
        </div>
      )}

      {!locked && (
        <div className="card">
          <h2 className="section-title">Duplas / participantes ({participantes.length})</h2>
          <div className="teams-list">
            {participantes.map((p) => (
              <div key={p.id} className="team-row">
                {p.cabeca_de_chave && <span className="seed-tag">Cabeça de chave</span>}
                <span className="tname">{participanteNome(p.id)}</span>
                <button className="icon-btn" onClick={() => handleRemoveParticipante(p.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddParticipante} className="add-team-form">
            <select value={pForm.atleta1_id} onChange={(e) => setPForm({ ...pForm, atleta1_id: e.target.value })} required>
              <option value="">Atleta 1</option>
              {atletas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
            <select value={pForm.atleta2_id} onChange={(e) => setPForm({ ...pForm, atleta2_id: e.target.value })}>
              <option value="">Atleta 2 (opcional)</option>
              {atletas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
            <label className="chk-wrap">
              <input
                type="checkbox"
                checked={pForm.cabeca_de_chave}
                onChange={(e) => setPForm({ ...pForm, cabeca_de_chave: e.target.checked })}
              />{' '}
              Cabeça de chave
            </label>
            <button className="btn btn-ocean btn-sm" type="submit" disabled={busy}>
              + Adicionar dupla
            </button>
          </form>
        </div>
      )}

      {!locked && etapa.formato !== 'eliminatoria_simples' && etapa.formato !== 'dupla_eliminatoria_ate_semi' && (
        <div className="card">
          <h2 className="section-title">Configuração do sorteio</h2>
          <div className="grid2">
            <div className="field">
              <label className="field-label">Número de grupos</label>
              <input
                type="number"
                min="1"
                value={numGroups}
                onChange={(e) => setNumGroups(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div className="field">
              <label className="field-label">Classificados por grupo</label>
              <input
                type="number"
                min="1"
                value={qualifiersPerGroup}
                onChange={(e) => setQualifiersPerGroup(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>
        </div>
      )}

      {!locked && (
        <div className="footer-actions">
          <button
            className="btn btn-primary"
            onClick={handleDraw}
            disabled={participantes.length < 2 || (etapa.formato === 'dupla_eliminatoria_ate_semi' && participantes.length < 8)}
          >
            🎲 Realizar sorteio
          </button>
        </div>
      )}
      {!locked && etapa.formato === 'dupla_eliminatoria_ate_semi' && participantes.length > 0 && participantes.length < 8 && (
        <div className="warning-box">Esse formato exige pelo menos 8 duplas (hoje tem {participantes.length}). Cadastre mais duplas ou troque o formato da etapa.</div>
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
                        <th>Pontos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((t, i) => (
                        <tr key={t.id} className={i < (torneio.qualifiersPerGroup || qualifiersPerGroup) ? 'qualified' : ''}>
                          <td>{participanteNome(t.id)}</td>
                          <td>{t.jogos}</td>
                          <td>{t.vitorias}</td>
                          <td>
                            {t.setsPro}-{t.setsContra}
                          </td>
                          <td>
                            {t.saldoSets > 0 ? '+' : ''}
                            {t.saldoSets}
                          </td>
                          <td>
                            {t.saldoPontos > 0 ? '+' : ''}
                            {t.saldoPontos}
                          </td>
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

      {torneio && torneio.doubleElim && (
        <>
          <h2 className="section-title">Chave principal (invictas)</h2>
          <div className="bracket-scroll">
            <div className="bracket">
              {torneio.doubleElim.winners.rounds.map((round, idx) => (
                <div className="round-col" key={'w' + idx}>
                  <div className="round-label">Rodada {idx + 1}</div>
                  {round.map((m) => (
                    <BracketMatchBox
                      key={m.id}
                      m={m}
                      participanteNome={participanteNome}
                      editingMatchId={editingMatchId}
                      editingSets={editingSets}
                      setEditingSets={setEditingSets}
                      openEdit={openEdit}
                      setEditingMatchId={setEditingMatchId}
                      onSave={() => saveMatch(m.id, true)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <h2 className="section-title">Repescagem</h2>
          <div className="bracket-scroll">
            <div className="bracket">
              {torneio.doubleElim.losers.rounds.map((round, idx) => (
                <div className="round-col" key={'l' + idx}>
                  <div className="round-label">Rodada {idx + 1}</div>
                  {round.map((m) => (
                    <BracketMatchBox
                      key={m.id}
                      m={m}
                      participanteNome={participanteNome}
                      editingMatchId={editingMatchId}
                      editingSets={editingSets}
                      setEditingSets={setEditingSets}
                      openEdit={openEdit}
                      setEditingMatchId={setEditingMatchId}
                      onSave={() => saveMatch(m.id, true)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {torneio.doubleElim.semifinals && (
            <>
              <h2 className="section-title">Semifinais</h2>
              <div className="groups-grid">
                {torneio.doubleElim.semifinals.map((m, i) => (
                  <div className="card" key={m.id} style={{ maxWidth: 320 }}>
                    <h3 style={{ fontFamily: 'Oswald', fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 16, margin: '0 0 10px', color: 'var(--accent)' }}>
                      Semifinal {i + 1}
                    </h3>
                    <BracketMatchBox
                      m={m}
                      participanteNome={participanteNome}
                      editingMatchId={editingMatchId}
                      editingSets={editingSets}
                      setEditingSets={setEditingSets}
                      openEdit={openEdit}
                      setEditingMatchId={setEditingMatchId}
                      onSave={() => saveMatch(m.id, true)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {torneio.doubleElim.finalMatch && (
            <div className="card" style={{ maxWidth: 320 }}>
              <h3 style={{ fontFamily: 'Oswald', fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 16, margin: '0 0 10px', color: 'var(--accent)' }}>
                🏁 Final
              </h3>
              <BracketMatchBox
                m={torneio.doubleElim.finalMatch}
                participanteNome={participanteNome}
                editingMatchId={editingMatchId}
                editingSets={editingSets}
                setEditingSets={setEditingSets}
                openEdit={openEdit}
                setEditingMatchId={setEditingMatchId}
                onSave={() => saveMatch(torneio.doubleElim.finalMatch.id, true)}
              />
            </div>
          )}

          {torneio.doubleElim.thirdPlaceMatch && (
            <div className="card" style={{ maxWidth: 320 }}>
              <h3 style={{ fontFamily: 'Oswald', fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 16, margin: '0 0 10px', color: 'var(--accent)' }}>
                🥉 Disputa de 3º lugar
              </h3>
              <BracketMatchBox
                m={torneio.doubleElim.thirdPlaceMatch}
                participanteNome={participanteNome}
                editingMatchId={editingMatchId}
                editingSets={editingSets}
                setEditingSets={setEditingSets}
                openEdit={openEdit}
                setEditingMatchId={setEditingMatchId}
                onSave={() => saveMatch(torneio.doubleElim.thirdPlaceMatch.id, true)}
              />
            </div>
          )}

          {torneio.doubleElim.champion && etapa.status !== 'finalizada' && (
            <div className="champion-box">
              <div className="trophy">🏆</div>
              <div className="clabel">Campeão da etapa</div>
              <div className="cname">{participanteNome(torneio.doubleElim.champion)}</div>
              <div className="footer-actions" style={{ justifyContent: 'center', marginTop: 14 }}>
                <button className="btn btn-primary" onClick={handleFinalizar} disabled={busy}>
                  ✅ Salvar resultado final no ranking
                </button>
              </div>
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
                      <div className={`side ${m.winner && m.winner === m.teamA ? 'winner' : ''} ${isByeId(m.teamA) ? 'bye' : ''}`}>
                        {m.teamA ? participanteNome(m.teamA) : '—'}
                      </div>
                      <div className="vs-div"></div>
                      <div className={`side ${m.winner && m.winner === m.teamB ? 'winner' : ''} ${isByeId(m.teamB) ? 'bye' : ''}`}>
                        {m.teamB ? participanteNome(m.teamB) : '—'}
                      </div>
                      {m.teamA && m.teamB && !m.winner && editingMatchId !== m.id && (
                        <span className="edit-link" onClick={() => openEdit(m.id)}>
                          ✏️ Resultado
                        </span>
                      )}
                      {m.teamA && m.teamB && m.winner && editingMatchId !== m.id && (
                        <span className="edit-link" onClick={() => openEdit(m.id)}>
                          ✏️ Editar
                        </span>
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
              <h3 style={{ fontFamily: 'Oswald', fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase', fontSize: 16, margin: '0 0 10px', color: 'var(--accent)' }}>
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

function BracketMatchBox({ m, participanteNome, editingMatchId, editingSets, setEditingSets, openEdit, setEditingMatchId, onSave }) {
  const editing = editingMatchId === m.id;
  return (
    <div className="match-box">
      <div className={`side ${m.winner && m.winner === m.teamA ? 'winner' : ''} ${isByeId(m.teamA) ? 'bye' : ''}`}>
        {m.teamA ? participanteNome(m.teamA) : '—'}
      </div>
      <div className="vs-div"></div>
      <div className={`side ${m.winner && m.winner === m.teamB ? 'winner' : ''} ${isByeId(m.teamB) ? 'bye' : ''}`}>
        {m.teamB ? participanteNome(m.teamB) : '—'}
      </div>
      {m.teamA && m.teamB && !m.winner && !editing && (
        <span className="edit-link" onClick={() => openEdit(m.id)}>✏️ Resultado</span>
      )}
      {m.teamA && m.teamB && m.winner && !editing && (
        <span className="edit-link" onClick={() => openEdit(m.id)}>✏️ Editar</span>
      )}
      {editing && (
        <SetsForm
          editingSets={editingSets}
          setEditingSets={setEditingSets}
          onSave={onSave}
          onCancel={() => setEditingMatchId(null)}
        />
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
        {r && (
          <div className="match-score">
            {r.setsA} x {r.setsB}
          </div>
        )}
        <div className={`match-status ${m.winner ? 'status-done' : 'status-pending'}`}>
          {m.winner ? 'Concluída' : isBye ? 'BYE' : 'Pendente'}
        </div>
      </div>
      {!isBye && !m.winner && !editing && (
        <button className="btn btn-sm btn-ghost" onClick={onEdit} style={{ marginTop: 6 }}>
          ✏️ Registrar resultado
        </button>
      )}
      {!isBye && m.winner && !editing && (
        <button className="btn btn-sm btn-ghost" onClick={onEdit} style={{ marginTop: 6 }}>
          ✏️ Editar resultado
        </button>
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
        <button className="btn btn-sm btn-ghost" onClick={() => setEditingSets([...editingSets, [0, 0]])}>
          + Set
        </button>
        <button className="btn btn-sm btn-ocean" onClick={onSave}>
          Salvar resultado
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

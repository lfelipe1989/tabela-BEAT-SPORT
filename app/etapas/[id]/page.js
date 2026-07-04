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
} from '../../../lib/bracketEngine';
import { pontosPorColocacao } from '../../../lib/ranking';

const TIEBREAK = ['confronto_direto', 'vitorias', 'saldo_sets', 'saldo_pontos', 'sets_pro', 'pontos_pro'];
const FORMATOS = {
  grupos_eliminatoria: 'Grupos + eliminatórias',
  eliminatoria_simples: 'Eliminatória simples',
  grupos_apenas: 'Somente grupos',
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

  function handleDraw() {
    if (!confirm('Confirmar sorteio? As duplas ficarão travadas para esta etapa.')) return;
    const result = performDraw(etapa.formato, teams, numGroups);
    let t = { ...result, champion: null };
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
    let bracket = generateKnockoutFromGroups(torneio.groups, torneio.groupMatches, TIEBREAK, qualifiersPerGroup, teams);
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

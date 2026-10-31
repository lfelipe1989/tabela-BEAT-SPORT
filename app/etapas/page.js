'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { getAdminPassword } from '../../lib/adminClient';
import PageHeader from '../../components/PageHeader';

const FORMATOS = {
  grupos_eliminatoria: 'Grupos + eliminatórias',
  eliminatoria_simples: 'Eliminatória simples',
  grupos_apenas: 'Somente grupos',
  dupla_eliminatoria_ate_semi: 'Dupla eliminação até a semifinal',
};
const MODALIDADES = { volei: '🏐 Vôlei de praia', futevolei: '⚽ Futevôlei', beach_tenis: '🎾 Beach tênis' };
const STATUS_LABEL = { planejada: 'Planejada', em_andamento: 'Em andamento', finalizada: 'Finalizada' };

export default function EtapasPage() {
  const [etapas, setEtapas] = useState([]);
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nome: '',
    modalidade: 'volei',
    formato: 'grupos_eliminatoria',
    data_evento: '',
    disputa_terceiro: false,
    modo_ranking: 'geral',
    liga_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load(silent) {
    if (!silent) setLoading(true);
    const { data } = await supabase.from('etapas').select('*').order('data_evento', { ascending: false });
    setEtapas(data || []);
    const { data: lg } = await supabase.from('ligas').select('*').order('nome');
    setLigas(lg || []);
    setLoading(false);
  }

  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    load();
    // atualiza a lista e as cores a cada 30s, sem piscar a tela
    const t = setInterval(() => {
      load(true);
      setAgora(Date.now());
    }, 30000);
    return () => clearInterval(t);
  }, []);

  // verde: atividade nos últimos 10 min; amarelo: até 30 min; vermelho: parada há mais de 30 min
  function atividade(e) {
    if (!e.atualizado_em) return { cor: 'vermelho', texto: 'sem movimentação registrada' };
    const min = Math.max(0, Math.floor((agora - new Date(e.atualizado_em).getTime()) / 60000));
    const cor = min <= 10 ? 'verde' : min <= 30 ? 'amarelo' : 'vermelho';
    const texto = min < 1 ? 'agora' : min < 60 ? `há ${min} min` : `há ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
    return { cor, texto: `última movimentação ${texto}` };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    setError('');
    try {
      const password = getAdminPassword();
      const res = await fetch('/api/etapas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar');
      setForm({
        nome: '',
        modalidade: 'volei',
        formato: 'grupos_eliminatoria',
        data_evento: '',
        disputa_terceiro: false,
        modo_ranking: 'geral',
        liga_id: '',
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e, id, nome) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Excluir a etapa "${nome}"? Isso apaga também as duplas e resultados dela. Essa ação não pode ser desfeita.`)) return;
    const password = getAdminPassword();
    const res = await fetch(`/api/etapas/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': password },
    });
    if (res.ok) load();
    else alert((await res.json()).error || 'Erro ao excluir etapa');
  }

  return (
    <div className="page">
      <PageHeader title="Etapas" icon="🏐" />

      <div className="card">
        <h2 className="section-title">Nova etapa</h2>
        <form onSubmit={handleSubmit} className="grid2">
          <div className="field">
            <label className="field-label">Nome da etapa</label>
            <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="field">
            <label className="field-label">Data</label>
            <input type="date" value={form.data_evento} onChange={(e) => setForm({ ...form, data_evento: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">Modalidade</label>
            <select value={form.modalidade} onChange={(e) => setForm({ ...form, modalidade: e.target.value })}>
              {Object.entries(MODALIDADES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Formato</label>
            <select value={form.formato} onChange={(e) => setForm({ ...form, formato: e.target.value })}>
              {Object.entries(FORMATOS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : '+ Criar etapa'}
            </button>
          </div>
        </form>
        {form.formato === 'dupla_eliminatoria_ate_semi' && (
          <div className="warning-box">Esse formato exige no mínimo 8 duplas, e funciona de forma mais previsível com número de duplas em potência de 2 (8, 16 ou 32). Com outros números fora disso, o chaveamento entra com BYE pra completar, o que ocasionalmente pode gerar um reencontro entre as mesmas duplas antes da final.</div>
        )}
        {form.formato !== 'grupos_apenas' && (
          <label className="chk-wrap" style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={form.disputa_terceiro}
              onChange={(e) => setForm({ ...form, disputa_terceiro: e.target.checked })}
            />{' '}
            Disputar 3º/4º lugar em jogo real (senão, os dois semifinalistas ficam empatados em 3º)
          </label>
        )}

        <div className="field" style={{ marginTop: 14 }}>
          <label className="field-label">Contabilização no ranking</label>
          <select value={form.modo_ranking} onChange={(e) => setForm({ ...form, modo_ranking: e.target.value })}>
            <option value="geral">Contar pro ranking geral</option>
            <option value="liga">Contar só pra uma liga específica</option>
            <option value="nenhum">Não contar pra nenhum ranking</option>
          </select>
        </div>
        {form.modo_ranking === 'liga' && (
          <div className="field">
            <label className="field-label">Qual liga?</label>
            <select value={form.liga_id} onChange={(e) => setForm({ ...form, liga_id: e.target.value })} required>
              <option value="">Selecione...</option>
              {ligas.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
            {ligas.length === 0 && <div className="warning-box" style={{ marginTop: 8 }}>Nenhuma liga criada ainda. Crie uma em "Ligas" primeiro.</div>}
          </div>
        )}

        {error && <div className="warning-box">{error}</div>}
      </div>

      <h2 className="section-title">Etapas cadastradas</h2>
      {loading ? (
        <div className="empty-hint">Carregando...</div>
      ) : etapas.length === 0 ? (
        <div className="empty-hint">Nenhuma etapa criada ainda.</div>
      ) : (
        <div className="teams-list">
          {etapas.map((e) => (
            <Link key={e.id} href={`/etapas/${e.id}`} className="team-row team-row-link">
              <span className="tname">{e.nome}</span>
              <span className="tmeta">
                {MODALIDADES[e.modalidade]} · {FORMATOS[e.formato]} ·{' '}
                {e.status === 'em_andamento' ? (
                  <span className={`etapa-pulse etapa-pulse-${atividade(e).cor}`} title={atividade(e).texto}>
                    {STATUS_LABEL[e.status]} · {atividade(e).texto.replace('última movimentação ', '')}
                  </span>
                ) : (
                  STATUS_LABEL[e.status]
                )}
              </span>
              <button className="icon-btn" onClick={(ev) => handleDelete(ev, e.id, e.nome)} title="Excluir etapa">
                🗑️
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

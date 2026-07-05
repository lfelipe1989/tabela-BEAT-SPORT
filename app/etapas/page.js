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
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: '', modalidade: 'volei', formato: 'grupos_eliminatoria', data_evento: '', disputa_terceiro: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('etapas').select('*').order('data_evento', { ascending: false });
    setEtapas(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
      setForm({ nome: '', modalidade: 'volei', formato: 'grupos_eliminatoria', data_evento: '', disputa_terceiro: false });
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
          <div className="warning-box">Esse formato funciona de forma confiável com número de duplas em potência de 2 (4, 8, 16 ou 32). Com outros números, use "Eliminatória simples" ou "Grupos + eliminatórias" em vez desse.</div>
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
                {MODALIDADES[e.modalidade]} · {FORMATOS[e.formato]} · {STATUS_LABEL[e.status]}
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

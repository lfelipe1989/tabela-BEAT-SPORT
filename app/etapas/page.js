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
};
const MODALIDADES = { volei: '🏐 Vôlei de praia', futevolei: '⚽ Futevôlei', beach_tenis: '🎾 Beach tênis' };
const STATUS_LABEL = { planejada: 'Planejada', em_andamento: 'Em andamento', finalizada: 'Finalizada' };

export default function EtapasPage() {
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: '', modalidade: 'volei', formato: 'grupos_eliminatoria', data_evento: '' });
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
      setForm({ nome: '', modalidade: 'volei', formato: 'grupos_eliminatoria', data_evento: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

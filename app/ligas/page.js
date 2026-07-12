'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { getAdminPassword } from '../../lib/adminClient';
import PageHeader from '../../components/PageHeader';

export default function LigasPage() {
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: '', data_inicio: '', data_fim: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('ligas').select('*').order('data_inicio', { ascending: false });
    setLigas(data || []);
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
      const res = await fetch('/api/ligas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar');
      setForm({ nome: '', data_inicio: '', data_fim: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Ligas" icon="🏆" />

      <div className="card">
        <h2 className="section-title">Nova liga / circuito</h2>
        <form onSubmit={handleSubmit} className="grid2">
          <div className="field">
            <label className="field-label">Nome da liga</label>
            <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div />
          <div className="field">
            <label className="field-label">Início</label>
            <input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">Fim</label>
            <input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
          </div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : '+ Criar liga'}
            </button>
          </div>
        </form>
        {error && <div className="warning-box">{error}</div>}
      </div>

      <h2 className="section-title">Ligas cadastradas</h2>
      {loading ? (
        <div className="empty-hint">Carregando...</div>
      ) : ligas.length === 0 ? (
        <div className="empty-hint">Nenhuma liga criada ainda. Uma liga agrupa várias etapas num ranking próprio.</div>
      ) : (
        <div className="teams-list">
          {ligas.map((l) => (
            <Link key={l.id} href={`/ligas/${l.id}`} className="team-row team-row-link">
              <span className="tname">{l.nome}</span>
              <span className="tmeta">
                {l.data_inicio || '—'} até {l.data_fim || '—'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

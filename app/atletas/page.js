'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { getAdminPassword } from '../../lib/adminClient';
import PageHeader from '../../components/PageHeader';

export default function AtletasPage() {
  const [atletas, setAtletas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: '', apelido: '', genero: 'masculino', cidade: '', telefone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('atletas').select('*').order('nome');
    setAtletas(data || []);
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
      const res = await fetch('/api/atletas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar');
      setForm({ nome: '', apelido: '', genero: 'masculino', cidade: '', telefone: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Atletas" icon="🧑‍🤝‍🧑" />

      <div className="card">
        <h2 className="section-title">Cadastrar atleta</h2>
        <form onSubmit={handleSubmit} className="grid2">
          <div className="field">
            <label className="field-label">Nome completo</label>
            <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="field">
            <label className="field-label">Apelido</label>
            <input type="text" value={form.apelido} onChange={(e) => setForm({ ...form, apelido: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">Gênero</label>
            <select value={form.genero} onChange={(e) => setForm({ ...form, genero: e.target.value })}>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="misto">Misto</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Cidade</label>
            <input type="text" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">Telefone</label>
            <input type="text" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : '+ Adicionar atleta'}
            </button>
          </div>
        </form>
        {error && <div className="warning-box">{error}</div>}
      </div>

      <h2 className="section-title">Todos os atletas ({atletas.length})</h2>
      {loading ? (
        <div className="empty-hint">Carregando...</div>
      ) : atletas.length === 0 ? (
        <div className="empty-hint">Nenhum atleta cadastrado ainda.</div>
      ) : (
        <div className="teams-list">
          {atletas.map((a) => (
            <Link key={a.id} href={`/atletas/${a.id}`} className="team-row team-row-link">
              <span className="tname">
                {a.nome}
                {a.apelido ? ` (${a.apelido})` : ''}
              </span>
              <span className="tmeta">{a.cidade || '—'}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

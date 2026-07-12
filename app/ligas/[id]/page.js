'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { getAdminPassword } from '../../../lib/adminClient';
import PageHeader from '../../../components/PageHeader';
import { categoriaPorPontos } from '../../../lib/ranking';

const FORMATOS = {
  grupos_eliminatoria: 'Grupos + eliminatórias',
  eliminatoria_simples: 'Eliminatória simples',
  grupos_apenas: 'Somente grupos',
  dupla_eliminatoria_ate_semi: 'Dupla eliminação até a semifinal',
};

export default function LigaPage() {
  const { id } = useParams();
  const router = useRouter();
  const [liga, setLiga] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: l } = await supabase.from('ligas').select('*').eq('id', id).single();
    setLiga(l);
    setForm(l);
    const { data: et } = await supabase.from('etapas').select('*').eq('liga_id', id).order('data_evento');
    setEtapas(et || []);
    const { data: rk } = await supabase.from('ranking_por_liga').select('*').eq('liga_id', id).order('pontos_totais', { ascending: false });
    setRanking(rk || []);
    const { data: cats } = await supabase.from('categorias').select('*').order('ordem');
    setCategorias(cats || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  async function handleSave(e) {
    e.preventDefault();
    const password = getAdminPassword();
    const res = await fetch(`/api/ligas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ nome: form.nome, data_inicio: form.data_inicio, data_fim: form.data_fim }),
    });
    if (res.ok) {
      setEditing(false);
      load();
    } else {
      alert((await res.json()).error || 'Erro ao salvar');
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir a liga "${liga.nome}"? As etapas dela não são apagadas, só deixam de contar pra esse ranking.`)) return;
    const password = getAdminPassword();
    const res = await fetch(`/api/ligas/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': password },
    });
    if (res.ok) router.push('/ligas');
    else alert((await res.json()).error || 'Erro ao excluir liga');
  }

  if (loading) return <div className="page"><div className="empty-hint">Carregando...</div></div>;
  if (!liga) return <div className="page"><div className="empty-hint">Liga não encontrada.</div></div>;

  return (
    <div className="page">
      <PageHeader title={liga.nome} icon="🏆" />

      <div className="card">
        {!editing ? (
          <>
            <div className="grid2">
              <div>
                <span className="field-label">Início</span>
                <div>{liga.data_inicio || '—'}</div>
              </div>
              <div>
                <span className="field-label">Fim</span>
                <div>{liga.data_fim || '—'}</div>
              </div>
            </div>
            <div className="footer-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm(liga); setEditing(true); }}>
                ✏️ Editar liga
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                🗑️ Excluir liga
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSave} className="grid2">
            <div className="field">
              <label className="field-label">Nome</label>
              <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div />
            <div className="field">
              <label className="field-label">Início</label>
              <input type="date" value={form.data_inicio || ''} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label">Fim</label>
              <input type="date" value={form.data_fim || ''} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
            </div>
            <div className="field footer-actions">
              <button className="btn btn-primary" type="submit">Salvar</button>
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </div>

      <h2 className="section-title">🏅 Ranking da liga</h2>
      {ranking.length === 0 ? (
        <div className="empty-hint">Ainda não há resultados de etapas desta liga.</div>
      ) : (
        <table className="standings">
          <thead>
            <tr>
              <th>#</th>
              <th>Atleta</th>
              <th>Etapas</th>
              <th>Melhor colocação</th>
              <th>Pontos</th>
              <th>Categoria</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={r.atleta_id}>
                <td>{i + 1}</td>
                <td>
                  <Link href={`/atletas/${r.atleta_id}`}>
                    {r.nome}
                    {r.apelido ? ` (${r.apelido})` : ''}
                  </Link>
                </td>
                <td>{r.etapas_disputadas}</td>
                <td>{r.melhor_colocacao ? `${r.melhor_colocacao}º` : '—'}</td>
                <td>{r.pontos_totais}</td>
                <td>
                  <span className="badge-categoria">{categorias.length ? categoriaPorPontos(r.pontos_totais, categorias) : '—'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="section-title">Etapas desta liga ({etapas.length})</h2>
      {etapas.length === 0 ? (
        <div className="empty-hint">
          Nenhuma etapa vinculada ainda. Ao criar ou editar uma etapa, escolha "Contabilizar pra uma liga específica" e selecione esta liga.
        </div>
      ) : (
        <div className="teams-list">
          {etapas.map((e) => (
            <Link key={e.id} href={`/etapas/${e.id}`} className="team-row team-row-link">
              <span className="tname">{e.nome}</span>
              <span className="tmeta">
                {FORMATOS[e.formato]} · {e.data_evento || 'sem data'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

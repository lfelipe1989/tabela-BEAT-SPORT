'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { getAdminPassword } from '../../lib/adminClient';
import { categoriaPorPontos } from '../../lib/ranking';
import PageHeader from '../../components/PageHeader';

export default function RankingPage() {
  const [ranking, setRanking] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: r } = await supabase.from('ranking_geral').select('*').order('pontos_totais', { ascending: false });
    const { data: cats } = await supabase.from('categorias').select('*').order('ordem');
    setRanking(r || []);
    setCategorias(cats || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleReset() {
    if (!confirm('Zerar o ranking geral? Isso não apaga o histórico de nenhuma etapa — só faz as etapas que hoje contam pro geral pararem de contar. Continuar?')) return;
    setBusy(true);
    const password = getAdminPassword();
    const res = await fetch('/api/ranking/reset', {
      method: 'POST',
      headers: { 'x-admin-password': password },
    });
    setBusy(false);
    if (res.ok) {
      alert('Ranking geral zerado. As etapas antigas continuam salvas, só não contam mais pro geral (você pode reativar cada uma individualmente na própria etapa, se quiser).');
      load();
    } else {
      alert((await res.json()).error || 'Erro ao zerar ranking');
    }
  }

  return (
    <div className="page">
      <PageHeader title="Ranking geral" icon="🏆" />

      <div className="footer-actions" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={handleReset} disabled={busy}>
          🔄 Zerar ranking geral
        </button>
      </div>

      {loading ? (
        <div className="empty-hint">Carregando...</div>
      ) : ranking.length === 0 ? (
        <div className="empty-hint">Ainda não há resultados de etapas finalizadas.</div>
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
    </div>
  );
}

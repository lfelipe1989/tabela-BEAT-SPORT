'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { categoriaPorPontos } from '../../../lib/ranking';
import PageHeader from '../../../components/PageHeader';

export default function AtletaPage() {
  const { id } = useParams();
  const [atleta, setAtleta] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const { data: a } = await supabase.from('atletas').select('*').eq('id', id).single();
      setAtleta(a);

      const { data: cats } = await supabase.from('categorias').select('*').order('ordem');
      setCategorias(cats || []);

      const { data: participacoes } = await supabase
        .from('etapa_participantes')
        .select('id, etapa_id, atleta1_id, atleta2_id')
        .or(`atleta1_id.eq.${id},atleta2_id.eq.${id}`);

      const partIds = (participacoes || []).map((p) => p.id);
      let resultados = [];
      if (partIds.length) {
        const { data: res } = await supabase.from('etapa_resultados').select('*').in('participante_id', partIds);
        resultados = res || [];
      }

      const etapaIds = [...new Set((participacoes || []).map((p) => p.etapa_id))];
      let etapas = [];
      if (etapaIds.length) {
        const { data: et } = await supabase.from('etapas').select('*').in('id', etapaIds);
        etapas = et || [];
      }

      const hist = (participacoes || [])
        .map((p) => {
          const etapa = etapas.find((e) => e.id === p.etapa_id);
          const resultado = resultados.find((r) => r.participante_id === p.id);
          return {
            etapaNome: etapa ? etapa.nome : '—',
            data: etapa ? etapa.data_evento : null,
            colocacao: resultado ? resultado.colocacao : null,
            pontos: resultado ? resultado.pontos : 0,
          };
        })
        .sort((x, y) => (y.data || '').localeCompare(x.data || ''));

      setHistorico(hist);
      setLoading(false);
    }
    load();
  }, [id]);

  const pontosTotais = historico.reduce((s, h) => s + (h.pontos || 0), 0);
  const categoria = categorias.length ? categoriaPorPontos(pontosTotais, categorias) : '—';

  if (loading) return <div className="page"><div className="empty-hint">Carregando...</div></div>;
  if (!atleta) return <div className="page"><div className="empty-hint">Atleta não encontrado.</div></div>;

  return (
    <div className="page">
      <PageHeader title={atleta.nome} icon="🧑" />

      <div className="card">
        <div className="grid2">
          <div>
            <span className="field-label">Apelido</span>
            <div>{atleta.apelido || '—'}</div>
          </div>
          <div>
            <span className="field-label">Cidade</span>
            <div>{atleta.cidade || '—'}</div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="stat-box">
            <div className="stat-num">{pontosTotais}</div>
            <div className="stat-label">Pontos totais</div>
          </div>
          <div className="stat-box">
            <div className="stat-num">{historico.length}</div>
            <div className="stat-label">Etapas disputadas</div>
          </div>
          <span className="badge-categoria">{categoria}</span>
        </div>
      </div>

      <h2 className="section-title">Histórico de etapas</h2>
      {historico.length === 0 ? (
        <div className="empty-hint">Nenhuma etapa registrada ainda.</div>
      ) : (
        <table className="standings">
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Data</th>
              <th>Colocação</th>
              <th>Pontos</th>
            </tr>
          </thead>
          <tbody>
            {historico.map((h, i) => (
              <tr key={i}>
                <td>{h.etapaNome}</td>
                <td>{h.data || '—'}</td>
                <td>{h.colocacao ? `${h.colocacao}º` : 'Em andamento'}</td>
                <td>{h.pontos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

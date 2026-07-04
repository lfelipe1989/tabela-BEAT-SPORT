import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidAdminPassword } from '../../../../../lib/supabaseAdmin';

export async function POST(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const body = await req.json();
  const resultados = body.resultados || [];
  const supabaseAdmin = getSupabaseAdmin();

  const { error: delError } = await supabaseAdmin.from('etapa_resultados').delete().eq('etapa_id', params.id);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  if (resultados.length) {
    const rows = resultados.map((r) => ({
      etapa_id: params.id,
      participante_id: r.participante_id,
      colocacao: r.colocacao,
      pontos: r.pontos,
    }));
    const { error } = await supabaseAdmin.from('etapa_resultados').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: statusError } = await supabaseAdmin.from('etapas').update({ status: 'finalizada' }).eq('id', params.id);
  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin.from('etapa_resultados').delete().eq('etapa_id', params.id);
  const { error } = await supabaseAdmin.from('etapas').update({ status: 'planejada', estado_chaveamento: null }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

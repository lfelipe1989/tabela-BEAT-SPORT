import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidAdminPassword } from '../../../../lib/supabaseAdmin';

export async function PATCH(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const body = await req.json();
  const supabaseAdmin = getSupabaseAdmin();
  const update = {};
  if (body.nome !== undefined) update.nome = body.nome;
  if (body.data_inicio !== undefined) update.data_inicio = body.data_inicio || null;
  if (body.data_fim !== undefined) update.data_fim = body.data_fim || null;
  const { error } = await supabaseAdmin.from('ligas').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  // Etapas que apontavam pra essa liga ficam sem liga (liga_id vira null)
  // automaticamente por causa da FK, mas fazemos explícito aqui também
  // por clareza e pra não travar em bancos mais antigos.
  await supabaseAdmin.from('etapas').update({ liga_id: null, modo_ranking: 'geral' }).eq('liga_id', params.id);
  const { error } = await supabaseAdmin.from('ligas').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

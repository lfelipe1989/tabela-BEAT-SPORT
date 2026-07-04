import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidAdminPassword } from '../../../../lib/supabaseAdmin';

export async function PATCH(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const body = await req.json();
  const supabaseAdmin = getSupabaseAdmin();
  const update = {};
  if (body.status) update.status = body.status;
  if (body.estado_chaveamento !== undefined) update.estado_chaveamento = body.estado_chaveamento;
  if (body.nome !== undefined) update.nome = body.nome;
  if (body.modalidade !== undefined) update.modalidade = body.modalidade;
  if (body.formato !== undefined) update.formato = body.formato;
  if (body.data_evento !== undefined) update.data_evento = body.data_evento;
  if (body.disputa_terceiro !== undefined) update.disputa_terceiro = body.disputa_terceiro;
  const { error } = await supabaseAdmin.from('etapas').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from('etapas').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

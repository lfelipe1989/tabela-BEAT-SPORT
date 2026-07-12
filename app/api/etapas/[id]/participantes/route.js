import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidAdminPassword } from '../../../../../lib/supabaseAdmin';

export async function POST(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const body = await req.json();
  if (!body.atleta1_id) {
    return NextResponse.json({ error: 'Selecione ao menos o atleta 1' }, { status: 400 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('etapa_participantes')
    .insert({
      etapa_id: params.id,
      atleta1_id: body.atleta1_id,
      atleta2_id: body.atleta2_id || null,
      cabeca_de_chave: !!body.cabeca_de_chave,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ participante: data });
}

export async function PATCH(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const body = await req.json();
  if (!body.participante_id) {
    return NextResponse.json({ error: 'participante_id é obrigatório' }, { status: 400 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  const update = {};
  if (body.atleta1_id !== undefined) update.atleta1_id = body.atleta1_id;
  if (body.atleta2_id !== undefined) update.atleta2_id = body.atleta2_id || null;
  if (body.cabeca_de_chave !== undefined) update.cabeca_de_chave = !!body.cabeca_de_chave;
  const { error } = await supabaseAdmin
    .from('etapa_participantes')
    .update(update)
    .eq('id', body.participante_id)
    .eq('etapa_id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const body = await req.json();
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from('etapa_participantes')
    .delete()
    .eq('id', body.participante_id)
    .eq('etapa_id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

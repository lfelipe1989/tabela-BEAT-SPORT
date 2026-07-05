import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidAdminPassword } from '../../../../../lib/supabaseAdmin';

// GET: retorna o token atual (cria um se ainda não existir)
export async function GET(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  let { data } = await supabaseAdmin.from('etapa_tokens').select('token_resultado').eq('etapa_id', params.id).single();
  if (!data) {
    const { data: created, error } = await supabaseAdmin
      .from('etapa_tokens')
      .insert({ etapa_id: params.id })
      .select('token_resultado')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    data = created;
  }
  return NextResponse.json({ token: data.token_resultado });
}

// POST: gera um token novo, invalidando o link antigo
export async function POST(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('etapa_tokens')
    .upsert({ etapa_id: params.id, token_resultado: crypto.randomUUID(), atualizado_em: new Date().toISOString() }, { onConflict: 'etapa_id' })
    .select('token_resultado')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token: data.token_resultado });
}

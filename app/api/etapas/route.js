import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidAdminPassword } from '../../../lib/supabaseAdmin';

export async function POST(req) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const body = await req.json();
  if (!body.nome || !body.nome.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('etapas')
    .insert({
      nome: body.nome.trim(),
      modalidade: body.modalidade || 'volei',
      formato: body.formato || 'grupos_eliminatoria',
      data_evento: body.data_evento || null,
      disputa_terceiro: !!body.disputa_terceiro,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from('etapa_tokens').insert({ etapa_id: data.id });
  return NextResponse.json({ etapa: data });
}

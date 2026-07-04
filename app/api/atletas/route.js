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
    .from('atletas')
    .insert({
      nome: body.nome.trim(),
      apelido: body.apelido || null,
      genero: body.genero || 'masculino',
      cidade: body.cidade || null,
      telefone: body.telefone || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ atleta: data });
}

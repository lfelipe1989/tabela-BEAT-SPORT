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
  if (body.apelido !== undefined) update.apelido = body.apelido || null;
  if (body.genero !== undefined) update.genero = body.genero;
  if (body.cidade !== undefined) update.cidade = body.cidade || null;
  if (body.telefone !== undefined) update.telefone = body.telefone || null;
  const { error } = await supabaseAdmin.from('atletas').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from('atletas').delete().eq('id', params.id);
  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Esse atleta já participou de alguma etapa e não pode ser excluído (isso apagaria histórico de ranking). Remova-o das duplas das etapas primeiro, se necessário.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

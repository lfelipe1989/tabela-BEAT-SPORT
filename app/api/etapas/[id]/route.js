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
  const { error } = await supabaseAdmin.from('etapas').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

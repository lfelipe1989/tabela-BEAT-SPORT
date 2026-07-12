import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isValidAdminPassword } from '../../../../lib/supabaseAdmin';

// Zera o ranking geral SEM apagar histórico: só muda o modo de
// contabilização das etapas que hoje contam pro geral, marcando-as
// como "não contabilizar". Os resultados de cada etapa continuam
// salvos e visíveis nela mesma e no histórico do atleta.
export async function POST(req) {
  if (!isValidAdminPassword(req)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from('etapas').update({ modo_ranking: 'nenhum' }).eq('modo_ranking', 'geral');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

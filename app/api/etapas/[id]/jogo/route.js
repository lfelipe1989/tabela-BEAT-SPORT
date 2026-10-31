import { NextResponse } from 'next/server';
import { getSupabaseAdmin, authorizeEtapaAction } from '../../../../../lib/supabaseAdmin';
import { normalizeTorneio, findMatch, applyMatchResult } from '../../../../../lib/bracketEngine';

export const dynamic = 'force-dynamic';

// Lança o resultado de UM jogo sobre o estado mais recente do banco.
// Assim, dois árbitros lançando jogos diferentes ao mesmo tempo não
// sobrescrevem o trabalho um do outro.
export async function POST(req, { params }) {
  const scope = await authorizeEtapaAction(req, params.id);
  if (!scope) return NextResponse.json({ error: 'Link inválido ou sem permissão.' }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }
  const sets = Array.isArray(body.sets)
    ? body.sets
        .map((s) => [Number(s && s[0]) || 0, Number(s && s[1]) || 0])
        .filter((s) => s[0] !== 0 || s[1] !== 0)
    : [];
  if (!body.matchId || sets.length === 0) {
    return NextResponse.json({ error: 'Informe o placar de ao menos um set.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: e, error } = await supabaseAdmin
    .from('etapas')
    .select('estado_chaveamento, disputa_terceiro, status')
    .eq('id', params.id)
    .single();
  if (error || !e || !e.estado_chaveamento) {
    return NextResponse.json({ error: 'Etapa sem sorteio realizado.' }, { status: 404 });
  }
  if (e.status === 'finalizada') {
    return NextResponse.json({ error: 'Etapa já finalizada.' }, { status: 409 });
  }

  const current = normalizeTorneio(e.estado_chaveamento, e.disputa_terceiro);
  const m = findMatch(current, body.matchId);
  if (!m) {
    return NextResponse.json({ error: 'Jogo não encontrado. Atualize a página.', torneio: current }, { status: 404 });
  }
  if (body.teamA && (m.teamA !== body.teamA || m.teamB !== body.teamB)) {
    return NextResponse.json(
      { error: 'As duplas deste jogo mudaram. A página foi atualizada — confira e lance de novo.', torneio: current },
      { status: 409 }
    );
  }

  const next = applyMatchResult(current, body.matchId, sets, e.disputa_terceiro);
  const update = { estado_chaveamento: next };
  if (e.status === 'planejada') update.status = 'em_andamento';
  const { error: upErr } = await supabaseAdmin.from('etapas').update(update).eq('id', params.id);
  if (upErr) return NextResponse.json({ error: 'Erro ao salvar: ' + upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, torneio: next });
}

import { createClient } from '@supabase/supabase-js';

// Use SOMENTE dentro de app/api/**/route.js (código de servidor).
// A service_role key ignora RLS, por isso nunca deve ser importada
// em nenhum componente com "use client".
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, serviceKey, {
    db: { schema: 'beat_torneio' },
  });
}

export function isValidAdminPassword(req) {
  const provided = req.headers.get('x-admin-password');
  return Boolean(provided) && provided === process.env.ADMIN_PASSWORD;
}

// Autoriza ações de uma etapa específica de duas formas:
// - senha de admin (acesso total: 'admin')
// - token de compartilhamento da própria etapa (acesso restrito: 'resultado',
//   usado pelo link público de lançar resultado)
// Retorna 'admin' | 'resultado' | null
export async function authorizeEtapaAction(req, etapaId) {
  if (isValidAdminPassword(req)) return 'admin';
  const token = req.headers.get('x-etapa-token');
  if (token && etapaId) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data } = await supabaseAdmin
      .from('etapa_tokens')
      .select('token_resultado')
      .eq('etapa_id', etapaId)
      .single();
    if (data && data.token_resultado === token) return 'resultado';
  }
  return null;
}

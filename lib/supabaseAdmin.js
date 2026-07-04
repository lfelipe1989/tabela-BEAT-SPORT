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

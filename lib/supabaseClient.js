import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Todas as tabelas do torneio vivem no schema "beat_torneio" (isolado
// de qualquer outra tabela que já exista no seu projeto Supabase).
// Lembre-se de adicionar "beat_torneio" em
// Project Settings > API > Exposed schemas no painel do Supabase.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'beat_torneio' },
});

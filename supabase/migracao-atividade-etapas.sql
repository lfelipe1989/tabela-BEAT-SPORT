-- Marca a última movimentação de cada etapa (usada na lista de etapas).
-- Já aplicada no Supabase em 2026-10-31.
alter table beat_torneio.etapas add column if not exists atualizado_em timestamptz;
alter table beat_torneio.etapas alter column atualizado_em set default now();
-- (ver triggers etapa_atividade / etapa_toque_* no projeto)

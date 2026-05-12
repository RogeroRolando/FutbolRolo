-- Posiciones alternativas del jugador (bonificación menor que la principal en la pizarra)
alter table public.players
  add column if not exists secondary_positions text[] not null default '{}';

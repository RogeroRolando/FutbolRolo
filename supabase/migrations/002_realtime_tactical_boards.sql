-- Habilita cambios en vivo para que otros dispositivos reciban actualizaciones de la pizarra.
-- Si falla con "already member of publication", ignorar o quitar la tabla duplicada del dashboard.

alter publication supabase_realtime add table public.tactical_boards;

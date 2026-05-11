-- Carga masiva de jugadores — Rolo Futbol
-- Ejecutar en Supabase → SQL Editor (como usuario con permisos sobre public.players).
--
-- Mapeo usado:
--   primary_position: ARQ | DEF | VOL | DEL | OTRO (según encuesta)
--   foot: derecha | izquierda | ambas
--   strengths / weaknesses: texto libre (fuertes y alternativas / notas)
--   rating: escala 1–10 del “estado físico actual” de la encuesta
--   fitness_status: siempre 'ok' aquí (podés ajustar en la app: molestias / lesionado)
--
-- Si ya cargaste antes y querés evitar duplicados por nombre, descomentá el bloque final.

begin;

insert into public.players (
  full_name,
  primary_position,
  foot,
  strengths,
  weaknesses,
  fitness_status,
  rating,
  rating_updated_at,
  shirt_number,
  archived
) values
(
  'Rolo',
  'DEL',
  'izquierda',
  'Velocidad, cabezazo (9 de área).',
  'Alternativas: puede dar una mano en cualquier puesto.',
  'ok',
  6.0,
  now(),
  10,
  false
),
(
  'Lucas Villagra',
  'DEF',
  'derecha',
  'Marca, resistencia (lateral).',
  'Alternativas: volante por afuera / central.',
  'ok',
  6.0,
  now(),
  5,
  false
),
(
  'Raúl',
  'DEL',
  'izquierda',
  'Velocidad, resistencia (extremo izquierdo).',
  'Alternativas: lateral izquierdo.',
  'ok',
  8.0,
  now(),
  11,
  false
),
(
  'Matías',
  'DEF',
  'derecha',
  'Marca (4).',
  'Alternativas: 9. Nota: “Estoy para cuando haga falta, cuando seamos poquitos”.',
  'ok',
  5.0,
  now(),
  66,
  false
),
(
  'Melli',
  'ARQ',
  'derecha',
  'Marca, pase.',
  'Alternativas: mediocampo.',
  'ok',
  8.0,
  now(),
  12,
  false
),
(
  'Dany',
  'DEL',
  'derecha',
  'Pase, remate (delantero).',
  'Alternativas: medio campo. Nota: se entiende bien con Chanchi, Quique y el Gato.',
  'ok',
  5.0,
  now(),
  6,
  false
),
(
  'Fer',
  'DEL',
  'derecha',
  'Pase (centro delantero).',
  'Alternativas: 4 (defensa).',
  'ok',
  3.0,
  now(),
  20,
  false
),
(
  'Mauro S',
  'DEF',
  'ambas',
  'Marca, pase (4).',
  'Alternativas: 2, 3, 8.',
  'ok',
  7.0,
  now(),
  8,
  false
),
(
  'Emi',
  'VOL',
  'derecha',
  'Remate, pase (liberado / adelante del 5).',
  'Alternativas: por derecha o izquierda.',
  'ok',
  6.0,
  now(),
  20,
  false
),
(
  'Jorge',
  'ARQ',
  'izquierda',
  'Marca, pase.',
  'Alternativas: defensa lateral izquierdo.',
  'ok',
  8.0,
  now(),
  null,
  false
),
(
  'Chanchy',
  'DEL',
  'derecha',
  'Remate, cabezazo (centro delantero).',
  'Alternativas: también al arco; “abajo de 4”.',
  'ok',
  1.0,
  now(),
  28,
  false
),
(
  'Flaco',
  'DEF',
  'derecha',
  'Marca, pase (2).',
  'Alternativas: 3 o 4.',
  'ok',
  7.5,
  now(),
  3,
  false
),
(
  'Gato',
  'VOL',
  'ambas',
  'Técnica, velocidad, juego asociado (mediocampista ofensivo).',
  'Alternativas: defensa segundo central izquierdo.',
  'ok',
  8.0,
  now(),
  33,
  false
),
(
  'Javier',
  'VOL',
  'ambas',
  'Polivalente: casi todo menos cabezazo; recuperación y centros, rara vez al arco.',
  'Alternativas: volante o 6; todas menos de 2; puede ir por derecha o izquierda.',
  'ok',
  8.0,
  now(),
  13,
  false
),
(
  'Edgar',
  'ARQ',
  'derecha',
  'Marca, pase.',
  'Alternativas: defensor; volante al medio.',
  'ok',
  4.0,
  now(),
  35,
  false
),
(
  'Lucas Muzzo',
  'DEF',
  'derecha',
  'Marca (2 central).',
  'Alternativas: 4.',
  'ok',
  5.5,
  now(),
  73,
  false
);

commit;

-- ---------------------------------------------------------------------------
-- Opcional: borrar solo esta carga si la repetís por error (mismos 16 nombres)
-- ---------------------------------------------------------------------------
-- begin;
-- delete from public.players
-- where full_name in (
--   'Rolo','Lucas Villagra','Raúl','Matías','Melli','Dany','Fer','Mauro S','Emi',
--   'Jorge','Chanchy','Flaco','Gato','Javier','Edgar','Lucas Muzzo'
-- );
-- commit;

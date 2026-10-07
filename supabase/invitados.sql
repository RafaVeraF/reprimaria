-- =====================================================================
--  REPRIMARIA · Lista de invitados
--  Cambia cada "CORREO@..." por el correo real de cada quien y corre
--  este archivo en Supabase → SQL Editor. Solo estos correos podrán
--  crear cuenta. es_admin = true puede programar/cancelar domingos,
--  registrar clases pasadas y administrar invitados.
--  Puedes volver a correrlo cuando cambies algo.
-- =====================================================================
insert into public.invitados (email, nombre, es_admin) values
  ('CORREO@mama.com',      'Mamá',   true),
  ('CORREO@papa.com',      'Papá',   true),
  ('CORREO@maye.com',      'Maye',   false),
  ('CORREO@montse.com',    'Montse', false),
  ('rafavera.de@gmail.com','Rafa',   true),
  ('CORREO@elvia.com',     'Elvia',  false),
  ('CORREO@migue.com',     'Migue',  false),
  ('CORREO@mel.com',       'Mel',    false),
  ('CORREO@saddam.com',    'Saddam', false),
  ('CORREO@shuri.com',     'Shuri',  false),
  ('CORREO@richie.com',    'Richie', false),
  ('CORREO@santi.com',     'Santi',  false),
  ('CORREO@moi.com',       'Moi',    false),
  ('CORREO@yuyus.com',     'Yuyus',  false)
on conflict (email) do update
  set nombre = excluded.nombre, es_admin = excluded.es_admin;

-- Borra los correos de ejemplo que no hayas cambiado:
delete from public.invitados where email like 'CORREO@%';

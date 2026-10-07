# ✏️ Reprimaria

La escuelita familiar de los domingos. Cualquiera propone un curso, la familia vota
de lunes a jueves y el ganador se da el domingo. Cada curso tiene lecciones con video,
material de apoyo, comentarios, reacciones y apuntes personales.

**Tecnología:** React + Vite (la página), Supabase (base de datos, cuentas y archivos),
GitHub (el código) y Render (la publicación, gratis).

---

## Qué hay en esta carpeta

| Archivo / carpeta | Para qué sirve |
|---|---|
| `supabase/schema.sql` | Crea todas las tablas, reglas de seguridad y la lógica de votación. Se corre una vez. |
| `supabase/invitados.sql` | La lista de correos que pueden crear cuenta. **Tienes que llenar los correos.** |
| `src/` | El código de la aplicación. |
| `render.yaml` | La configuración para publicar en Render. |
| `.env.example` | La plantilla de las llaves de Supabase para probar en tu compu. |

---

## Paso 1 · Crear el proyecto en Supabase (10 min)

1. Entra a <https://supabase.com>, crea una cuenta y luego **New project**.
   - Nombre: `reprimaria`. Región: la más cercana (por ejemplo *East US*).
   - Guarda la contraseña de la base de datos en un lugar seguro, aunque casi no la vas a usar.
2. Cuando termine de crearse, ve a **SQL Editor → New query**. Abre `supabase/schema.sql`,
   copia **todo**, pégalo y dale **Run**. Debe decir *Success*.
3. Abre `supabase/invitados.sql` y cambia cada `CORREO@...` por el correo real de cada quien.
   Pégalo en otra query y dale **Run**.
   - Mamá, Papá y Rafa quedan como admins (`true`). Cámbialo si quieres.
   - Si todavía no tienes algún correo, déjalo así: esa fila se borra sola y la puedes
     agregar después desde la app, en **Dirección → Lista de invitados**.
4. Ve a **Authentication → Sign In / Providers → Email**:
   - Deja **Email** activado.
   - **Desactiva "Confirm email"**. Así nadie tiene que esperar un correo para entrar.
     Supabase gratis solo manda unos cuantos correos por hora y con 14 personas se atora.
     La lista de invitados ya impide que entre alguien de fuera.
5. Ve a **Project Settings → API** (o **API Keys**) y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - La llave **anon public** (o **publishable**) → `VITE_SUPABASE_ANON_KEY`

   ⚠️ Nunca uses la llave `service_role` o `secret` en la app.

## Paso 2 · Probarlo en tu compu (opcional, pero recomendado)

Necesitas [Node.js](https://nodejs.org) versión 20 o más nueva (la LTS).

```bash
cd C:\dev\Reprimaria
copy .env.example .env      # luego abre .env y pega tus dos valores
npm install
npm run dev
```

Abre <http://localhost:5173>, entra en **Primera vez** con tu correo y elige una contraseña.

## Paso 3 · Subirlo a GitHub

1. En <https://github.com/new> crea un repositorio **privado** llamado `reprimaria`,
   sin README.
2. En la terminal, dentro de `C:\dev\Reprimaria`:

```bash
git init
git add .
git commit -m "Reprimaria: primera versión"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/reprimaria.git
git push -u origin main
```

(El archivo `.env` **no** se sube; está en `.gitignore` a propósito.)

Si prefieres no usar la terminal, [GitHub Desktop](https://desktop.github.com) hace lo
mismo con botones: *Add local repository* → *Publish repository* (marca *private*).

## Paso 4 · Publicarlo en Render

1. Entra a <https://render.com> con tu cuenta de GitHub.
2. **New → Blueprint** y elige el repositorio `reprimaria`. Render lee `render.yaml`.
3. Te va a pedir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Pega los mismos valores del paso 1.
4. **Apply**. En un par de minutos tendrás una dirección como `https://reprimaria.onrender.com`.

<details>
<summary>Si prefieres crearlo a mano en lugar de Blueprint</summary>

**New → Static Site**, elige el repo y configura:
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment: agrega las dos variables `VITE_...`
- Redirects/Rewrites: **Source** `/*` → **Destination** `/index.html` → **Action** `Rewrite`
  (sin esto, recargar una página como `/cursos` da error 404).
</details>

## Paso 5 · Decirle a Supabase cuál es tu dirección

En Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://reprimaria.onrender.com` (la tuya).
- **Redirect URLs:** agrega `https://reprimaria.onrender.com/**` y `http://localhost:5173/**`.

Esto hace que funcione el enlace de *"Olvidé mi contraseña"*.

## Paso 6 · Invitar a la familia

Manda el link. Cada quien entra a **Primera vez**, pone **el correo que registraste en
invitados** y elige su contraseña. Si usa otro correo, le dirá que no está invitado.

Después vale la pena que un admin entre a **Dirección → Capturar clase pasada** y registre
las clases de la pandemia (banderas, música, lagos, neumática…) para que aparezcan en la
**Boleta**. La persona que dio la clase necesita tener cuenta para poder elegirla.

---

## Cómo funciona la votación

- **Lunes a jueves:** cada persona tiene **3 votos** y no puede votar por su propio curso.
  Puede quitar un voto y ponerlo en otro mientras siga abierta.
- **Viernes:** la primera persona que abre la app cierra la votación automáticamente
  (no hace falta ningún programa extra). Un admin también puede cerrarla antes desde **Dirección**.
- **Puntos:** 1 por voto, más ⭐ 1 de *antigüedad* si la propuesta lleva 3 semanas o más en el pizarrón.
- **Turnos:** quien dio la última clase no puede ganar esa semana.
- **Empate:** gana quien lleva más tiempo sin dar clase.
- **Nadie votó:** domingo libre.
- **Admins:** pueden mover la fecha de un domingo o cancelarlo; si lo cancelan, el curso regresa al pizarrón.

Todo usa la hora de Ciudad de México. Las reglas están en la función `cerrar_votacion()`
de `schema.sql`, por si un día quieren cambiarlas.

## Videos y archivos

- **Videos:** lo mejor es subirlos a YouTube como **No listado** y pegar el link en la lección.
  También funcionan Vimeo y Google Drive (compartido como *cualquiera con el enlace*).
- **Subir directo:** se pueden subir archivos de hasta **50 MB** (PDF, imágenes, presentaciones
  o videos cortos). El plan gratis de Supabase trae 1 GB en total, así que conviene guardar
  ese espacio para el material ligero.
- Los archivos son **privados**: solo los ve la familia con su sesión iniciada.

## Seguridad, en corto

- Solo los correos en `invitados` pueden crear cuenta.
- Cada quien solo puede editar sus propios cursos, comentarios y reacciones.
- Los apuntes son privados: ni los admins los ven.
- Nadie puede hacerse admin a sí mismo.

## Cosas a saber del plan gratis

- **Supabase** pausa los proyectos que pasan **7 días sin uso**. Con la votación semanal
  no debería pasar; si pasa, se reactiva con un clic en el panel de Supabase.
- **Render (sitio estático)** no se duerme y es gratis.

## Ideas para después

- Mini quiz al final de cada curso.
- Insignias: "Profe del mes", "Nunca falta", "Más preguntón".
- Avisos por WhatsApp o correo cuando se elige el curso del domingo.
- Asistencia: marcar quién estuvo en la clase en vivo.

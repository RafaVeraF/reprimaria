// ---------- Fechas (siempre en hora de Ciudad de México) ----------
const TZ = 'America/Mexico_City'

export function hoyLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

function aFecha(f) {
  return typeof f === 'string' && f.length === 10 ? new Date(f + 'T12:00:00') : new Date(f)
}

export function fmtFecha(f, opciones = { weekday: 'long', day: 'numeric', month: 'long' }) {
  if (!f) return ''
  return aFecha(f).toLocaleDateString('es-MX', { ...opciones, timeZone: TZ })
}

export function fmtFechaCorta(f) {
  return fmtFecha(f, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function haceCuanto(ts) {
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`
  return fmtFechaCorta(ts)
}

// ---------- Videos ----------
// Acepta YouTube, Vimeo, Google Drive, un .mp4 directo o un archivo subido ("storage:ruta").
export function videoEmbed(url) {
  if (!url) return null
  if (url.startsWith('storage:')) return { tipo: 'archivo', path: url.slice(8) }
  let u
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^(www\.|m\.)/, '')
  let id = null
  if (host === 'youtu.be') id = u.pathname.slice(1)
  else if (host.endsWith('youtube.com')) {
    id = u.searchParams.get('v') || (u.pathname.match(/\/(embed|shorts|live)\/([^/?]+)/) || [])[2]
  }
  if (id) return { tipo: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}` }
  if (host === 'vimeo.com') {
    const m = u.pathname.match(/\/(\d+)/)
    if (m) return { tipo: 'iframe', src: `https://player.vimeo.com/video/${m[1]}` }
  }
  if (host === 'drive.google.com') {
    const m = u.pathname.match(/\/file\/d\/([^/]+)/)
    if (m) return { tipo: 'iframe', src: `https://drive.google.com/file/d/${m[1]}/preview` }
  }
  if (/\.(mp4|webm|ogg|mov)$/i.test(u.pathname)) return { tipo: 'video', src: url }
  return { tipo: 'link', src: url }
}

// ---------- Archivos ----------
export function nombreSeguro(nombre) {
  return nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(-80)
}

export function tamano(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ---------- Errores en español ----------
export function mensajeError(e) {
  const m = e?.message || String(e || '')
  if (/NO_INVITADO|Database error saving new user/i.test(m))
    return 'Ese correo no está en la lista de invitados de la Reprimaria. Pídele a un admin que te agregue.'
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.'
  if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene cuenta. Usa "Entrar".'
  if (/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.'
  if (/Email not confirmed/i.test(m)) return 'Falta confirmar tu correo. Revisa tu bandeja de entrada.'
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.'
  if (/Payload too large|exceeded the maximum allowed size/i.test(m)) return 'El archivo es demasiado grande (máximo 50 MB). Para videos usa YouTube.'
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer eso.'
  return m
}

export const EMOJIS_CURSO = ['📚', '🌎', '🎵', '🚩', '🏞️', '⚙️', '🧪', '🎨', '🍳', '🧠', '📐', '🦖', '🌱', '🚀', '🎭', '💸', '⚽', '🧶']
export const EMOJIS_PERFIL = ['🙂', '😎', '🤓', '🦊', '🐻', '🐼', '🦁', '🐸', '🐙', '🦄', '🌻', '🌵', '⭐', '🔥', '🎸', '📷', '🧉', '☕']
export const COLORES = ['#2e4a3a', '#c8553d', '#3d5a80', '#8a5a44', '#6a4c93', '#d4a017', '#1b998b', '#b23a48', '#4a7c59', '#33415c']
export const REACCIONES = ['👏', '🤯', '😂', '❤️', '🤓']

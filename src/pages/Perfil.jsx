import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { COLORES, EMOJIS_PERFIL, haceCuanto, mensajeError } from '../lib/util'
import { Avatar, Aviso, SelectorEmoji } from '../components/ui'

export default function Perfil() {
  const { yo, session, cargarMiembros } = useAuth()
  const [form, setForm] = useState({ nombre: yo.nombre, emoji: yo.emoji, color: yo.color })
  const [msg, setMsg] = useState({ tipo: '', texto: '' })
  const [pass, setPass] = useState('')
  const [apuntes, setApuntes] = useState([])

  useEffect(() => {
    supabase.from('apuntes')
      .select('contenido, updated_at, leccion:lecciones(id, titulo, curso:cursos(titulo, emoji))')
      .eq('usuario_id', yo.id).order('updated_at', { ascending: false })
      .then(({ data }) => setApuntes((data || []).filter((a) => a.contenido.trim() && a.leccion)))
  }, [yo.id])

  async function guardar(e) {
    e.preventDefault()
    const { error } = await supabase.from('perfiles')
      .update({ nombre: form.nombre.trim() || yo.nombre, emoji: form.emoji, color: form.color }).eq('id', yo.id)
    if (error) return setMsg({ tipo: 'error', texto: mensajeError(error) })
    await cargarMiembros()
    setMsg({ tipo: 'ok', texto: 'Perfil actualizado.' })
  }

  async function cambiarPass(e) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: pass })
    if (error) return setMsg({ tipo: 'error', texto: mensajeError(error) })
    setPass('')
    setMsg({ tipo: 'ok', texto: 'Contraseña cambiada.' })
  }

  return (
    <div className="angosto">
      <h1>Mi perfil</h1>
      <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>

      <form className="tarjeta" onSubmit={guardar}>
        <div className="perfil-vista">
          <Avatar perfil={{ ...yo, ...form }} tam={64} />
          <div>
            <strong>{form.nombre}</strong>
            <div className="sub">{session.user.email}</div>
          </div>
        </div>
        <label>
          ¿Cómo quieres que te digan?
          <input value={form.nombre} maxLength={30} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </label>
        <label>Tu emoji</label>
        <SelectorEmoji opciones={EMOJIS_PERFIL} valor={form.emoji} onChange={(emoji) => setForm({ ...form, emoji })} />
        <label>Tu color</label>
        <div className="selector-color">
          {COLORES.map((c) => (
            <button type="button" key={c} style={{ background: c }} className={c === form.color ? 'activo' : ''}
              onClick={() => setForm({ ...form, color: c })} aria-label={c} />
          ))}
        </div>
        <button className="btn">Guardar</button>
      </form>

      <section className="tarjeta">
        <h2>📓 Mis apuntes</h2>
        {apuntes.length === 0 ? (
          <p className="sub">Todavía no tienes apuntes. Aparecen aquí los que escribas en cada lección.</p>
        ) : (
          <ul className="lista-apuntes">
            {apuntes.map((a) => (
              <li key={a.leccion.id}>
                <Link to={`/lecciones/${a.leccion.id}`}>
                  {a.leccion.curso?.emoji} {a.leccion.curso?.titulo} · <strong>{a.leccion.titulo}</strong>
                </Link>
                <p>{a.contenido.slice(0, 160)}{a.contenido.length > 160 ? '…' : ''}</p>
                <span className="sub">{haceCuanto(a.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="tarjeta" onSubmit={cambiarPass}>
        <h2>Cambiar contraseña</h2>
        <label>
          Nueva contraseña
          <input type="password" minLength={6} required autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>
        <button className="btn secundario">Cambiar</button>
      </form>
    </div>
  )
}

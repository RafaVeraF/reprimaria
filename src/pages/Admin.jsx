import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { EMOJIS_CURSO, fmtFecha, hoyLocal, mensajeError } from '../lib/util'
import { Avatar, Aviso, SelectorEmoji } from '../components/ui'

export default function Admin() {
  const { yo, miembros, cargarMiembros } = useAuth()
  const [invitados, setInvitados] = useState([])
  const [domingos, setDomingos] = useState([])
  const [nuevoInv, setNuevoInv] = useState({ email: '', nombre: '', es_admin: false })
  const [pasada, setPasada] = useState({ titulo: '', autor: '', fecha: '', emoji: '📚' })
  const [msg, setMsg] = useState({ tipo: '', texto: '' })

  const cargar = useCallback(async () => {
    const [i, d] = await Promise.all([
      supabase.from('invitados').select('*').order('nombre'),
      supabase.from('domingos').select('fecha, curso:cursos(id, titulo, emoji, autor_id)')
        .gte('fecha', hoyLocal()).order('fecha'),
    ])
    setInvitados(i.data || [])
    setDomingos(d.data || [])
  }, [])

  useEffect(() => { if (yo.es_admin) cargar() }, [cargar, yo.es_admin])

  if (!yo.es_admin) return <div className="vacio">Esta sección es solo para la Dirección (admins).</div>

  const ok = (texto) => setMsg({ tipo: 'ok', texto })
  const fallo = (e) => setMsg({ tipo: 'error', texto: mensajeError(e) })

  async function agregarInvitado(e) {
    e.preventDefault()
    const { error } = await supabase.from('invitados').upsert({ ...nuevoInv, email: nuevoInv.email.trim().toLowerCase() })
    if (error) return fallo(error)
    setNuevoInv({ email: '', nombre: '', es_admin: false })
    ok('Invitado agregado. Ya puede crear su cuenta en "Primera vez".')
    cargar()
  }

  async function quitarInvitado(inv) {
    if (!confirm(`¿Quitar a ${inv.email} de la lista? (No borra su cuenta si ya la creó)`)) return
    const { error } = await supabase.from('invitados').delete().eq('email', inv.email)
    if (error) return fallo(error)
    cargar()
  }

  async function alternarAdmin(m) {
    if (m.id === yo.id && !confirm('¿Quitarte a ti mismo como admin?')) return
    const { error } = await supabase.from('perfiles').update({ es_admin: !m.es_admin }).eq('id', m.id)
    if (error) return fallo(error)
    cargarMiembros()
  }

  async function moverDomingo(d, nuevaFecha) {
    if (!nuevaFecha || nuevaFecha === d.fecha) return
    const { error } = await supabase.from('domingos').update({ fecha: nuevaFecha }).eq('fecha', d.fecha)
    if (error) return fallo(error)
    ok(`"${d.curso.titulo}" se movió al ${fmtFecha(nuevaFecha)}.`)
    cargar()
  }

  async function cancelarDomingo(d) {
    if (!confirm(`¿Cancelar "${d.curso.titulo}" del ${fmtFecha(d.fecha)}? El curso regresa al pizarrón.`)) return
    const { error } = await supabase.rpc('cancelar_domingo', { p_fecha: d.fecha })
    if (error) return fallo(error)
    ok('Domingo cancelado; el curso regresó al pizarrón.')
    cargar()
  }

  async function registrarPasada(e) {
    e.preventDefault()
    const { error } = await supabase.rpc('registrar_clase_pasada', {
      p_titulo: pasada.titulo.trim(), p_autor: pasada.autor, p_fecha: pasada.fecha, p_emoji: pasada.emoji,
    })
    if (error) return fallo(error)
    ok(`"${pasada.titulo}" quedó en la boleta.`)
    setPasada({ titulo: '', autor: pasada.autor, fecha: '', emoji: '📚' })
  }

  async function cerrarVotacion() {
    if (!confirm('¿Cerrar la votación de esta semana ya y elegir al ganador?')) return
    const { data, error } = await supabase.rpc('cerrar_votacion')
    if (error) return fallo(error)
    ok(data ? 'Votación cerrada. El ganador ya está programado.' : 'No hubo votos: domingo libre.')
    cargar()
  }

  return (
    <div>
      <div className="seccion-titulo">
        <div>
          <h1>Dirección</h1>
          <p className="sub">Herramientas para los admins de la Reprimaria.</p>
        </div>
      </div>
      <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>

      <div className="admin-rejilla">
        <section className="tarjeta">
          <h2>Domingos programados</h2>
          {domingos.length === 0 ? <p className="sub">No hay clases programadas.</p> : (
            <ul className="lista-simple">
              {domingos.map((d) => (
                <li key={d.fecha}>
                  <Link to={`/cursos/${d.curso.id}`}>{d.curso.emoji} {d.curso.titulo}</Link>
                  <Avatar id={d.curso.autor_id} tam={22} />
                  <input type="date" defaultValue={d.fecha} onBlur={(e) => moverDomingo(d, e.target.value)} title="Cambiar fecha" />
                  <button className="btn-texto peligro" onClick={() => cancelarDomingo(d)}>Cancelar</button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn secundario" onClick={cerrarVotacion}>Cerrar votación de esta semana ahora</button>
        </section>

        <section className="tarjeta">
          <h2>Capturar clase pasada</h2>
          <p className="sub">Para llenar la boleta con las clases de la pandemia (banderas, música, lagos, neumática…).</p>
          <form onSubmit={registrarPasada}>
            <label>Materia<input required value={pasada.titulo} onChange={(e) => setPasada({ ...pasada, titulo: e.target.value })} /></label>
            <label>
              ¿Quién la dio?
              <select required value={pasada.autor} onChange={(e) => setPasada({ ...pasada, autor: e.target.value })}>
                <option value="">Elige…</option>
                {Object.values(miembros).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </label>
            <label>Fecha<input type="date" required max={hoyLocal()} value={pasada.fecha} onChange={(e) => setPasada({ ...pasada, fecha: e.target.value })} /></label>
            <SelectorEmoji opciones={EMOJIS_CURSO} valor={pasada.emoji} onChange={(emoji) => setPasada({ ...pasada, emoji })} />
            <button className="btn">Agregar a la boleta</button>
          </form>
          <p className="ayuda">Solo aparecen en "¿Quién la dio?" quienes ya crearon su cuenta.</p>
        </section>

        <section className="tarjeta">
          <h2>Integrantes</h2>
          <ul className="lista-simple">
            {Object.values(miembros).map((m) => (
              <li key={m.id}>
                <Avatar perfil={m} tam={26} conNombre />
                <label className="interruptor">
                  <input type="checkbox" checked={m.es_admin} onChange={() => alternarAdmin(m)} /> admin
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="tarjeta">
          <h2>Lista de invitados</h2>
          <ul className="lista-simple">
            {invitados.map((inv) => (
              <li key={inv.email}>
                <span>{inv.nombre}{inv.es_admin && ' ⭐'}</span>
                <span className="sub">{inv.email}</span>
                <button className="btn-texto peligro" onClick={() => quitarInvitado(inv)}>Quitar</button>
              </li>
            ))}
          </ul>
          <form className="fila-form" onSubmit={agregarInvitado}>
            <input required placeholder="Nombre" value={nuevoInv.nombre} onChange={(e) => setNuevoInv({ ...nuevoInv, nombre: e.target.value })} />
            <input required type="email" placeholder="correo@…" value={nuevoInv.email} onChange={(e) => setNuevoInv({ ...nuevoInv, email: e.target.value })} />
            <label className="interruptor">
              <input type="checkbox" checked={nuevoInv.es_admin} onChange={(e) => setNuevoInv({ ...nuevoInv, es_admin: e.target.checked })} /> admin
            </label>
            <button className="btn chico">Invitar</button>
          </form>
        </section>
      </div>
    </div>
  )
}

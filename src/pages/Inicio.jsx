import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fmtFecha, hoyLocal, mensajeError } from '../lib/util'
import { Avatar, Aviso, Cargando } from '../components/ui'

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

export default function Inicio() {
  const { yo } = useAuth()
  const [estado, setEstado] = useState(null)
  const [proximo, setProximo] = useState(null)
  const [propuestas, setPropuestas] = useState([])
  const [puntos, setPuntos] = useState({})
  const [misVotos, setMisVotos] = useState([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(null)

  const cargar = useCallback(async () => {
    setError('')
    const { data: est, error: e1 } = await supabase.rpc('estado_semana')
    if (e1) { setError(mensajeError(e1)); setCargando(false); return }
    const st = est[0]
    // A partir del viernes, la primera persona que entra cierra la votación.
    if (!st.abierta) await supabase.rpc('cerrar_votacion')

    const [dom, props, pts, votos] = await Promise.all([
      supabase.from('domingos').select('fecha, nota, curso:cursos(*)')
        .gte('fecha', hoyLocal()).order('fecha').limit(1).maybeSingle(),
      supabase.from('cursos').select('*').eq('estado', 'propuesta').order('created_at'),
      supabase.rpc('puntajes_semana'),
      supabase.from('votos').select('curso_id').eq('semana', st.semana).eq('usuario_id', yo.id),
    ])
    setEstado(st)
    setProximo(dom.data)
    setPropuestas(props.data || [])
    setPuntos(Object.fromEntries((pts.data || []).map((p) => [p.curso_id, p])))
    setMisVotos((votos.data || []).map((v) => v.curso_id))
    setCargando(false)
  }, [yo.id])

  useEffect(() => { cargar() }, [cargar])

  async function votar(curso) {
    setOcupado(curso.id); setError('')
    const yaVote = misVotos.includes(curso.id)
    const { error } = yaVote
      ? await supabase.from('votos').delete()
          .eq('curso_id', curso.id).eq('usuario_id', yo.id).eq('semana', estado.semana)
      : await supabase.from('votos').insert({ curso_id: curso.id, usuario_id: yo.id, semana: estado.semana })
    if (error) setError(mensajeError(error))
    await cargar()
    setOcupado(null)
  }

  async function cerrarYa() {
    if (!confirm('¿Cerrar la votación ahora y elegir el curso del domingo?')) return
    const { error } = await supabase.rpc('cerrar_votacion')
    if (error) setError(mensajeError(error))
    cargar()
  }

  if (cargando) return <Cargando />

  const total = (id) => (puntos[id]?.votos || 0) + (puntos[id]?.antiguedad || 0)
  const ordenadas = [...propuestas].sort((a, b) => total(b.id) - total(a.id))
  const votosRestantes = 3 - misVotos.length
  const esteDomingo = estado.domingo

  return (
    <div className="inicio">
      <Aviso>{error}</Aviso>

      {/* ---------- Este domingo ---------- */}
      <section className="pizarron">
        <div className="pizarron-etiqueta">
          {proximo?.fecha === hoyLocal() ? '¡Hoy hay Reprimaria!' : 'Próxima clase'}
        </div>
        {proximo ? (
          <Link to={`/cursos/${proximo.curso.id}`} className="pizarron-clase">
            <span className="pizarron-emoji">{proximo.curso.emoji}</span>
            <div>
              <h1>{proximo.curso.titulo}</h1>
              <p className="pizarron-meta">
                <Avatar id={proximo.curso.autor_id} tam={28} conNombre /> · {fmtFecha(proximo.fecha)}
              </p>
            </div>
          </Link>
        ) : estado.abierta ? (
          <div className="pizarron-clase">
            <span className="pizarron-emoji">🗳️</span>
            <div>
              <h1>Se está votando</h1>
              <p className="pizarron-meta">
                La votación cierra el jueves en la noche. El viernes sabremos qué se da el {fmtFecha(esteDomingo)}.
              </p>
            </div>
          </div>
        ) : (
          <div className="pizarron-clase">
            <span className="pizarron-emoji">🛋️</span>
            <div>
              <h1>Domingo libre</h1>
              <p className="pizarron-meta">Nadie votó esta semana. ¡Propón algo para la próxima!</p>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Pizarrón de ideas / votación ---------- */}
      <section>
        <div className="seccion-titulo">
          <div>
            <h2>Pizarrón de ideas</h2>
            <p className="sub">
              {estado.abierta
                ? <>Hoy es {DIAS[estado.dia]}: la votación está <strong>abierta</strong>. Te quedan <strong>{votosRestantes}</strong> de 3 votos.</>
                : <>La votación de esta semana ya cerró. Vuelve a abrir el lunes.</>}
            </p>
          </div>
          <div className="acciones">
            {yo.es_admin && estado.abierta && (
              <button className="btn secundario" onClick={cerrarYa}>Cerrar votación ya</button>
            )}
            <Link to="/cursos/nuevo" className="btn">+ Proponer curso</Link>
          </div>
        </div>

        {ordenadas.length === 0 ? (
          <div className="vacio">
            El pizarrón está vacío. ¿Qué te gustaría enseñar? 🎓
          </div>
        ) : (
          <div className="rejilla-ideas">
            {ordenadas.map((c, i) => {
              const mio = c.autor_id === yo.id
              const vote = misVotos.includes(c.id)
              const puedeVotar = estado.abierta && !mio && (vote || votosRestantes > 0)
              return (
                <article key={c.id} className={`idea ${vote ? 'votada' : ''}`} style={{ '--giro': `${((i * 7) % 5) - 2}deg` }}>
                  <span className="chinche" aria-hidden />
                  <Link to={`/cursos/${c.id}`} className="idea-cuerpo">
                    <span className="idea-emoji">{c.emoji}</span>
                    <h3>{c.titulo}</h3>
                    {c.descripcion && <p>{c.descripcion.slice(0, 120)}{c.descripcion.length > 120 ? '…' : ''}</p>}
                  </Link>
                  <div className="idea-pie">
                    <Avatar id={c.autor_id} tam={26} conNombre />
                    <div className="idea-votos">
                      <span className="marcador" title="Puntos esta semana">
                        {total(c.id)} {total(c.id) === 1 ? 'pt' : 'pts'}
                      </span>
                      {puntos[c.id]?.antiguedad > 0 && <span className="insignia" title="Lleva 3+ semanas en el pizarrón: +1 punto">⭐ antigüedad</span>}
                    </div>
                  </div>
                  {estado.abierta && (
                    mio ? (
                      <div className="idea-nota">Es tu propuesta</div>
                    ) : (
                      <button
                        className={`btn-voto ${vote ? 'activo' : ''}`}
                        disabled={!puedeVotar || ocupado === c.id}
                        onClick={() => votar(c)}
                      >
                        {vote ? '✔ Votado (quitar)' : '✋ Votar'}
                      </button>
                    )
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <details className="reglas">
        <summary>¿Cómo se elige la clase del domingo?</summary>
        <ol>
          <li>Cualquiera propone un curso cuando quiera; queda en el pizarrón.</li>
          <li>De <strong>lunes a jueves</strong> cada quien tiene <strong>3 votos</strong> y los reparte (uno por curso). No se vale votar por el propio.</li>
          <li>El <strong>viernes</strong> gana el que tenga más puntos y queda para el domingo. El sábado es para preparar el material.</li>
          <li>Quien dio la clase pasada no puede ganar esta semana, para que todos tengan turno.</li>
          <li>Empate: gana quien lleva más tiempo sin dar clase.</li>
          <li>Las propuestas con 3 semanas o más en el pizarrón ganan ⭐ +1 punto de antigüedad.</li>
          <li>Mamá, Papá (y los admins) pueden mover o cancelar un domingo si hay fiesta o alguien se enferma.</li>
        </ol>
      </details>
    </div>
  )
}

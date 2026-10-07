import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mensajeError } from '../lib/util'
import { Avatar, Aviso, Cargando, Texto } from '../components/ui'
import { etiquetaEstado } from './Cursos'

export default function Curso() {
  const { id } = useParams()
  const { yo } = useAuth()
  const navigate = useNavigate()
  const [curso, setCurso] = useState(undefined)
  const [lecciones, setLecciones] = useState([])
  const [domingo, setDomingo] = useState(null)
  const [alumnos, setAlumnos] = useState([])
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const [c, l, d, i] = await Promise.all([
      supabase.from('cursos').select('*').eq('id', id).maybeSingle(),
      supabase.from('lecciones').select('id, titulo, orden, video_url').eq('curso_id', id).order('orden'),
      supabase.from('domingos').select('fecha').eq('curso_id', id).maybeSingle(),
      supabase.from('inscripciones').select('usuario_id').eq('curso_id', id),
    ])
    setCurso(c.data)
    setLecciones(l.data || [])
    setDomingo(d.data?.fecha || null)
    setAlumnos((i.data || []).map((x) => x.usuario_id))
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  if (curso === undefined) return <Cargando />
  if (!curso) return <div className="vacio">Ese curso no existe (o lo borraron).</div>

  const puedeEditar = curso.autor_id === yo.id || yo.es_admin
  const inscrito = alumnos.includes(yo.id)
  const et = etiquetaEstado(curso, domingo)

  async function inscribir() {
    setError('')
    const { error } = inscrito
      ? await supabase.from('inscripciones').delete().eq('curso_id', id).eq('usuario_id', yo.id)
      : await supabase.from('inscripciones').insert({ curso_id: id, usuario_id: yo.id })
    if (error) setError(mensajeError(error))
    cargar()
  }

  async function nuevaLeccion() {
    const orden = (lecciones.at(-1)?.orden || 0) + 1
    const { data, error } = await supabase.from('lecciones')
      .insert({ curso_id: id, titulo: `Lección ${orden}`, orden }).select().single()
    if (error) return setError(mensajeError(error))
    navigate(`/lecciones/${data.id}?editar=1`)
  }

  async function mover(idx, dir) {
    const a = lecciones[idx], b = lecciones[idx + dir]
    if (!b) return
    await Promise.all([
      supabase.from('lecciones').update({ orden: b.orden }).eq('id', a.id),
      supabase.from('lecciones').update({ orden: a.orden }).eq('id', b.id),
    ])
    cargar()
  }

  async function borrar() {
    if (!confirm(`¿Borrar el curso "${curso.titulo}" con todas sus lecciones? No se puede deshacer.`)) return
    const { error } = await supabase.from('cursos').delete().eq('id', id)
    if (error) return setError(mensajeError(error))
    navigate('/cursos')
  }

  return (
    <div className="curso">
      <Link to="/cursos" className="migas">← Cursos</Link>
      <header className="curso-encabezado">
        <div className="curso-emoji">{curso.emoji}</div>
        <div className="curso-info">
          <span className={`estado estado-${et.clase}`}>{et.texto}</span>
          <h1>{curso.titulo}</h1>
          <p className="curso-profe">Imparte <Avatar id={curso.autor_id} tam={28} conNombre /></p>
        </div>
        <div className="acciones">
          <button className={`btn ${inscrito ? 'secundario' : ''}`} onClick={inscribir}>
            {inscrito ? '✔ Inscrito' : 'Inscribirme'}
          </button>
          {puedeEditar && <Link to={`/cursos/${id}/editar`} className="btn secundario">Editar</Link>}
          {puedeEditar && (curso.estado === 'propuesta' || yo.es_admin) && (
            <button className="btn peligro" onClick={borrar}>Borrar</button>
          )}
        </div>
      </header>

      <Aviso>{error}</Aviso>

      <div className="curso-columnas">
        <section className="tarjeta">
          <h2>De qué trata</h2>
          {curso.descripcion ? <Texto>{curso.descripcion}</Texto> : <p className="sub">Sin descripción todavía.</p>}
        </section>

        <section className="tarjeta">
          <div className="seccion-titulo compacto">
            <h2>Lecciones</h2>
            {puedeEditar && <button className="btn chico" onClick={nuevaLeccion}>+ Lección</button>}
          </div>
          {lecciones.length === 0 ? (
            <p className="sub">
              {puedeEditar ? 'Agrega la primera lección: un video, apuntes y material de apoyo.' : 'El profe todavía no sube lecciones.'}
            </p>
          ) : (
            <ol className="lista-lecciones">
              {lecciones.map((l, i) => (
                <li key={l.id}>
                  <Link to={`/lecciones/${l.id}`}>
                    <span className="num">{i + 1}</span>
                    <span className="titulo">{l.titulo}</span>
                    {l.video_url && <span title="Tiene video">🎬</span>}
                  </Link>
                  {puedeEditar && (
                    <span className="mover">
                      <button className="btn-texto" disabled={i === 0} onClick={() => mover(i, -1)} title="Subir">↑</button>
                      <button className="btn-texto" disabled={i === lecciones.length - 1} onClick={() => mover(i, 1)} title="Bajar">↓</button>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="tarjeta">
          <h2>Inscritos ({alumnos.length})</h2>
          {alumnos.length === 0 ? (
            <p className="sub">Nadie todavía. ¡Sé la primera persona!</p>
          ) : (
            <div className="fila-avatares">
              {alumnos.map((a) => <Avatar key={a} id={a} tam={36} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

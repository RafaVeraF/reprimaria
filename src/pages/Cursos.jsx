import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fmtFecha, hoyLocal } from '../lib/util'
import { Avatar, Cargando } from '../components/ui'

export function etiquetaEstado(curso, fechaDomingo) {
  if (curso.estado === 'propuesta') return { texto: 'En el pizarrón', clase: 'propuesta' }
  if (!fechaDomingo) return { texto: 'Programado', clase: 'programado' }
  if (fechaDomingo >= hoyLocal()) return { texto: `Domingo ${fmtFecha(fechaDomingo, { day: 'numeric', month: 'short' })}`, clase: 'programado' }
  return { texto: `Impartido · ${fmtFecha(fechaDomingo, { day: 'numeric', month: 'short', year: 'numeric' })}`, clase: 'impartido' }
}

export default function Cursos() {
  const { yo } = useAuth()
  const [cursos, setCursos] = useState(null)
  const [domingos, setDomingos] = useState({})
  const [inscritos, setInscritos] = useState(new Set())
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('cursos').select('*').order('created_at', { ascending: false }),
      supabase.from('domingos').select('fecha, curso_id'),
      supabase.from('inscripciones').select('curso_id').eq('usuario_id', yo.id),
    ]).then(([c, d, i]) => {
      setCursos(c.data || [])
      setDomingos(Object.fromEntries((d.data || []).map((x) => [x.curso_id, x.fecha])))
      setInscritos(new Set((i.data || []).map((x) => x.curso_id)))
    })
  }, [yo.id])

  if (!cursos) return <Cargando />

  const q = busca.trim().toLowerCase()
  const lista = cursos.filter((c) => {
    if (filtro === 'inscrito' && !inscritos.has(c.id)) return false
    if (filtro === 'mios' && c.autor_id !== yo.id) return false
    if (filtro === 'impartidos' && !(domingos[c.id] && domingos[c.id] < hoyLocal())) return false
    if (q && !`${c.titulo} ${c.descripcion}`.toLowerCase().includes(q)) return false
    return true
  })

  return (
    <div>
      <div className="seccion-titulo">
        <div>
          <h1>Cursos</h1>
          <p className="sub">Todo lo que la familia ha enseñado (y quiere enseñar).</p>
        </div>
        <Link to="/cursos/nuevo" className="btn">+ Proponer curso</Link>
      </div>

      <div className="filtros">
        {[
          ['todos', 'Todos'],
          ['inscrito', 'Mis inscripciones'],
          ['mios', 'Los que yo doy'],
          ['impartidos', 'Ya impartidos'],
        ].map(([k, t]) => (
          <button key={k} className={`chip ${filtro === k ? 'activo' : ''}`} onClick={() => setFiltro(k)}>{t}</button>
        ))}
        <input className="buscador" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {lista.length === 0 ? (
        <div className="vacio">No hay cursos aquí todavía.</div>
      ) : (
        <div className="rejilla-cursos">
          {lista.map((c) => {
            const et = etiquetaEstado(c, domingos[c.id])
            return (
              <Link key={c.id} to={`/cursos/${c.id}`} className="tarjeta-curso">
                <div className="tc-portada">{c.emoji}</div>
                <div className="tc-cuerpo">
                  <span className={`estado estado-${et.clase}`}>{et.texto}</span>
                  <h3>{c.titulo}</h3>
                  <Avatar id={c.autor_id} tam={24} conNombre />
                  {inscritos.has(c.id) && <span className="inscrito">✔ Inscrito</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

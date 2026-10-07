import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { EMOJIS_CURSO, mensajeError } from '../lib/util'
import { Aviso, Cargando, SelectorEmoji } from '../components/ui'

export default function CursoEditar() {
  const { id } = useParams()
  const nuevo = !id
  const { yo } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(nuevo ? { titulo: '', descripcion: '', emoji: '📚' } : null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (nuevo) return
    supabase.from('cursos').select('*').eq('id', id).single().then(({ data }) => setForm(data))
  }, [id, nuevo])

  if (!form) return <Cargando />
  if (!nuevo && form.autor_id !== yo.id && !yo.es_admin) {
    return <div className="vacio">Solo quien da el curso puede editarlo.</div>
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target ? e.target.value : e })

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true); setError('')
    const datos = { titulo: form.titulo.trim(), descripcion: form.descripcion, emoji: form.emoji }
    const res = nuevo
      ? await supabase.from('cursos').insert({ ...datos, autor_id: yo.id }).select().single()
      : await supabase.from('cursos').update(datos).eq('id', id).select().single()
    setGuardando(false)
    if (res.error) return setError(mensajeError(res.error))
    navigate(`/cursos/${res.data.id}`)
  }

  return (
    <div className="angosto">
      <Link to={nuevo ? '/' : `/cursos/${id}`} className="migas">← Regresar</Link>
      <form className="tarjeta" onSubmit={guardar}>
        <h1>{nuevo ? 'Proponer un curso' : 'Editar curso'}</h1>
        {nuevo && (
          <p className="sub">
            Tu propuesta aparecerá en el pizarrón para que la familia vote. Puedes ir subiendo lecciones desde ya
            o esperar a que gane.
          </p>
        )}
        <label>
          Título
          <input required maxLength={80} value={form.titulo} onChange={set('titulo')} placeholder="Ej. Banderas del mundo" />
        </label>
        <label>Portada</label>
        <SelectorEmoji opciones={EMOJIS_CURSO} valor={form.emoji} onChange={set('emoji')} />
        <label>
          ¿De qué trata?
          <textarea rows={6} value={form.descripcion} onChange={set('descripcion')}
            placeholder="Qué vamos a aprender, qué se necesita, por qué es interesante…" />
        </label>
        <p className="ayuda">Tip: puedes usar **negritas**, *cursiva*, listas con "- " y pegar links.</p>
        <Aviso>{error}</Aviso>
        <button className="btn grande" disabled={guardando}>
          {guardando ? 'Guardando…' : nuevo ? 'Poner en el pizarrón' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}

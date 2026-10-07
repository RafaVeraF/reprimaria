import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BUCKET, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { REACCIONES, haceCuanto, mensajeError, nombreSeguro, tamano, videoEmbed } from '../lib/util'
import { Avatar, Aviso, Cargando, Texto } from '../components/ui'

export default function Leccion() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { yo } = useAuth()
  const navigate = useNavigate()

  const [leccion, setLeccion] = useState(undefined)
  const [curso, setCurso] = useState(null)
  const [hermanas, setHermanas] = useState([])
  const [materiales, setMateriales] = useState([])
  const [urls, setUrls] = useState({})
  const [error, setError] = useState('')

  const cargarMateriales = useCallback(async () => {
    const { data } = await supabase.from('materiales').select('*').eq('leccion_id', id).order('created_at')
    const lista = data || []
    setMateriales(lista)
    const rutas = lista.filter((m) => m.storage_path).map((m) => m.storage_path)
    if (rutas.length) {
      const { data: firmadas } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, 60 * 60 * 6)
      setUrls(Object.fromEntries((firmadas || []).map((f) => [f.path, f.signedUrl])))
    }
  }, [id])

  const cargar = useCallback(async () => {
    setError('')
    const { data: l } = await supabase.from('lecciones').select('*').eq('id', id).maybeSingle()
    setLeccion(l)
    if (!l) return
    const [c, h] = await Promise.all([
      supabase.from('cursos').select('*').eq('id', l.curso_id).single(),
      supabase.from('lecciones').select('id, titulo, orden').eq('curso_id', l.curso_id).order('orden'),
    ])
    setCurso(c.data)
    setHermanas(h.data || [])
    cargarMateriales()
  }, [id, cargarMateriales])

  useEffect(() => { cargar() }, [cargar])

  if (leccion === undefined || (leccion && !curso)) return <Cargando />
  if (!leccion) return <div className="vacio">Esa lección no existe.</div>

  const esProfe = curso.autor_id === yo.id || yo.es_admin
  const editando = esProfe && params.get('editar') === '1'
  const idx = hermanas.findIndex((h) => h.id === id)
  const anterior = hermanas[idx - 1]
  const siguiente = hermanas[idx + 1]

  return (
    <div className="leccion">
      <div className="migas">
        <Link to={`/cursos/${curso.id}`}>{curso.emoji} {curso.titulo}</Link>
        <span> · Lección {idx + 1} de {hermanas.length}</span>
      </div>

      <Aviso>{error}</Aviso>

      <div className="leccion-columnas">
        <div className="leccion-principal">
          {editando ? (
            <EditorLeccion
              leccion={leccion}
              curso={curso}
              materiales={materiales}
              onCambio={cargarMateriales}
              onListo={async () => { await cargar(); setParams({}) }}
              onBorrada={() => navigate(`/cursos/${curso.id}`)}
              setError={setError}
            />
          ) : (
            <>
              <div className="leccion-cabeza">
                <h1>{leccion.titulo}</h1>
                {esProfe && (
                  <button className="btn secundario chico" onClick={() => setParams({ editar: '1' })}>✏️ Editar lección</button>
                )}
              </div>
              <Video url={leccion.video_url} />
              {leccion.contenido && <section className="tarjeta"><Texto>{leccion.contenido}</Texto></section>}
              {materiales.length > 0 && (
                <section className="tarjeta">
                  <h2>Material de apoyo</h2>
                  <ul className="materiales">
                    {materiales.map((m) => (
                      <li key={m.id}>
                        <a href={m.storage_path ? urls[m.storage_path] : m.url} target="_blank" rel="noreferrer">
                          {m.storage_path ? '📎' : '🔗'} {m.nombre}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          <Reacciones leccionId={id} />

          <div className="navegacion-lecciones">
            {anterior ? <Link className="btn secundario" to={`/lecciones/${anterior.id}`}>← {anterior.titulo}</Link> : <span />}
            {siguiente ? <Link className="btn" to={`/lecciones/${siguiente.id}`}>{siguiente.titulo} →</Link> : <span />}
          </div>

          <Comentarios leccionId={id} />
        </div>

        <aside className="leccion-lateral">
          <Apuntes leccionId={id} />
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
function Video({ url }) {
  const v = videoEmbed(url)
  const [src, setSrc] = useState(null)
  const path = v?.tipo === 'archivo' ? v.path : null

  useEffect(() => {
    if (!path) return
    supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6)
      .then(({ data }) => setSrc(data?.signedUrl || null))
  }, [path])

  if (!v) return null
  if (v.tipo === 'iframe') {
    return (
      <div className="video">
        <iframe src={v.src} title="Video de la lección" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    )
  }
  if (v.tipo === 'video' || v.tipo === 'archivo') {
    const s = v.tipo === 'video' ? v.src : src
    return s ? <div className="video"><video src={s} controls preload="metadata" /></div> : <Cargando texto="Cargando video…" />
  }
  return <p><a className="btn secundario" href={v.src} target="_blank" rel="noreferrer">🎬 Ver video</a></p>
}

// ---------------------------------------------------------------------
function EditorLeccion({ leccion, curso, materiales, onCambio, onListo, onBorrada, setError }) {
  const [form, setForm] = useState({
    titulo: leccion.titulo,
    video_url: leccion.video_url || '',
    contenido: leccion.contenido || '',
  })
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState('')
  const [link, setLink] = useState({ nombre: '', url: '' })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const carpeta = `${curso.id}/${leccion.id}`

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true); setError('')
    const { error } = await supabase.from('lecciones').update({
      titulo: form.titulo.trim() || 'Sin título',
      video_url: form.video_url.trim() || null,
      contenido: form.contenido,
    }).eq('id', leccion.id)
    setGuardando(false)
    if (error) return setError(mensajeError(error))
    onListo()
  }

  async function subir(archivo, prefijo = '') {
    const ruta = `${carpeta}/${Date.now()}-${prefijo}${nombreSeguro(archivo.name)}`
    const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, { contentType: archivo.type || undefined })
    if (error) throw error
    return ruta
  }

  async function subirVideo(e) {
    const archivo = e.target.files[0]
    e.target.value = ''
    if (!archivo) return
    setError(''); setSubiendo(`Subiendo video (${tamano(archivo.size)})…`)
    try {
      const ruta = await subir(archivo, 'video-')
      setForm((f) => ({ ...f, video_url: `storage:${ruta}` }))
    } catch (err) { setError(mensajeError(err)) }
    setSubiendo('')
  }

  async function subirMateriales(e) {
    const archivos = [...e.target.files]
    e.target.value = ''
    setError('')
    for (const archivo of archivos) {
      setSubiendo(`Subiendo ${archivo.name} (${tamano(archivo.size)})…`)
      try {
        const ruta = await subir(archivo)
        const { error } = await supabase.from('materiales').insert({ leccion_id: leccion.id, nombre: archivo.name, storage_path: ruta })
        if (error) throw error
      } catch (err) { setError(mensajeError(err)) }
    }
    setSubiendo('')
    onCambio()
  }

  async function agregarLink(e) {
    e.preventDefault()
    if (!link.url.trim()) return
    const { error } = await supabase.from('materiales').insert({
      leccion_id: leccion.id,
      nombre: link.nombre.trim() || link.url.trim(),
      url: link.url.trim(),
    })
    if (error) return setError(mensajeError(error))
    setLink({ nombre: '', url: '' })
    onCambio()
  }

  async function quitarMaterial(m) {
    if (!confirm(`¿Quitar "${m.nombre}"?`)) return
    if (m.storage_path) await supabase.storage.from(BUCKET).remove([m.storage_path])
    await supabase.from('materiales').delete().eq('id', m.id)
    onCambio()
  }

  async function borrarLeccion() {
    if (!confirm('¿Borrar esta lección con sus comentarios y materiales?')) return
    const rutas = materiales.filter((m) => m.storage_path).map((m) => m.storage_path)
    if (leccion.video_url?.startsWith('storage:')) rutas.push(leccion.video_url.slice(8))
    if (rutas.length) await supabase.storage.from(BUCKET).remove(rutas)
    const { error } = await supabase.from('lecciones').delete().eq('id', leccion.id)
    if (error) return setError(mensajeError(error))
    onBorrada()
  }

  return (
    <div className="editor">
      <form className="tarjeta" onSubmit={guardar}>
        <h2>Editar lección</h2>
        <label>
          Título
          <input required value={form.titulo} onChange={set('titulo')} />
        </label>

        <label>
          Video
          <input value={form.video_url} onChange={set('video_url')} placeholder="Link de YouTube, Vimeo o Google Drive" />
        </label>
        <p className="ayuda">
          Recomendado: sube el video a YouTube como <strong>No listado</strong> y pega aquí el link.
          Para videos cortos (menos de 50 MB) también puedes{' '}
          <label className="enlace-archivo">
            subirlo directo
            <input type="file" accept="video/*" hidden onChange={subirVideo} />
          </label>.
        </p>
        <Video url={form.video_url} />

        <label>
          Contenido / explicación
          <textarea rows={10} value={form.contenido} onChange={set('contenido')}
            placeholder={'# Título\nTexto de la clase…\n- punto uno\n- punto dos\n\n**Importante:** …'} />
        </label>
        <p className="ayuda">Formato: # títulos, **negritas**, *cursiva*, listas con "- ", links pegados.</p>

        <div className="acciones">
          <button className="btn" disabled={guardando || !!subiendo}>{guardando ? 'Guardando…' : 'Guardar lección'}</button>
          <button type="button" className="btn secundario" onClick={onListo}>Cancelar</button>
          <button type="button" className="btn peligro" onClick={borrarLeccion}>Borrar lección</button>
        </div>
      </form>

      <section className="tarjeta">
        <h2>Material de apoyo</h2>
        {materiales.length > 0 && (
          <ul className="materiales">
            {materiales.map((m) => (
              <li key={m.id}>
                <span>{m.storage_path ? '📎' : '🔗'} {m.nombre}</span>
                <button className="btn-texto peligro" onClick={() => quitarMaterial(m)}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
        <label className="btn secundario subir">
          📎 Subir archivos (PDF, imágenes, presentaciones…)
          <input type="file" multiple hidden onChange={subirMateriales} />
        </label>
        {subiendo && <Cargando texto={subiendo} />}
        <form className="fila-form" onSubmit={agregarLink}>
          <input placeholder="Nombre (opcional)" value={link.nombre} onChange={(e) => setLink({ ...link, nombre: e.target.value })} />
          <input placeholder="https://…" type="url" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
          <button className="btn chico">+ Link</button>
        </form>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------
function Reacciones({ leccionId }) {
  const { yo, miembros } = useAuth()
  const [lista, setLista] = useState([])

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('reacciones').select('*').eq('leccion_id', leccionId)
    setLista(data || [])
  }, [leccionId])
  useEffect(() => { cargar() }, [cargar])

  async function alternar(emoji) {
    const mia = lista.some((r) => r.emoji === emoji && r.usuario_id === yo.id)
    if (mia) await supabase.from('reacciones').delete().eq('leccion_id', leccionId).eq('usuario_id', yo.id).eq('emoji', emoji)
    else await supabase.from('reacciones').insert({ leccion_id: leccionId, usuario_id: yo.id, emoji })
    cargar()
  }

  return (
    <div className="reacciones">
      {REACCIONES.map((e) => {
        const quienes = lista.filter((r) => r.emoji === e)
        const mia = quienes.some((r) => r.usuario_id === yo.id)
        return (
          <button
            key={e}
            className={`reaccion ${mia ? 'activa' : ''}`}
            title={quienes.map((r) => miembros[r.usuario_id]?.nombre).join(', ') || 'Reaccionar'}
            onClick={() => alternar(e)}
          >
            {e} {quienes.length > 0 && <span>{quienes.length}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------
function Comentarios({ leccionId }) {
  const { yo } = useAuth()
  const [lista, setLista] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('comentarios').select('*').eq('leccion_id', leccionId).order('created_at')
    setLista(data || [])
  }, [leccionId])
  useEffect(() => { cargar() }, [cargar])

  async function enviar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    setEnviando(true)
    const { error } = await supabase.from('comentarios').insert({ leccion_id: leccionId, usuario_id: yo.id, contenido: texto.trim() })
    setEnviando(false)
    if (!error) { setTexto(''); cargar() }
  }

  async function borrar(c) {
    if (!confirm('¿Borrar este comentario?')) return
    await supabase.from('comentarios').delete().eq('id', c.id)
    cargar()
  }

  return (
    <section className="tarjeta comentarios">
      <h2>Comentarios ({lista.length})</h2>
      {lista.map((c) => (
        <div key={c.id} className="comentario">
          <Avatar id={c.usuario_id} tam={34} />
          <div className="comentario-cuerpo">
            <div className="comentario-cabeza">
              <strong><Nombre id={c.usuario_id} /></strong>
              <span className="sub">{haceCuanto(c.created_at)}</span>
              {(c.usuario_id === yo.id || yo.es_admin) && (
                <button className="btn-texto peligro" onClick={() => borrar(c)}>borrar</button>
              )}
            </div>
            <Texto>{c.contenido}</Texto>
          </div>
        </div>
      ))}
      <form className="comentar" onSubmit={enviar}>
        <Avatar perfil={yo} tam={34} />
        <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pregunta, comenta, echa porras…" />
        <button className="btn" disabled={enviando || !texto.trim()}>Enviar</button>
      </form>
    </section>
  )
}

function Nombre({ id }) {
  const { miembros } = useAuth()
  return miembros[id]?.nombre || '¿?'
}

// ---------------------------------------------------------------------
function Apuntes({ leccionId }) {
  const { yo } = useAuth()
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('cargando') // cargando | listo | guardando | guardado | error
  const temporizador = useRef(null)

  useEffect(() => {
    setEstado('cargando')
    supabase.from('apuntes').select('contenido').eq('leccion_id', leccionId).eq('usuario_id', yo.id).maybeSingle()
      .then(({ data }) => { setTexto(data?.contenido || ''); setEstado('listo') })
    return () => clearTimeout(temporizador.current)
  }, [leccionId, yo.id])

  function cambiar(e) {
    const valor = e.target.value
    setTexto(valor)
    setEstado('guardando')
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(async () => {
      const { error } = await supabase.from('apuntes')
        .upsert({ leccion_id: leccionId, usuario_id: yo.id, contenido: valor }, { onConflict: 'leccion_id,usuario_id' })
      setEstado(error ? 'error' : 'guardado')
    }, 900)
  }

  return (
    <div className="cuaderno">
      <div className="cuaderno-cabeza">
        <h3>📓 Mis apuntes</h3>
        <span className="sub">
          {estado === 'guardando' ? 'Guardando…' : estado === 'guardado' ? '✔ Guardado' : estado === 'error' ? '⚠ No se guardó' : 'Solo tú los ves'}
        </span>
      </div>
      <textarea
        className="cuaderno-hoja"
        value={texto}
        onChange={cambiar}
        disabled={estado === 'cargando'}
        placeholder="Escribe aquí lo que quieras recordar…"
      />
    </div>
  )
}

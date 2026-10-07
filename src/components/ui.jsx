import { Fragment } from 'react'
import { useAuth } from '../lib/auth'

export function Avatar({ id, perfil, tam = 32, conNombre = false }) {
  const { miembros } = useAuth()
  const p = perfil || miembros[id] || { nombre: '¿?', emoji: '👤', color: '#999' }
  const circulo = (
    <span
      className="avatar"
      title={p.nombre}
      style={{ width: tam, height: tam, fontSize: tam * 0.55, background: p.color }}
    >
      {p.emoji}
    </span>
  )
  if (!conNombre) return circulo
  return (
    <span className="avatar-nombre">
      {circulo}
      <span>{p.nombre}</span>
    </span>
  )
}

export function Cargando({ texto = 'Cargando…' }) {
  return <div className="cargando"><span className="gis" /> {texto}</div>
}

export function Aviso({ tipo = 'error', children }) {
  if (!children) return null
  return <div className={`aviso aviso-${tipo}`}>{children}</div>
}

// ---------- Texto con formato sencillo (estilo Markdown) ----------
// **negritas**, *cursiva*, `código`, [texto](https://link), links sueltos,
// # títulos, listas con "- " o "1. ". No interpreta HTML (seguro).
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s<>()]*[^\s<>().,;:!?¿¡'\"])/g

function enLinea(texto) {
  return texto.split(INLINE).map((p, i) => {
    if (!p) return null
    if (i % 2 === 0) return <Fragment key={i}>{p}</Fragment>
    if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    if (p.startsWith('[')) {
      const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      return <a key={i} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>
    }
    if (p.startsWith('http')) return <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a>
    if (p.startsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>
    return <Fragment key={i}>{p}</Fragment>
  })
}

export function Texto({ children, className = '' }) {
  const lineas = (children || '').replace(/\r/g, '').split('\n')
  const bloques = []
  let parrafo = []
  let lista = null

  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ t: 'p', lineas: parrafo })
    parrafo = []
  }
  const cerrarLista = () => {
    if (lista) bloques.push(lista)
    lista = null
  }

  for (const linea of lineas) {
    const ul = linea.match(/^\s*[-*•]\s+(.*)$/)
    const ol = linea.match(/^\s*\d+[.)]\s+(.*)$/)
    const h = linea.match(/^(#{1,3})\s+(.*)$/)
    if (ul || ol) {
      cerrarParrafo()
      const t = ul ? 'ul' : 'ol'
      if (!lista || lista.t !== t) { cerrarLista(); lista = { t, items: [] } }
      lista.items.push((ul || ol)[1])
    } else if (h) {
      cerrarParrafo(); cerrarLista()
      bloques.push({ t: 'h', nivel: h[1].length, texto: h[2] })
    } else if (!linea.trim()) {
      cerrarParrafo(); cerrarLista()
    } else {
      cerrarLista()
      parrafo.push(linea)
    }
  }
  cerrarParrafo(); cerrarLista()

  return (
    <div className={`texto ${className}`}>
      {bloques.map((b, i) => {
        if (b.t === 'h') {
          const H = b.nivel === 1 ? 'h2' : b.nivel === 2 ? 'h3' : 'h4'
          return <H key={i}>{enLinea(b.texto)}</H>
        }
        if (b.t === 'ul' || b.t === 'ol') {
          const L = b.t
          return <L key={i}>{b.items.map((it, j) => <li key={j}>{enLinea(it)}</li>)}</L>
        }
        return (
          <p key={i}>
            {b.lineas.map((l, j) => (
              <Fragment key={j}>{j > 0 && <br />}{enLinea(l)}</Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

export function SelectorEmoji({ opciones, valor, onChange }) {
  return (
    <div className="selector-emoji">
      {opciones.map((e) => (
        <button
          type="button"
          key={e}
          className={e === valor ? 'activo' : ''}
          onClick={() => onChange(e)}
        >
          {e}
        </button>
      ))}
    </div>
  )
}

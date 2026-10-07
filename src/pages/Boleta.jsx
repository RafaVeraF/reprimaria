import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fmtFecha, fmtFechaCorta, hoyLocal } from '../lib/util'
import { Avatar, Cargando } from '../components/ui'

export default function Boleta() {
  const { miembros } = useAuth()
  const [domingos, setDomingos] = useState(null)

  useEffect(() => {
    supabase.from('domingos').select('fecha, nota, curso:cursos(id, titulo, emoji, autor_id)')
      .order('fecha', { ascending: false })
      .then(({ data }) => setDomingos(data || []))
  }, [])

  if (!domingos) return <Cargando />

  const hoy = hoyLocal()
  const proximos = domingos.filter((d) => d.fecha >= hoy).reverse()
  const pasados = domingos.filter((d) => d.fecha < hoy)

  const conteo = {}
  for (const d of pasados) conteo[d.curso.autor_id] = (conteo[d.curso.autor_id] || 0) + 1
  const ranking = Object.keys(miembros)
    .map((id) => ({ id, clases: conteo[id] || 0 }))
    .sort((a, b) => b.clases - a.clases || miembros[a.id].nombre.localeCompare(miembros[b.id].nombre))

  return (
    <div className="boleta">
      <div className="seccion-titulo">
        <div>
          <h1>Boleta de la Reprimaria</h1>
          <p className="sub">{pasados.length} {pasados.length === 1 ? 'clase impartida' : 'clases impartidas'} desde que empezamos.</p>
        </div>
      </div>

      {proximos.length > 0 && (
        <section className="tarjeta">
          <h2>Próximamente</h2>
          <ul className="lista-simple">
            {proximos.map((d) => (
              <li key={d.fecha}>
                <span className="fecha">{fmtFecha(d.fecha)}</span>
                <Link to={`/cursos/${d.curso.id}`}>{d.curso.emoji} {d.curso.titulo}</Link>
                <Avatar id={d.curso.autor_id} tam={24} conNombre />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="boleta-columnas">
        <section className="tarjeta hoja-boleta">
          <h2>Historial de clases</h2>
          {pasados.length === 0 ? (
            <p className="sub">Aún no hay clases registradas. Los admins pueden capturar las de la pandemia en Dirección.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Fecha</th><th>Materia</th><th>Profe</th><th>Calif.</th></tr>
              </thead>
              <tbody>
                {pasados.map((d) => (
                  <tr key={d.fecha}>
                    <td className="fecha">{fmtFechaCorta(d.fecha)}</td>
                    <td><Link to={`/cursos/${d.curso.id}`}>{d.curso.emoji} {d.curso.titulo}</Link></td>
                    <td><Avatar id={d.curso.autor_id} tam={22} conNombre /></td>
                    <td className="calif">10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="tarjeta">
          <h2>Cuadro de honor</h2>
          <ol className="ranking">
            {ranking.map((r) => (
              <li key={r.id}>
                <Avatar id={r.id} tam={28} conNombre />
                <span className="clases">{r.clases} {r.clases === 1 ? 'clase' : 'clases'}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

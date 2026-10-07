import { NavLink, Link, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Avatar } from './ui'

export default function Layout() {
  const { yo, salir } = useAuth()
  return (
    <div className="app">
      <header className="pizarron-barra">
        <div className="barra-interior">
          <Link to="/" className="logo">
            <span className="logo-r">R</span>
            <span className="logo-texto">eprimaria</span>
          </Link>
          <nav className="nav">
            <NavLink to="/" end>Domingo</NavLink>
            <NavLink to="/cursos">Cursos</NavLink>
            <NavLink to="/boleta">Boleta</NavLink>
            {yo?.es_admin && <NavLink to="/admin">Dirección</NavLink>}
          </nav>
          <div className="barra-usuario">
            <Link to="/perfil" className="yo" title="Mi perfil">
              <Avatar perfil={yo} tam={34} />
              <span className="yo-nombre">{yo?.nombre}</span>
            </Link>
            <button className="btn-texto claro" onClick={salir}>Salir</button>
          </div>
        </div>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
      <footer className="pie">
        Reprimaria · desde la pandemia, aprendiendo en familia los domingos ✏️
      </footer>
    </div>
  )
}

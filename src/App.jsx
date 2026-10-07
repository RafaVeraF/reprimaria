import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { configurado } from './lib/supabase'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import { Cargando } from './components/ui'
import Login from './pages/Login'
import Restablecer from './pages/Restablecer'
import Inicio from './pages/Inicio'
import Cursos from './pages/Cursos'
import Curso from './pages/Curso'
import CursoEditar from './pages/CursoEditar'
import Leccion from './pages/Leccion'
import Boleta from './pages/Boleta'
import Perfil from './pages/Perfil'
import Admin from './pages/Admin'

export default function App() {
  if (!configurado) return <SinConfigurar />
  return (
    <AuthProvider>
      <Rutas />
    </AuthProvider>
  )
}

function Rutas() {
  const { session, cargando, yo, recuperando, salir } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (recuperando) navigate('/restablecer')
  }, [recuperando, navigate])

  if (cargando) return <div className="pantalla-centro"><Cargando /></div>

  return (
    <Routes>
      <Route path="/restablecer" element={<Restablecer />} />
      {!session ? (
        <Route path="*" element={<Login />} />
      ) : !yo ? (
        <Route
          path="*"
          element={
            <div className="pantalla-centro">
              <div className="tarjeta angosta">
                <h2>Tu cuenta no tiene perfil</h2>
                <p>Pídele a un admin que revise que tu correo esté en la lista de invitados.</p>
                <button className="btn" onClick={salir}>Salir</button>
              </div>
            </div>
          }
        />
      ) : (
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="cursos" element={<Cursos />} />
          <Route path="cursos/nuevo" element={<CursoEditar />} />
          <Route path="cursos/:id" element={<Curso />} />
          <Route path="cursos/:id/editar" element={<CursoEditar />} />
          <Route path="lecciones/:id" element={<Leccion />} />
          <Route path="boleta" element={<Boleta />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  )
}

function SinConfigurar() {
  return (
    <div className="pantalla-centro">
      <div className="tarjeta angosta">
        <h2>Falta conectar Supabase</h2>
        <p>
          Crea un archivo <code>.env</code> (copia <code>.env.example</code>) con
          <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>. En Render, ponlas
          en <em>Environment</em> y vuelve a publicar.
        </p>
      </div>
    </div>
  )
}

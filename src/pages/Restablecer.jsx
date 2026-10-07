import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { mensajeError } from '../lib/util'
import { Aviso } from '../components/ui'

export default function Restablecer() {
  const { session, setRecuperando } = useAuth()
  const navigate = useNavigate()
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setEnviando(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: pass })
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    setRecuperando(false)
    navigate('/')
  }

  return (
    <div className="pantalla-centro">
      <form className="tarjeta angosta" onSubmit={guardar}>
        <h2>Nueva contraseña</h2>
        {!session ? (
          <p>Abre el enlace que te llegó por correo para poder cambiar tu contraseña.</p>
        ) : (
          <>
            <label>
              Escribe tu nueva contraseña
              <input type="password" minLength={6} required autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
            </label>
            <Aviso>{error}</Aviso>
            <button className="btn" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
          </>
        )}
      </form>
    </div>
  )
}

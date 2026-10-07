import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { mensajeError } from '../lib/util'
import { Aviso } from '../components/ui'

export default function Login() {
  const [modo, setModo] = useState('entrar') // entrar | registro | olvide
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError(''); setOk(''); setEnviando(true)
    try {
      const correo = email.trim().toLowerCase()
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: correo, password: pass })
        if (error) throw error
      } else if (modo === 'registro') {
        const { data, error } = await supabase.auth.signUp({
          email: correo,
          password: pass,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) setOk('¡Listo! Te mandamos un correo para confirmar tu cuenta. Ábrelo y luego entra aquí.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(correo, {
          redirectTo: `${window.location.origin}/restablecer`,
        })
        if (error) throw error
        setOk('Si tu correo está registrado, te llegará un enlace para poner una nueva contraseña.')
      }
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const cambiar = (m) => { setModo(m); setError(''); setOk('') }

  return (
    <div className="login">
      <div className="login-pizarron">
        <div className="tiza-titulo">Reprimaria</div>
        <p className="tiza-sub">La escuelita de los domingos</p>
        <div className="tiza-dibujos" aria-hidden>🚩 🎵 🏞️ ⚙️ 🌎</div>
      </div>

      <form className="tarjeta login-form" onSubmit={enviar}>
        <div className="pestanas">
          <button type="button" className={modo === 'entrar' ? 'activa' : ''} onClick={() => cambiar('entrar')}>Entrar</button>
          <button type="button" className={modo === 'registro' ? 'activa' : ''} onClick={() => cambiar('registro')}>Primera vez</button>
        </div>

        {modo === 'registro' && (
          <p className="ayuda">Usa el correo con el que te invitaron y elige una contraseña.</p>
        )}
        {modo === 'olvide' && (
          <p className="ayuda">Escribe tu correo y te mandamos un enlace para cambiar tu contraseña.</p>
        )}

        <label>
          Correo
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        {modo !== 'olvide' && (
          <label>
            Contraseña
            <input
              type="password"
              required
              minLength={6}
              autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </label>
        )}

        <Aviso>{error}</Aviso>
        <Aviso tipo="ok">{ok}</Aviso>

        <button className="btn grande" disabled={enviando}>
          {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar al salón' : modo === 'registro' ? 'Crear mi cuenta' : 'Enviar enlace'}
        </button>

        {modo === 'entrar' && (
          <button type="button" className="btn-texto" onClick={() => cambiar('olvide')}>Olvidé mi contraseña</button>
        )}
        {modo === 'olvide' && (
          <button type="button" className="btn-texto" onClick={() => cambiar('entrar')}>← Regresar</button>
        )}
      </form>
    </div>
  )
}

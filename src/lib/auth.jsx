import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [miembros, setMiembros] = useState({})
  const [miembrosListos, setMiembrosListos] = useState(false)
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s)
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const cargarMiembros = useCallback(async () => {
    const { data } = await supabase.from('perfiles').select('*').order('nombre')
    setMiembros(Object.fromEntries((data || []).map((p) => [p.id, p])))
    setMiembrosListos(true)
  }, [])

  const uid = session?.user?.id
  useEffect(() => {
    if (uid) cargarMiembros()
    else { setMiembros({}); setMiembrosListos(false) }
  }, [uid, cargarMiembros])

  const valor = {
    session,
    cargando: session === undefined || (session && !miembrosListos),
    yo: uid ? miembros[uid] : null,
    miembros,
    cargarMiembros,
    recuperando,
    setRecuperando,
    salir: () => supabase.auth.signOut(),
  }
  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)

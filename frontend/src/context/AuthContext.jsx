import { createContext, useContext, useState } from 'react'
import apiClient from '../api/client'

const AuthContext = createContext(null)

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

function buildUser(token) {
  if (!token) return null
  const claims = decodeJwt(token)
  return {
    token,
    username: claims.username || '',
    rol: claims.rol || 'admin',
    nombre: claims.nombre || claims.username || '',
    iniciales: claims.iniciales || '',
    activo: claims.activo !== false,
    persona_rrhh_id: claims.persona_rrhh_id || null,
    medicos_asignados: claims.medicos_asignados || [],
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('access_token')
    return buildUser(token)
  })

  const login = async (username, password) => {
    const { data } = await apiClient.post('/auth/token/', { username, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    setUser(buildUser(data.access))
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

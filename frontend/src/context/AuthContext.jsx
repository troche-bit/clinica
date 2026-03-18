import { createContext, useContext, useState } from "react"; // Importamos createContext, useContext y useState de React
import apiClient from "../api/client"; // Importamos nuestro cliente API personalizado

const AuthContext = createContext(null); // Creamos el contexto de autenticación

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => { // Estado para almacenar el usuario autenticado
    const token = localStorage.getItem("access_token") // Obtenemos el token de autenticación del almacenamiento local
    return token ? { token } : null // Si hay un token, lo devolvemos, de lo contrario devolvemos null
  })

  const login = async (username, password) => { // Función para manejar el inicio de sesión
    const { data } = await apiClient.post('/auth/token/', { username, password})  
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    setUser({ token: data.access})
  }

  const logout = () => { // Función para manejar el cierre de sesión
    localStorage.clear() // Limpiamos el almacenamiento local
    setUser(null) // Establecemos el usuario como null
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}> {/* Proveemos el contexto con el usuario, la función de login y logout */}
      {children} {/* Renderizamos los componentes hijos */}
    </AuthContext.Provider>
  )
}

export function useAuth() { // Hook personalizado para usar el contexto de autenticación
  return useContext(AuthContext) // Devolvemos el contexto de autenticación
}

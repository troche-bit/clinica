// frontend/src/api/axiosConfig.js
import axios from 'axios'
 
const api = axios.create({
  baseURL: '/api',   // el proxy de Vite redirige a localhost:8000
})
 
// INTERCEPTOR DE REQUEST
// Agrega el token en el header de CADA llamada automaticamente
api.interceptors.request.use(function(config) {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = 'Bearer ' + token
  }
  return config
})
 
// INTERCEPTOR DE RESPONSE
// Si el server responde 401 (token expirado), intenta renovarlo
api.interceptors.response.use(
  function(response) { return response },
  async function(error) {
    const original = error.config
 
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true  // evita loop infinito
 
      try {
        const refresh = localStorage.getItem('refreshToken')
        const res = await axios.post('/api/token/refresh/', { refresh })
 
        // Guardar el nuevo access token
        localStorage.setItem('authToken', res.data.access)
 
        // Reintentar la request original con el nuevo token
        original.headers.Authorization = 'Bearer ' + res.data.access
        return api(original)
 
      } catch (refreshError) {
        // El refresh tambien fallo: sesion terminada
        localStorage.removeItem('authToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error) 
  }
)
 
export default api


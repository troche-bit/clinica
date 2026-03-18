import { useState } from 'react' // Importamos el hook useState de React
import { useNavigate } from 'react-router-dom' // Importamos el hook useNavigate de react-router-dom para la navegación
import { useAuth } from '../context/AuthContext' // Importamos el hook useAuth para acceder al contexto de autenticación

export default function Login() {
  const { login } = useAuth() // Obtenemos la función login del contexto de autenticación
  const navigate = useNavigate() // Obtenemos la función navigate para la navegación
  const [error, setError] = useState('') //
  const [loading, setLoading] = useState(false) // Estado para controlar si se está cargando el proceso de inicio de sesión

  const handleSubmit = async (e) => {
    e.preventDefault() // Evitamos que el formulario se envíe de forma tradicional
    setError('') // Limpiamos cualquier error previo
    setLoading(true) // Indicamos que el proceso de inicio de sesión está en curso

    const username = e.target.username.value // Obtenemos el valor del campo de nombre de usuario
    const password = e.target.password.value // Obtenemos el valor del campo de contraseña

    try {
      await login(username, password) // Intentamos iniciar sesión con las credenciales proporcionadas
      navigate('/paciente') // Si el inicio de sesión es exitoso, navegamos a la página principal
    } catch { // Si ocurre un error durante el inicio de sesión, mostramos un mensaje de error
      setError('Error al iniciar sesión. Por favor, verifica tus credenciales.') // Establecemos el mensaje de error
    } finally {
      setLoading(false) // Indicamos que el proceso de inicio de sesión ha finalizado
    }
  }
  
  // Renderizamos el formulario de inicio de sesión
  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 24 }}> 
      <h2>Iniciar sesión</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Usuario</label>
          <input name="username" type="text" required />
        </div>
        <div>
          <label>Contraseña</label>
          <input name="password" type="password" required />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
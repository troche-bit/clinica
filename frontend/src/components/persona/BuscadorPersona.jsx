import { useState } from 'react' // Importamos el hook useState para manejar el estado del componente
import { Search, Loader2 } from 'lucide-react' // Importamos los iconos Search y Loader2 de lucide-react
import apiClient from '../../api/client' // Importamos el cliente API para hacer solicitudes al backend

export default function BuscadorPersona({ onResultado }) { // Definimos el componente BuscadorPersona que recibe una función onResultado como prop
    const [documento, setDocumento] = useState('') // Estado para almacenar el número de documento ingresado
    const [loading, setLoading] = useState(false) // Estado para indicar si se está cargando la información
    const [error, setError] = useState('') // Estado para almacenar cualquier error que ocurra durante la búsqueda

    const handleBuscar = async (e) => { // Función para manejar la búsqueda de la persona
        e.preventDefault() // Prevenimos el comportamiento por defecto del formulario
        console.log('Buscando documento:', documento)
        if (!documento.trim()) return // Si el campo de documento está vacío, no hacemos nada
        setError('') // Limpiamos cualquier error previo
        setLoading(true) // Indicamos que estamos cargando la información
        try {
            console.log('Haciendo petición...')
            const response = await apiClient.get(
                `/persona/buscar/?nro_documento=${documento.trim()}`
            ) // Hacemos una solicitud GET al backend para buscar la persona por número de documento
            console.log('Respuesta:', response.data)
            onResultado({
                documento,
                persona: response.data.persona,
                paciente:    response.data.paciente,
                es_paciente: response.data.es_paciente,

                modo: !response.data.persona ? 'crear_todo' : !response.data.es_paciente ? 'agregar_paciente' : 'editar',
            })
        } catch (err) {
            console.log('Error:', err.response?.data)
            setError('Ocurrió un error al buscar la persona. Por favor, inténtalo de nuevo.') // Si ocurre un error, actualizamos el estado de error
        } finally {
            setLoading(false) // Finalmente, indicamos que hemos terminado de cargar la información
        }
    }
    
    return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="text-base font-semibold text-gray-700 mb-4">
        Buscar paciente por documento
      </h2>
      <form onSubmit={handleBuscar} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Ingresá el nro. de documento..."
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !documento.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
            rounded-lg text-sm font-medium hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? <><Loader2 size={15} className="animate-spin" /> Buscando...</>
            : 'Buscar'
          }
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}
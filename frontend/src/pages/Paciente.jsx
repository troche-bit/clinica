import { useState } from 'react'  // Importamos useState para manejar el estado local del componente
import { usePatients, useDeletePatient } from '../hooks/usePatients' // Importamos los hooks personalizados para obtener y eliminar pacientes
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react' // Importamos los íconos de lucide-react para usarlos en la interfaz
import { useNavigate } from 'react-router-dom' // Importamos useNavigate para manejar la navegación entre páginas

import Modal from '../components/ui/Modal'
import PacienteForm from '../components/paciente/PacienteForm'

// Componente principal para mostrar la lista de pacientes
export default function Paciente() {
  const [modalOpen, setModalOpen] = useState(false)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [searchInput, setSearchInput] = useState('')
  const navigate = useNavigate() // Hook para manejar la navegación entre páginas

  const { data, isLoading, isError } = usePatients({ page, search })
  const { mutate: deletePatient }    = useDeletePatient()

  const totalPages = data ? Math.ceil(data.count / 20) : 0

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleDelete = (id) => {
    if (window.confirm('¿Estás seguro de eliminar este paciente?')) {
      deletePatient(id)
    }
  }

  // Renderizamos la interfaz del componente
  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pacientes</h1>
        <button onClick={() => setModalOpen(true)} 
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} />
          Nuevo Paciente
        </button>
      </div>

      {/* Buscador */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o documento..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
        >
          Buscar
        </button>
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Documento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha Nac.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sexo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  Cargando...
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-red-400">
                  Error al cargar los pacientes
                </td>
              </tr>
            )}
            {data?.results?.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  No se encontraron pacientes
                </td>
              </tr>
            )}
            {data?.results?.map((paciente) => (
              <tr key={paciente.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800">{paciente.nombre}</td>
                <td className="px-4 py-3 text-gray-600">{paciente.documento}</td>
                <td className="px-4 py-3 text-gray-600">{paciente.fecha_nacimiento ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500">
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(paciente.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Modal */}

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Paciente"
          size="lg"
        >
          <PacienteForm onSuccess={() => setModalOpen(false)} />
        </Modal>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">
              Página {page} de {totalPages} — {data?.count} pacientes
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
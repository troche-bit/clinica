import { useState } from 'react' // React hook para manejar el estado del resultado del buscador
import { useNavigate } from 'react-router-dom' //
import BuscadorPersona from '../persona/BuscadorPersona' // Componente que permite buscar una persona por documento o crear una nueva
import FormPersona from  '../persona/FormPersona' //
import FormPaciente from '../paciente/FormPaciente' //
import { useCreatePersona, useUpdatePersona } from '../../hooks/usePersona'
import { useCreatePatient, useUpdatePatient } from '../../hooks/usePatients'


const MODO_LABELS = {
  crear_todo:        { texto: 'Documento no encontrado — completá los datos para registrar', color: 'text-blue-600 bg-blue-50' },
  agregar_paciente:  { texto: 'Persona encontrada — completá los datos del paciente',        color: 'text-green-600 bg-green-50' },
  editar:            { texto: 'Paciente existente — modo edición',                           color: 'text-orange-600 bg-orange-50' },
}

export default function PacienteForm( { onSuccess }) { 
  //const navigate = useNavigate()

  const [resultado,     setResultado]     = useState(null)
  const [formPersona,   setFormPersona]   = useState({})
  const [formPaciente,  setFormPaciente]  = useState({})
  const [guardando,     setGuardando]     = useState(false)
  const [error,         setError]         = useState('')

  const { mutateAsync: createPersona } = useCreatePersona()
  const { mutateAsync: updatePersona } = useUpdatePersona()
  const { mutateAsync: createPaciente } = useCreatePatient()
  const { mutateAsync: updatePaciente } = useUpdatePatient()

  const handleGuardar = async () => {
    onSuccess()
    setError('')
    setGuardando(true)
    try {
      let personaId = resultado.persona?.id

      if (resultado.modo === 'crear_todo') {
        // Crear Persona nueva
        const nuevaPersona = await createPersona(formPersona)
        personaId = nuevaPersona.data.id
        // Crear Paciente
        await createPaciente({ ...formPaciente, persona: personaId })

      } else if (resultado.modo === 'agregar_paciente') {
        // Actualizar Persona existente
        await updatePersona({ id: personaId, ...formPersona })
        // Crear Paciente
        await createPaciente({ ...formPaciente, persona: personaId })

      } else if (resultado.modo === 'editar') {
        // Actualizar Persona
        await updatePersona({ id: personaId, ...formPersona })
        // Actualizar Paciente
        await updatePaciente({
          id: resultado.persona.paciente.id,
          ...formPaciente
        })
      }

      navigate('/pacientes')

    } catch (err) {
      console.log('Error al guardar:', err.response?.data)
      setError('Error al guardar. Revisá los datos e intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      {/* Buscador */}
      <BuscadorPersona onResultado={setResultado} />

      {resultado && (
        <>
          {/* Badge modo */}
          <div className={`text-sm font-medium px-4 py-2 rounded-lg mb-6 ${MODO_LABELS[resultado.modo].color}`}>
            {MODO_LABELS[resultado.modo].texto}
          </div>

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mb-4">
            <FormPersona
              persona={resultado.persona}
              documento={resultado.documento}
              readOnly={resultado.modo === 'agregar_paciente'}
              onChange={setFormPersona}
            />
          </div>

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mb-6">
            <FormPaciente
              paciente={resultado.modo === 'editar' ? resultado.persona?.paciente : null}
              onChange={setFormPaciente}
            />
          </div>

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onSuccess}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
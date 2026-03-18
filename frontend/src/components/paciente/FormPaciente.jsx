import { useEffect, useState } from 'react'

export default function FormPaciente({ paciente, readOnly = false, onChange }) {
  const [form, setForm] = useState({
    fecha_nacimiento: '',
    sexo:             '',
    observacion:      '',
    responsable:      '',
  })

  // Precarga datos si paciente existe
  useEffect(() => {
    if (paciente) {
      setForm({
        fecha_nacimiento: paciente.fecha_nacimiento ?? '',
        sexo:             paciente.sexo             ?? '',
        observacion:      paciente.observacion      ?? '',
        responsable:      paciente.responsable      ?? '',
      })
    }
  }, [paciente])

  // Notifica cambios al padre
  useEffect(() => {
    if (onChange) onChange(form)
  }, [form])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const inputClass = `w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500
    ${readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}`

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-700 mb-4">
        Datos del Paciente
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Fecha de nacimiento */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Fecha de nacimiento
          </label>
          <input
            type="date"
            name="fecha_nacimiento"
            value={form.fecha_nacimiento}
            onChange={handleChange}
            disabled={readOnly}
            className={inputClass}
          />
        </div>

        {/* Sexo */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Sexo
          </label>
          <select
            name="sexo"
            value={form.sexo}
            onChange={handleChange}
            disabled={readOnly}
            className={inputClass}
          >
            <option value="">Seleccioná...</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="O">Otro</option>
          </select>
        </div>

        {/* Responsable */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Responsable
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="responsable"
              value={form.responsable}
              onChange={handleChange}
              disabled={readOnly}
              placeholder="Buscar responsable por documento..."
              className={inputClass}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Opcional — padre, madre o tutor del paciente
          </p>
        </div>

        {/* Observación */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Observación
          </label>
          <textarea
            name="observacion"
            value={form.observacion}
            onChange={handleChange}
            disabled={readOnly}
            rows={3}
            placeholder="Observaciones adicionales..."
            className={inputClass}
          />
        </div>

      </div>
    </div>
  )
}
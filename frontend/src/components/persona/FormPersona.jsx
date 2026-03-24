import { useEffect, useState } from 'react'
import { useTipoDocumento, useCreatePersona, useUpdatePersona } from '../../hooks/usePersona'
import { usePaises, useDepartamentos, useCiudades } from '../../hooks/useUbicacion'
import { calcularDV } from '../../utils/calcularDV'

export default function FormPersona({ persona, documento, readOnly = false, onChange }) {
  const { data: tipoDocumento } = useTipoDocumento()
  
  const [form, setForm] = useState({
    tipo_documento: '',
    nro_documento:  documento || '',
    ruc_dv:         '',
    razon_social:   '',
    telefono:       '',
    correo_electronico:         '',
    pais:           '',
    departamento:   '',
    ciudad:         '',
    direccion:      '',
  })

  const esRuc = tipoDocumento?.find(
    t => t.id === parseInt(form.tipo_documento)
  )?.descripcion?.toUpperCase().includes('RUC')
  const { data: paises } = usePaises()
  const { data: departamentos } = useDepartamentos(form.pais)
  const { data: ciudades }      = useCiudades(form.departamento)

  // Precarga datos si persona existe
  useEffect(() => {
    if (persona) {
      setForm({
        tipo_documento: persona.tipo_documento ?? '',
        nro_documento:  persona.nro_documento  ?? '',
        ruc_dv:         persona.ruc_dv         ?? '',
        razon_social:   persona.razon_social   ?? '',
        telefono:       persona.telefono       ?? '',
        correo_electronico:         persona.correo_electronico         ?? '',
        pais:           persona.pais           ?? '',
        departamento:   persona.departamento   ?? '',
        ciudad:         persona.ciudad         ?? '',
        direccion:      persona.direccion      ?? '',
      })
    }
  }, [persona])

  // Notifica cambios al padre
  useEffect(() => {
    if (onChange) onChange(form)
  }, [form])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const updated = (() => {
        // Resetea campos dependientes al cambiar país o departamento
        if (name === 'pais')        return { ...prev, pais: value, departamento: '', ciudad: '' }
        if (name === 'departamento') return { ...prev, departamento: value, ciudad: '' }
        return { ...prev, [name]: value }
      })()

      if (name === 'nro_documento' && esRuc) {
        return { ...updated, ruc_dv: calcularDV(value) }
      }
      if (name === 'tipo_documento') {

        const nuevoTipo = tipoDocumento?.find(t => t.id === parseInt(value))
        const esNuevoRuc = nuevoTipo?.descripcion?.toUpperCase().includes('RUC')
        if (!esNuevoRuc) return { ...updated, ruc_dv: ''}
        if (esNuevoRuc && updated.nro_documento) {
          return { ...updated, ruc_dv: calcularDV(updated.nro_documento) }
        }
      }
      return updated
    })

  }

  const inputClass = `w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500
    ${readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}`

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-700 mb-4">
        Datos de la Persona
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Tipo documento */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Tipo de documento
          </label>
          <select
            name="tipo_documento"
            value={form.tipo_documento}
            onChange={handleChange}
            disabled={readOnly}
            className={inputClass}
          >
            <option value="">Seleccioná...</option>
            {tipoDocumento?.map(t => (
              <option key={t.id} value={t.id}>{t.descripcion}</option>
            ))}
          </select>
        </div>

        {/* Nro documento */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Nro. de documento
          </label>
          <input
            type="text"
            name="nro_documento"
            value={form.nro_documento}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* Razón social */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Razón social / Nombre completo
          </label>
          <input
            type="text"
            name="razon_social"
            value={form.razon_social}
            onChange={handleChange}
            disabled={readOnly}
            className={inputClass}
          />
        </div>

        {/* RUC */}
        {esRuc && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Dígito verificador
            </label>
            <input
              type="text"
              name="ruc_dv"
              value={form.ruc_dv}
              onChange={handleChange}
              disabled={readOnly}
              placeholder="Se calcula automáticamente"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
            />
            <p className="text-xs text-gray-400 mt-1">
              Calculado automáticamente — podés modificarlo si es necesario
            </p>
          </div>
        )}

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Teléfono
          </label>
          <input
            type="text"
            name="telefono"
            value={form.telefono}
            onChange={handleChange}
            disabled={readOnly}
            className={inputClass}
          />
        </div>

        {/* Correo */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Correo electrónico
          </label>
          <input
            type="email"
            name="correo_electronico"
            value={form.correo_electronico}
            onChange={handleChange}
            disabled={readOnly}
            className={inputClass}
          />
        </div>

        {/* País */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            País
          </label>
          <select
            name="pais"
            value={form.pais}
            onChange={handleChange}
            disabled={readOnly}
            className={inputClass}
          >
            <option value="">
              Seleccioná...
            </option>
            {paises?.map(p => (
                <option key={p.id} value={p.id}>{p.descripcion}</option>
            ))}
          </select>
        </div>

        {/* Departamento */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Departamento
          </label>
          <select
            name="departamento"
            value={form.departamento}
            onChange={handleChange}
            disabled={readOnly || !form.pais}
            className={inputClass}
          >
            <option value="">Seleccioná...</option>
            {departamentos?.map(d => (
              <option key={d.id} value={d.id}>{d.descripcion}</option>
            ))}
          </select>
        </div>

        {/* Ciudad */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Ciudad
          </label>
          <select
            name="ciudad"
            value={form.ciudad}
            onChange={handleChange}
            disabled={readOnly || !form.departamento}
            className={inputClass}
          >
            <option value="">Seleccioná...</option>
            {ciudades?.map(c => (
              <option key={c.id} value={c.id}>{c.descripcion}</option>
            ))}
          </select>
        </div>

        {/* Dirección */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Dirección
          </label>
          <input
            type="text"
            name="direccion"
            value={form.direccion}
            onChange={handleChange}
            disabled={readOnly}
            className={inputClass}
          />
        </div>

      </div>
    </div>
  )
}     
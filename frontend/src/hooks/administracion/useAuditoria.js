import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

export function useAuditoria(filtros = {}) {
  return useQuery({
    queryKey: ['auditoria', filtros],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filtros.modulo)          params.append('modulo',         filtros.modulo)
      if (filtros.accion)          params.append('accion',         filtros.accion)
      if (filtros.usuario)         params.append('usuario',        filtros.usuario)
      if (filtros.fecha_desde)     params.append('fecha_desde',    filtros.fecha_desde)
      if (filtros.fecha_hasta)     params.append('fecha_hasta',    filtros.fecha_hasta)
      if (filtros.search)          params.append('search',         filtros.search)
      if (filtros.page && filtros.page > 1) params.append('page', filtros.page)
      const res = await apiClient.get(`/auditoria/?${params}`)
      return res.data
    },
    staleTime: 0,
  })
}

export function useAuditoriaDetalle(id) {
  return useQuery({
    queryKey: ['auditoria-detalle', id],
    queryFn: async () => {
      const res = await apiClient.get(`/auditoria/${id}/`)
      return res.data
    },
    enabled: Boolean(id),
    staleTime: 0,
  })
}

export async function exportarAuditoriaExcel(filtros = {}) {
  const params = new URLSearchParams()
  if (filtros.modulo)      params.append('modulo',      filtros.modulo)
  if (filtros.accion)      params.append('accion',      filtros.accion)
  if (filtros.usuario)     params.append('usuario',     filtros.usuario)
  if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde)
  if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta)
  if (filtros.search)      params.append('search',      filtros.search)

  const res = await apiClient.get(`/auditoria/exportar-excel/?${params}`, {
    responseType: 'blob',
  })
  const hoy  = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const obj  = URL.createObjectURL(
    new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  )
  const link = document.createElement('a')
  link.href     = obj
  link.download = `auditoria_${hoy}.xlsx`
  link.click()
  URL.revokeObjectURL(obj)
}

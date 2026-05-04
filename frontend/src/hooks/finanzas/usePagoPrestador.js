import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

const BASE = '/pago-prestador/'

export function usePagosPrestador(filters = {}) {
  const params = {}
  if (filters.persona_rrhh) params.persona_rrhh = filters.persona_rrhh
  if (filters.estado)       params.estado       = filters.estado
  if (filters.fecha_desde)  params.fecha_desde  = filters.fecha_desde
  if (filters.fecha_hasta)  params.fecha_hasta  = filters.fecha_hasta
  if (filters.search)       params.search       = filters.search

  return useQuery({
    queryKey: ['pagos-prestador', filters],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params })
      return data
    },
  })
}

export function usePagoPrestadorDetalle(id) {
  return useQuery({
    queryKey: ['pagos-prestador', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}${id}/`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreatePagoPrestador() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post(BASE, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos-prestador'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

export function useDeletePagoPrestador() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos-prestador'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

export function useSiguienteNumeroPago() {
  return useQuery({
    queryKey: ['pago-prestador-siguiente'],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}siguiente-numero/`)
      return data
    },
    staleTime: 0,
  })
}

export function useBloquesPendientes(personaRrhhId, fechaHasta) {
  return useQuery({
    queryKey: ['bloques-pendientes', personaRrhhId, fechaHasta],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}bloques-pendientes/`, {
        params: { persona_rrhh: personaRrhhId, fecha_hasta: fechaHasta },
      })
      return data
    },
    enabled: !!personaRrhhId && !!fechaHasta,
    staleTime: 0,
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

const BASE = '/cobranzas/'

export function useCobranzas(filters = {}) {
  const params = {}
  if (filters.search)      params.search      = filters.search
  if (filters.fecha_desde) params.fecha_desde = filters.fecha_desde
  if (filters.fecha_hasta) params.fecha_hasta = filters.fecha_hasta

  return useQuery({
    queryKey: ['cobranzas', filters],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params })
      return data
    },
  })
}

export function useCobranzaDetalle(id) {
  return useQuery({
    queryKey: ['cobranzas', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}${id}/`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateCobranza() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post(BASE, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobranzas'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] })
      queryClient.invalidateQueries({ queryKey: ['facturas'] })
    },
  })
}

export function useDeleteCobranza() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cobranzas'] }),
  })
}

export function useSiguienteNumeroCob() {
  return useQuery({
    queryKey: ['cobranzas-siguiente-numero'],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}siguiente-numero/`)
      return data
    },
    staleTime: 0,
  })
}

export function useCuotasPendientes(personaId) {
  return useQuery({
    queryKey: ['cuotas-pendientes', personaId],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}cuotas-pendientes/`, {
        params: { persona: personaId },
      })
      return data
    },
    enabled: !!personaId,
    staleTime: 0,
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

const BASE = '/movimientos-caja/'

export function useMovimientos(ctaId, filters = {}) {
  const params = {}
  if (ctaId) params.cta = ctaId
  if (filters.search)      params.search      = filters.search
  if (filters.tipo)        params.tipo        = filters.tipo
  if (filters.fecha_desde) params.fecha_desde = filters.fecha_desde
  if (filters.fecha_hasta) params.fecha_hasta = filters.fecha_hasta

  return useQuery({
    queryKey: ['movimientos', ctaId, filters],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params })
      return data
    },
    enabled: !!ctaId,
  })
}

export function useCreateMovimiento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post(BASE, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] })
    },
  })
}

export function useUpdateMovimiento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`${BASE}${id}/`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] })
    },
  })
}

export function useDeleteMovimiento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] })
    },
  })
}

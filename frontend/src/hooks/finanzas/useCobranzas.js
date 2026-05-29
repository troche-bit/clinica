import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

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
      queryClient.invalidateQueries({ queryKey: ['cobranzas-siguiente-numero'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] })
      queryClient.invalidateQueries({ queryKey: ['facturas'] })
      queryClient.invalidateQueries({ queryKey: ['cuotas-pendientes'] })
    },
  })
}

export function useDeleteCobranza() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobranzas'] })
      queryClient.invalidateQueries({ queryKey: ['cobranzas-siguiente-numero'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] })
      queryClient.invalidateQueries({ queryKey: ['facturas'] })
      queryClient.invalidateQueries({ queryKey: ['cuotas-pendientes'] })
    },
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

export function useValidarNroCobranza(nro) {
  return useQuery({
    queryKey: ['cobranzas-validar-numero', nro],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}validar-numero/`, { params: { nro } })
      return data
    },
    enabled: !!nro && /^\d+$/.test(nro),
    staleTime: 0,
  })
}

export function useClientesConPendientes(search = '') {
  return useQuery({
    queryKey: ['clientes-con-pendientes', search],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}clientes-con-pendientes/`, {
        params: search ? { search } : {},
      })
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

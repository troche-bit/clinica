import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

const BASE = '/facturacion/'

export function useFacturas(filters = {}) {
  const params = {}
  if (filters.search)       params.search       = filters.search
  if (filters.condicion_vta !== undefined && filters.condicion_vta !== '')
    params.condicion_vta = filters.condicion_vta
  if (filters.fecha_desde)  params.fecha_desde  = filters.fecha_desde
  if (filters.fecha_hasta)  params.fecha_hasta  = filters.fecha_hasta

  return useQuery({
    queryKey: ['facturas', filters],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params })
      return data
    },
  })
}

export function useFacturaDetalle(id) {
  return useQuery({
    queryKey: ['facturas', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}${id}/`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateFactura() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post(BASE, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-mcb'] })
    },
  })
}

export function useUpdateFactura() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`${BASE}${id}/`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] })
      queryClient.invalidateQueries({ queryKey: ['facturas', id] })
    },
  })
}

export function useDeleteFactura() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facturas'] }),
  })
}

export function useValidarTimbrado() {
  return useMutation({
    mutationFn: (data) => apiClient.post(`${BASE}validar-timbrado/`, data).then(r => r.data),
  })
}

export function useSiguienteNumero(establecimiento, expedicion) {
  return useQuery({
    queryKey: ['siguiente-numero', establecimiento, expedicion],
    queryFn: async () => {
      const { data } = await apiClient.get(`${BASE}siguiente-numero/`, {
        params: { establecimiento, expedicion },
      })
      return data
    },
    enabled: establecimiento?.length === 3 && expedicion?.length === 3,
    retry: false,
  })
}

export function useFormaPago() {
  return useQuery({
    queryKey: ['forma-pago'],
    queryFn: async () => {
      const { data } = await apiClient.get('/forma-pago/')
      return data
    },
    staleTime: 30 * 60 * 1000,
  })
}

export function useBuscarPersonas(search) {
  return useQuery({
    queryKey: ['personas-buscar', search],
    queryFn: async () => {
      const { data } = await apiClient.get('/persona/', { params: { search, page_size: 8 } })
      return data
    },
    enabled: search?.length >= 2,
    staleTime: 10000,
  })
}

export function useBuscarProductos(search) {
  return useQuery({
    queryKey: ['productos-buscar', search],
    queryFn: async () => {
      const { data } = await apiClient.get('/productos/', { params: { search, activo: 'true', page_size: 10 } })
      return data
    },
    enabled: search?.length >= 2,
    staleTime: 10000,
  })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

const BASE = '/productos/'

export function useProductos(grupoId, filters = {}) {
  const params = {}
  if (grupoId) params.grupo = grupoId
  if (filters.search) params.search = filters.search
  if (filters.activo !== undefined && filters.activo !== '') params.activo = filters.activo

  return useQuery({
    queryKey: ['productos', grupoId, filters],
    queryFn: async () => {
      const { data } = await apiClient.get(BASE, { params })
      return data
    },
    enabled: !!grupoId,
  })
}

export function useCreateProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => apiClient.post(BASE, data).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })
}

export function useUpdateProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => apiClient.patch(`${BASE}${id}/`, data).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })
}

export function useDeleteProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`${BASE}${id}/`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['grupos'] })
    },
  })
}
